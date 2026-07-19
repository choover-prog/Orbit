import {
  createHash,
  randomBytes as nodeRandomBytes,
  timingSafeEqual,
} from "node:crypto";

export const GOOGLE_CALENDAR_OAUTH_SESSION_TTL_MS = 10 * 60 * 1_000;
export const GOOGLE_CALENDAR_OAUTH_SESSION_CAPACITY = 32;
export const GOOGLE_CALENDAR_OAUTH_COOKIE_NAME = "orbit_google_calendar_oauth";

export interface GoogleCalendarOAuthCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

export function googleCalendarOAuthCookieOptions(
  redirectUri: string,
): GoogleCalendarOAuthCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(redirectUri).protocol === "https:",
    path: "/",
    maxAge: GOOGLE_CALENDAR_OAUTH_SESSION_TTL_MS / 1_000,
  };
}

export interface GoogleCalendarOAuthSessionStart {
  state: string;
  codeChallenge: string;
  cookieBinding: string;
  expiresAt: string;
}

export interface ConsumedGoogleCalendarOAuthSession {
  codeVerifier: string;
}

export class GoogleCalendarOAuthSessionError extends Error {
  constructor(
    public readonly code:
      "invalid_session" | "expired_session" | "session_capacity",
    message: string,
  ) {
    super(message);
    this.name = "GoogleCalendarOAuthSessionError";
  }
}

interface StoredOAuthSession {
  codeVerifier: string;
  cookieBindingHash: Buffer;
  expiresAt: number;
}

export interface GoogleCalendarOAuthSessionStoreOptions {
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

/**
 * A deliberately process-local, bounded store for one OAuth round-trip. It
 * keeps the PKCE verifier off the browser and binds state to an HttpOnly cookie
 * value without retaining the raw cookie value server-side.
 */
export class GoogleCalendarOAuthSessionStore {
  private readonly sessions = new Map<string, StoredOAuthSession>();
  private readonly now: () => number;
  private readonly random: (size: number) => Uint8Array;
  private readonly ttlMs: number;
  private readonly capacity: number;

  constructor(options: GoogleCalendarOAuthSessionStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.random = options.randomBytes ?? nodeRandomBytes;
    this.ttlMs = options.ttlMs ?? GOOGLE_CALENDAR_OAUTH_SESSION_TTL_MS;
    this.capacity = options.capacity ?? GOOGLE_CALENDAR_OAUTH_SESSION_CAPACITY;
  }

  create(): GoogleCalendarOAuthSessionStart {
    const now = this.now();
    this.prune(now);
    if (this.sessions.size >= this.capacity) {
      throw new GoogleCalendarOAuthSessionError(
        "session_capacity",
        "Too many Google Calendar authorization attempts are pending.",
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
  ): ConsumedGoogleCalendarOAuthSession {
    const compactToken = /^[A-Za-z0-9_-]{43}$/;
    if (
      !state ||
      !cookieBinding ||
      !compactToken.test(state) ||
      !compactToken.test(cookieBinding)
    ) {
      throw new GoogleCalendarOAuthSessionError(
        "invalid_session",
        "Google Calendar authorization could not be matched to this browser.",
      );
    }

    const session = this.sessions.get(state);
    if (!session) {
      throw new GoogleCalendarOAuthSessionError(
        "invalid_session",
        "Google Calendar authorization is invalid or has already been used.",
      );
    }

    if (this.now() >= session.expiresAt) {
      this.sessions.delete(state);
      throw new GoogleCalendarOAuthSessionError(
        "expired_session",
        "Google Calendar authorization expired. Start the connection again.",
      );
    }

    const actualBindingHash = sha256(cookieBinding);
    if (
      actualBindingHash.length !== session.cookieBindingHash.length ||
      !timingSafeEqual(actualBindingHash, session.cookieBindingHash)
    ) {
      throw new GoogleCalendarOAuthSessionError(
        "invalid_session",
        "Google Calendar authorization could not be matched to this browser.",
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
  __orbitGoogleCalendarOAuthSessions?: GoogleCalendarOAuthSessionStore;
};

export function getGoogleCalendarOAuthSessionStore(): GoogleCalendarOAuthSessionStore {
  globalForOAuthSessions.__orbitGoogleCalendarOAuthSessions ??=
    new GoogleCalendarOAuthSessionStore();
  return globalForOAuthSessions.__orbitGoogleCalendarOAuthSessions;
}
