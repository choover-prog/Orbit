import { describe, expect, it } from "vitest";
import { GoogleNestOAuthSessionStore } from "./oauth-session";

describe("Google Nest OAuth session", () => {
  it("binds PKCE state to one cookie and consumes it once", () => {
    const store = new GoogleNestOAuthSessionStore();
    const session = store.create(1_000);
    expect(session.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(store.consume(session.state, session.cookieBinding, 2_000)).toBe(
      session.codeVerifier,
    );
    expect(() =>
      store.consume(session.state, session.cookieBinding, 2_000),
    ).toThrow();
  });

  it("rejects a different browser binding", () => {
    const store = new GoogleNestOAuthSessionStore();
    const session = store.create();
    expect(() => store.consume(session.state, "x".repeat(43))).toThrow();
  });
});
