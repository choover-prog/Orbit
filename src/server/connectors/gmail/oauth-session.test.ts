import { describe, expect, it } from "vitest";
import {
  GMAIL_OAUTH_COOKIE_NAME,
  GmailOAuthSessionError,
  GmailOAuthSessionStore,
  gmailOAuthCookieOptions,
} from "./oauth-session";

function bytes(fill: number) {
  return (size: number) => new Uint8Array(size).fill(fill++);
}

describe("GmailOAuthSessionStore", () => {
  it("creates a bounded S256 transaction and consumes it once", () => {
    const store = new GmailOAuthSessionStore({
      now: () => 1_000,
      randomBytes: bytes(1),
    });
    const session = store.create();

    expect(session.state).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(session.cookieBinding).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(session.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(session).not.toHaveProperty("codeVerifier");
    expect(store.consume(session.state, session.cookieBinding)).toEqual({
      codeVerifier: expect.stringMatching(/^[A-Za-z0-9_-]{86}$/u),
    });
    expect(() => store.consume(session.state, session.cookieBinding)).toThrow(
      GmailOAuthSessionError,
    );
  });

  it("rejects a mismatched browser binding without consuming the session", () => {
    const store = new GmailOAuthSessionStore({ randomBytes: bytes(8) });
    const first = store.create();
    const other = store.create();

    expect(() => store.consume(first.state, other.cookieBinding)).toThrow(
      /matched to this browser/u,
    );
    expect(store.consume(first.state, first.cookieBinding)).toEqual({
      codeVerifier: expect.any(String),
    });
  });

  it("expires transactions and enforces capacity", () => {
    let now = 1_000;
    const store = new GmailOAuthSessionStore({
      now: () => now,
      randomBytes: bytes(4),
      ttlMs: 100,
      capacity: 1,
    });
    const session = store.create();
    expect(() => store.create()).toThrow(/Too many Gmail/u);

    now = 1_100;
    expect(() => store.consume(session.state, session.cookieBinding)).toThrow(
      /expired/u,
    );
    expect(store.size).toBe(0);
  });

  it("uses a Gmail-only HttpOnly SameSite cookie", () => {
    expect(GMAIL_OAUTH_COOKIE_NAME).toBe("orbit_google_gmail_oauth");
    expect(gmailOAuthCookieOptions("http://127.0.0.1:3000")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 600,
    });
  });
});
