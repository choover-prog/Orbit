import { describe, expect, it } from "vitest";
import {
  GOOGLE_NEST_SCOPE,
  googleNestAuthorizationUrl,
  resolveGoogleNestConfig,
} from "./config";

describe("Google Nest configuration", () => {
  it("builds the PCM request with exact scope, state, and PKCE", () => {
    const url = new URL(
      googleNestAuthorizationUrl(
        {
          clientId: "client",
          clientSecret: "secret",
          projectId: "project-123",
          redirectUri: "http://127.0.0.1:3000",
        },
        { state: "state", codeChallenge: "challenge" },
      ),
    );
    expect(url.origin).toBe("https://nestservices.google.com");
    expect(url.pathname).toBe("/partnerconnections/project-123/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      scope: GOOGLE_NEST_SCOPE,
      state: "state",
      code_challenge: "challenge",
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent",
    });
  });

  it("rejects non-loopback redirects and missing publisher configuration", () => {
    expect(resolveGoogleNestConfig({})).toMatchObject({ ok: false });
    expect(
      resolveGoogleNestConfig({
        ORBIT_GOOGLE_NEST_CLIENT_ID: "id",
        ORBIT_GOOGLE_NEST_CLIENT_SECRET: "secret",
        ORBIT_GOOGLE_NEST_PROJECT_ID: "project",
        ORBIT_GOOGLE_NEST_REDIRECT_URI: "https://example.com/callback",
      }),
    ).toMatchObject({ ok: false });
  });
});
