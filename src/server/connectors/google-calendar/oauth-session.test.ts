import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GOOGLE_CALENDAR_OAUTH_COOKIE_NAME,
  GoogleCalendarOAuthSessionError,
  GoogleCalendarOAuthSessionStore,
  googleCalendarOAuthCookieOptions,
} from "./oauth-session";

function sequentialRandom() {
  let value = 1;
  return (size: number) => {
    const result = new Uint8Array(size).fill(value);
    value += 1;
    return result;
  };
}

describe("GoogleCalendarOAuthSessionStore", () => {
  it("creates an S256 PKCE session bound to a browser cookie", () => {
    const store = new GoogleCalendarOAuthSessionStore({
      now: () => Date.parse("2026-07-19T12:00:00.000Z"),
      randomBytes: sequentialRandom(),
    });

    const start = store.create();
    const consumed = store.consume(start.state, start.cookieBinding);
    const expectedChallenge = createHash("sha256")
      .update(consumed.codeVerifier, "utf8")
      .digest("base64url");

    expect(start.state).toHaveLength(43);
    expect(consumed.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(consumed.codeVerifier.length).toBeLessThanOrEqual(128);
    expect(start.codeChallenge).toBe(expectedChallenge);
    expect(start.expiresAt).toBe("2026-07-19T12:10:00.000Z");
    expect(store.size).toBe(0);
  });

  it("rejects a mismatched cookie without consuming the valid session", () => {
    const store = new GoogleCalendarOAuthSessionStore({
      randomBytes: sequentialRandom(),
    });
    const start = store.create();

    expect(() => store.consume(start.state, "wrong-browser")).toThrowError(
      GoogleCalendarOAuthSessionError,
    );
    expect(store.size).toBe(1);
    expect(() => store.consume(start.state, start.cookieBinding)).not.toThrow();
  });

  it("expires sessions and prevents successful-session replay", () => {
    let now = 100;
    const store = new GoogleCalendarOAuthSessionStore({
      now: () => now,
      randomBytes: sequentialRandom(),
      ttlMs: 1_000,
    });
    const expired = store.create();
    now = 1_100;

    expect(() => store.consume(expired.state, expired.cookieBinding)).toThrow(
      expect.objectContaining({ code: "expired_session" }),
    );

    const fresh = store.create();
    store.consume(fresh.state, fresh.cookieBinding);
    expect(() => store.consume(fresh.state, fresh.cookieBinding)).toThrow(
      expect.objectContaining({ code: "invalid_session" }),
    );
  });

  it("bounds pending authorization state and releases expired capacity", () => {
    let now = 0;
    const store = new GoogleCalendarOAuthSessionStore({
      now: () => now,
      randomBytes: sequentialRandom(),
      ttlMs: 100,
      capacity: 1,
    });

    store.create();
    expect(() => store.create()).toThrow(
      expect.objectContaining({ code: "session_capacity" }),
    );

    now = 100;
    expect(() => store.create()).not.toThrow();
  });
});

describe("Google Calendar OAuth cookie policy", () => {
  it("uses a short-lived HttpOnly Lax cookie for a loopback callback", () => {
    expect(GOOGLE_CALENDAR_OAUTH_COOKIE_NAME).toBe(
      "orbit_google_calendar_oauth",
    );
    expect(googleCalendarOAuthCookieOptions("http://127.0.0.1:3000")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 600,
    });
  });
});
