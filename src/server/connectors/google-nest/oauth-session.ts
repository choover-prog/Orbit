import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_NEST_OAUTH_COOKIE = "orbit_google_nest_oauth";
const TTL_MS = 10 * 60_000;
const CAPACITY = 16;

interface PendingSession {
  verifier: string;
  bindingHash: Buffer;
  expiresAt: number;
}

function hash(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export class GoogleNestOAuthSessionStore {
  private readonly sessions = new Map<string, PendingSession>();

  create(now = Date.now()): {
    state: string;
    cookieBinding: string;
    codeVerifier: string;
    codeChallenge: string;
  } {
    this.prune(now);
    if (this.sessions.size >= CAPACITY)
      throw new Error(
        "Too many Google Nest authorization attempts are pending.",
      );
    const state = randomBytes(32).toString("base64url");
    const cookieBinding = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(64).toString("base64url");
    this.sessions.set(state, {
      verifier: codeVerifier,
      bindingHash: hash(cookieBinding),
      expiresAt: now + TTL_MS,
    });
    return {
      state,
      cookieBinding,
      codeVerifier,
      codeChallenge: hash(codeVerifier).toString("base64url"),
    };
  }

  consume(
    state: string | undefined,
    binding: string | undefined,
    now = Date.now(),
  ): string {
    this.prune(now);
    if (
      !state ||
      !binding ||
      !/^[A-Za-z0-9_-]{43}$/u.test(state) ||
      !/^[A-Za-z0-9_-]{43}$/u.test(binding)
    ) {
      throw new Error(
        "Google Nest authorization could not be matched to this browser.",
      );
    }
    const session = this.sessions.get(state);
    this.sessions.delete(state);
    if (!session)
      throw new Error("Google Nest authorization is invalid or expired.");
    const actual = hash(binding);
    if (
      actual.length !== session.bindingHash.length ||
      !timingSafeEqual(actual, session.bindingHash)
    ) {
      throw new Error(
        "Google Nest authorization could not be matched to this browser.",
      );
    }
    return session.verifier;
  }

  clear(): void {
    this.sessions.clear();
  }

  private prune(now: number): void {
    for (const [key, session] of this.sessions)
      if (now >= session.expiresAt) this.sessions.delete(key);
  }
}

const globals = globalThis as typeof globalThis & {
  __orbitNestOAuthSessions?: GoogleNestOAuthSessionStore;
};
export function getGoogleNestOAuthSessions(): GoogleNestOAuthSessionStore {
  globals.__orbitNestOAuthSessions ??= new GoogleNestOAuthSessionStore();
  return globals.__orbitNestOAuthSessions;
}

export function googleNestCookieOptions(redirectUri: string) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: new URL(redirectUri).protocol === "https:",
    path: "/",
    maxAge: TTL_MS / 1000,
  };
}
