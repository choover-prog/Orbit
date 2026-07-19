import { describe, expect, it, vi } from "vitest";
import { GMAIL_READONLY_SCOPE, type GmailOAuthConfig } from "./config";
import { MemoryGmailCredentialStore } from "./credential-store";
import { GmailOAuthSessionStore } from "./oauth-session";
import {
  beginGmailAuthorization,
  buildGmailAuthorizationUrl,
  completeGmailAuthorization,
  refreshGmailAccessToken,
} from "./oauth";

const config: GmailOAuthConfig = {
  clientId: "gmail-client",
  clientSecret: "gmail-secret",
  redirectUri: "http://127.0.0.1:3000",
};
const now = () => Date.parse("2026-07-19T12:00:00.000Z");
function response(value: object, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Gmail OAuth", () => {
  it("uses exact readonly scope and S256 authorization parameters", () => {
    const url = new URL(
      buildGmailAuthorizationUrl(config, {
        state: "state",
        codeChallenge: "challenge",
      }),
    );
    expect(url.searchParams.get("scope")).toBe(GMAIL_READONLY_SCOPE);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("include_granted_scopes")).toBe("false");
  });
  it("consumes PKCE state, persists only refresh credentials, and refreshes server-side", async () => {
    const sessions = new GmailOAuthSessionStore({ now });
    const started = beginGmailAuthorization(config, sessions);
    const credentials = new MemoryGmailCredentialStore();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          access_token: "access",
          refresh_token: "refresh",
          token_type: "Bearer",
          expires_in: 3600,
          scope: GMAIL_READONLY_SCOPE,
        }),
      )
      .mockResolvedValueOnce(
        response({
          access_token: "access-2",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      );
    await expect(
      completeGmailAuthorization(
        {
          code: "code",
          state: started.state,
          cookieBinding: started.cookieBinding,
        },
        config,
        sessions,
        credentials,
        { fetch: fetchMock, now },
      ),
    ).resolves.toMatchObject({ accessToken: "access" });
    await expect(
      refreshGmailAccessToken(config, credentials, { fetch: fetchMock, now }),
    ).resolves.toMatchObject({ accessToken: "access-2" });
    const body = new URLSearchParams(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    );
    expect(body.get("client_secret")).toBe(config.clientSecret);
    expect(await credentials.load()).toMatchObject({
      refreshToken: "refresh",
      grantedScopes: [GMAIL_READONLY_SCOPE],
    });
  });
  it("deletes invalid grants", async () => {
    const credentials = new MemoryGmailCredentialStore();
    await credentials.save({
      version: 1,
      refreshToken: "refresh",
      grantedScopes: [GMAIL_READONLY_SCOPE],
      connectedAt: new Date(now()).toISOString(),
    });
    await expect(
      refreshGmailAccessToken(config, credentials, {
        now,
        fetch: vi
          .fn<typeof fetch>()
          .mockResolvedValue(response({ error: "invalid_grant" }, 400)),
      }),
    ).rejects.toMatchObject({ code: "reauthorization_required" });
    await expect(credentials.load()).resolves.toBeNull();
  });
});
