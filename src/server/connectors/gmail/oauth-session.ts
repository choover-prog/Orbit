import {
  createHash,
  randomBytes as nodeRandomBytes,
  timingSafeEqual,
} from "node:crypto";

export const GMAIL_OAUTH_SESSION_TTL_MS = 10 * 60 * 1_000;
export const GMAIL_OAUTH_SESSION_CAPACITY = 32;
export const GMAIL_OAUTH_COOKIE_NAME = "orbit_google_gmail_oauth";

export interface GmailOAuthCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

export function gmailOAuthCookieOptions(
  redirectUri: string,
): GmailOAuthCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(redirectUri).protocol === "https:",
    path: "/",
    maxAge: GMAIL_OAUTH_SESSION_TTL_MS / 1_000,
  };
}

export interface GmailOAuthSessionStart {
  state: string;
  codeChallenge: string;
  cookieBinding: string;
  expiresAt: string;
}

export class GmailOAuthSessionError extends Error {
  constructor(
    public readonly code:
      "invalid_session" | "expired_session" | "session_capacity",
    message: string,
  ) {
    super(message);
    this.name = "GmailOAuthSessionError";
  }
}

interface StoredOAuthSession {
  codeVerifier: string;
  cookieBindingHash: Buffer;
  expiresAt: number;
}

export interface GmailOAuthSessionStoreOptions {
  now?: () => number;
  randomBytes?: (size: number) => Uint8Array;
  ttlMs?: number;
  capacity?: number;
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export class GmailOAuthSessionStore {
  private readonly sessions = new Map<string, StoredOAuthSession>();
  private readonly now: () => number;
  private readonly random: (size: number) => Uint8Array;
  private readonly ttlMs: number;
  private readonly capacity: number;

  constructor(options: GmailOAuthSessionStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.random = options.randomBytes ?? nodeRandomBytes;
    this.ttlMs = options.ttlMs ?? GMAIL_OAUTH_SESSION_TTL_MS;
    this.capacity = options.capacity ?? GMAIL_OAUTH_SESSION_CAPACITY;
  }

  create(): GmailOAuthSessionStart {
    const now = this.now();
    this.prune(now);
    if (this.sessions.size >= this.capacity) {
      throw new GmailOAuthSessionError(
        "session_capacity",
        "Too many Gmail authorization attempts are pending.",
      );
    }

    const state = base64Url(this.randomExactly(32));
    const cookieBinding = base64Url(this.randomExactly(32));
    const codeVerifier = base64Url(this.randomExactly(64));
    const expiresAt = now + this.ttlMs;
    this.sessions.set(state, {
      codeVerifier,
      cookieBindingHash: sha256(cookieBinding),
      expiresAt,
    });
    return {
      state,
      codeChallenge: base64Url(sha256(codeVerifier)),
      cookieBinding,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  consume(
    state: string | undefined,
    cookieBinding: string | undefined,
  ): { codeVerifier: string } {
    const compactToken = /^[A-Za-z0-9_-]{43}$/;
    if (
      !state ||
      !cookieBinding ||
      !compactToken.test(state) ||
      !compactToken.test(cookieBinding)
    ) {
      throw new GmailOAuthSessionError(
        "invalid_session",
        "Gmail authorization could not be matched to this browser.",
      );
    }

    const session = this.sessions.get(state);
    if (!session) {
      throw new GmailOAuthSessionError(
        "invalid_session",
        "Gmail authorization is invalid or has already been used.",
      );
    }
    if (this.now() >= session.expiresAt) {
      this.sessions.delete(state);
      throw new GmailOAuthSessionError(
        "expired_session",
        "Gmail authorization expired. Start the connection again.",
      );
    }

    const actualHash = sha256(cookieBinding);
    if (
      actualHash.length !== session.cookieBindingHash.length ||
      !timingSafeEqual(actualHash, session.cookieBindingHash)
    ) {
      throw new GmailOAuthSessionError(
        "invalid_session",
        "Gmail authorization could not be matched to this browser.",
      );
    }

    this.sessions.delete(state);
    return { codeVerifier: session.codeVerifier };
  }

  clear(): void {
    this.sessions.clear();
  }

  get size(): number {
    this.prune(this.now());
    return this.sessions.size;
  }

  private prune(now: number): void {
    for (const [state, session] of this.sessions) {
      if (now >= session.expiresAt) this.sessions.delete(state);
    }
  }

  private randomExactly(size: number): Uint8Array {
    const bytes = this.random(size);
    if (bytes.byteLength !== size) {
      throw new Error(
        "The OAuth random source returned an invalid byte count.",
      );
    }
    return bytes;
  }
}

const globalForOAuthSessions = globalThis as typeof globalThis & {
  __orbitGmailOAuthSessions?: GmailOAuthSessionStore;
};

export function getGmailOAuthSessionStore(): GmailOAuthSessionStore {
  globalForOAuthSessions.__orbitGmailOAuthSessions ??=
    new GmailOAuthSessionStore();
  return globalForOAuthSessions.__orbitGmailOAuthSessions;
}
