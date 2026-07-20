import { describe, expect, it, vi } from "vitest";
import {
  GOOGLE_CALENDAR_DEFAULT_REDIRECT_URI,
  GOOGLE_CALENDAR_READONLY_SCOPE,
  GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT,
  GOOGLE_OAUTH_REVOKE_ENDPOINT,
  GOOGLE_OAUTH_TOKEN_ENDPOINT,
  resolveGoogleCalendarOAuthConfig,
  type GoogleCalendarOAuthConfig,
} from "./config";
import { MemoryGoogleCalendarCredentialStore } from "./credential-store";
import { GoogleCalendarOAuthSessionStore } from "./oauth-session";
import {
  beginGoogleCalendarAuthorization,
  completeGoogleCalendarAuthorization,
  disconnectGoogleCalendar,
  refreshGoogleCalendarAccessToken,
  type GoogleOAuthFetch,
} from "./oauth";

const NOW = Date.parse("2026-07-19T12:00:00.000Z");
const config: GoogleCalendarOAuthConfig = {
  clientId: "local-client.apps.googleusercontent.com",
  clientSecret: "publisher-desktop-client-secret",
  redirectUri: GOOGLE_CALENDAR_DEFAULT_REDIRECT_URI,
};

function deterministicSessions(): GoogleCalendarOAuthSessionStore {
  let byte = 1;
  return new GoogleCalendarOAuthSessionStore({
    now: () => NOW,
    randomBytes: (size) => new Uint8Array(size).fill(byte++),
  });
}

function tokenResponse(overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      access_token: "access-token",
      expires_in: 3_600,
      refresh_token: "refresh-token",
      scope: GOOGLE_CALENDAR_READONLY_SCOPE,
      token_type: "Bearer",
      ...overrides,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("Google Calendar OAuth configuration", () => {
  it("requires a server-owned client ID and an explicit loopback redirect", () => {
    expect(resolveGoogleCalendarOAuthConfig({})).toMatchObject({ ok: false });
    expect(
      resolveGoogleCalendarOAuthConfig({
        ORBIT_GOOGLE_CALENDAR_CLIENT_ID: "client-id",
        ORBIT_GOOGLE_CALENDAR_CLIENT_SECRET: "client-secret",
      }),
    ).toEqual({
      ok: true,
      config: {
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: GOOGLE_CALENDAR_DEFAULT_REDIRECT_URI,
      },
    });
    expect(
      resolveGoogleCalendarOAuthConfig({
        ORBIT_GOOGLE_CALENDAR_CLIENT_ID: "client-id",
        ORBIT_GOOGLE_CALENDAR_CLIENT_SECRET: "client-secret",
        ORBIT_GOOGLE_CALENDAR_REDIRECT_URI:
          "https://calendar-token-collector.example/callback",
      }),
    ).toMatchObject({ ok: false });
    expect(
      resolveGoogleCalendarOAuthConfig({
        ORBIT_GOOGLE_CALENDAR_CLIENT_ID: "client-id",
        ORBIT_GOOGLE_CALENDAR_CLIENT_SECRET: "client-secret",
        ORBIT_GOOGLE_CALENDAR_REDIRECT_URI: "http://127.0.0.1:3000/",
      }),
    ).toMatchObject({ ok: true });
    expect(
      resolveGoogleCalendarOAuthConfig({
        ORBIT_GOOGLE_CALENDAR_CLIENT_ID: "client-id",
        ORBIT_GOOGLE_CALENDAR_CLIENT_SECRET: "client-secret",
        ORBIT_GOOGLE_CALENDAR_REDIRECT_URI:
          "http://127.0.0.1:3000/api/connectors/google-calendar/callback",
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("Google Calendar authorization", () => {
  it("builds an offline, exact-scope S256 authorization request", () => {
    const sessions = deterministicSessions();
    const start = beginGoogleCalendarAuthorization(config, sessions);
    const url = new URL(start.authorizationUrl);

    expect(`${url.origin}${url.pathname}`).toBe(
      GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT,
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      access_type: "offline",
      client_id: config.clientId,
      code_challenge: start.codeChallenge,
      code_challenge_method: "S256",
      include_granted_scopes: "false",
      prompt: "consent",
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: GOOGLE_CALENDAR_READONLY_SCOPE,
      state: start.state,
    });
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_verifier")).toBe(false);
  });

  it("exchanges the code server-side and persists only the refresh credential", async () => {
    const sessions = deterministicSessions();
    const credentials = new MemoryGoogleCalendarCredentialStore();
    const start = beginGoogleCalendarAuthorization(config, sessions);
    const fetchMock = vi.fn<GoogleOAuthFetch>(async () => tokenResponse());

    const token = await completeGoogleCalendarAuthorization(
      {
        code: "authorization-code",
        state: start.state,
        cookieBinding: start.cookieBinding,
      },
      config,
      sessions,
      credentials,
      { fetch: fetchMock, now: () => NOW },
    );

    expect(token).toEqual({
      accessToken: "access-token",
      tokenType: "Bearer",
      expiresAt: "2026-07-19T13:00:00.000Z",
      grantedScopes: [GOOGLE_CALENDAR_READONLY_SCOPE],
    });
    expect(await credentials.load()).toEqual({
      version: 1,
      refreshToken: "refresh-token",
      grantedScopes: [GOOGLE_CALENDAR_READONLY_SCOPE],
      connectedAt: "2026-07-19T12:00:00.000Z",
    });

    const [endpoint, request] = fetchMock.mock.calls[0] ?? [];
    expect(endpoint).toBe(GOOGLE_OAUTH_TOKEN_ENDPOINT);
    const body = new URLSearchParams(String(request?.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("authorization-code");
    expect(body.get("code_verifier")).toHaveLength(86);
    expect(body.get("client_secret")).toBe(config.clientSecret);
    expect(String(endpoint)).not.toContain("authorization-code");
  });

  it("refuses broader grants and does not save them", async () => {
    const sessions = deterministicSessions();
    const credentials = new MemoryGoogleCalendarCredentialStore();
    const start = beginGoogleCalendarAuthorization(config, sessions);

    await expect(
      completeGoogleCalendarAuthorization(
        {
          code: "authorization-code",
          state: start.state,
          cookieBinding: start.cookieBinding,
        },
        config,
        sessions,
        credentials,
        {
          fetch: async () =>
            tokenResponse({
              scope: `${GOOGLE_CALENDAR_READONLY_SCOPE} https://www.googleapis.com/auth/calendar`,
            }),
          now: () => NOW,
        },
      ),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
    await expect(credentials.load()).resolves.toBeNull();
  });

  it("stops reading a chunked OAuth response at the byte cap", async () => {
    const sessions = deterministicSessions();
    const credentials = new MemoryGoogleCalendarCredentialStore();
    const start = beginGoogleCalendarAuthorization(config, sessions);
    const oversizedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(64 * 1_024 + 1));
        controller.close();
      },
    });

    await expect(
      completeGoogleCalendarAuthorization(
        {
          code: "authorization-code",
          state: start.state,
          cookieBinding: start.cookieBinding,
        },
        config,
        sessions,
        credentials,
        {
          fetch: async () =>
            new Response(oversizedBody, {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          now: () => NOW,
        },
      ),
    ).rejects.toMatchObject({ code: "invalid_response" });
    await expect(credentials.load()).resolves.toBeNull();
  });
});

describe("Google Calendar token lifecycle", () => {
  it("refreshes into memory without persisting the access token", async () => {
    const credentials = new MemoryGoogleCalendarCredentialStore();
    await credentials.save({
      version: 1,
      refreshToken: "stored-refresh-token",
      grantedScopes: [GOOGLE_CALENDAR_READONLY_SCOPE],
      connectedAt: "2026-07-19T10:00:00.000Z",
    });
    const fetchMock = vi.fn<GoogleOAuthFetch>(async () =>
      tokenResponse({ refresh_token: undefined, scope: undefined }),
    );

    const token = await refreshGoogleCalendarAccessToken(config, credentials, {
      fetch: fetchMock,
      now: () => NOW,
    });

    expect(token.accessToken).toBe("access-token");
    expect(await credentials.load()).toEqual({
      version: 1,
      refreshToken: "stored-refresh-token",
      grantedScopes: [GOOGLE_CALENDAR_READONLY_SCOPE],
      connectedAt: "2026-07-19T10:00:00.000Z",
    });
    const [, request] = fetchMock.mock.calls[0] ?? [];
    const body = new URLSearchParams(String(request?.body));
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("stored-refresh-token");
  });

  it("deletes an invalid grant and requires reauthorization", async () => {
    const credentials = new MemoryGoogleCalendarCredentialStore();
    await credentials.save({
      version: 1,
      refreshToken: "revoked-refresh-token",
      grantedScopes: [GOOGLE_CALENDAR_READONLY_SCOPE],
      connectedAt: "2026-07-19T10:00:00.000Z",
    });

    await expect(
      refreshGoogleCalendarAccessToken(config, credentials, {
        fetch: async () =>
          new Response(JSON.stringify({ error: "invalid_grant" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          }),
        now: () => NOW,
      }),
    ).rejects.toMatchObject({ code: "reauthorization_required" });
    await expect(credentials.load()).resolves.toBeNull();
  });

  it("keeps Desktop publisher credentials in the server-side token exchange", async () => {
    const credentials = new MemoryGoogleCalendarCredentialStore();
    await credentials.save({
      version: 1,
      refreshToken: "stored-refresh-token",
      grantedScopes: [GOOGLE_CALENDAR_READONLY_SCOPE],
      connectedAt: "2026-07-19T10:00:00.000Z",
    });
    const fetchMock = vi.fn<GoogleOAuthFetch>(async () =>
      tokenResponse({ refresh_token: undefined, scope: undefined }),
    );

    await refreshGoogleCalendarAccessToken(config, credentials, {
      fetch: fetchMock,
      now: () => NOW,
    });

    const [, request] = fetchMock.mock.calls[0] ?? [];
    const body = new URLSearchParams(String(request?.body));
    expect(body.get("client_secret")).toBe(config.clientSecret);
  });

  it("revokes the grant and always deletes the local credential", async () => {
    const storedCredential = {
      version: 1,
      refreshToken: "stored-refresh-token",
      grantedScopes: [GOOGLE_CALENDAR_READONLY_SCOPE],
      connectedAt: "2026-07-19T10:00:00.000Z",
    } as const;
    const order: string[] = [];
    const credentials = {
      async load() {
        return {
          ...storedCredential,
          grantedScopes: [...storedCredential.grantedScopes],
        };
      },
      async save() {},
      async delete() {
        order.push("local-delete");
      },
    };
    const fetchMock = vi.fn<GoogleOAuthFetch>(async () => {
      order.push("provider-revoke");
      return new Response(null, { status: 200 });
    });

    await expect(
      disconnectGoogleCalendar(credentials, {
        fetch: fetchMock,
      }),
    ).resolves.toEqual({
      localCredentialsDeleted: true,
      providerRevoked: true,
    });
    expect(order).toEqual(["local-delete", "provider-revoke"]);

    const [endpoint, request] = fetchMock.mock.calls[0] ?? [];
    expect(endpoint).toBe(GOOGLE_OAUTH_REVOKE_ENDPOINT);
    expect(new URLSearchParams(String(request?.body)).get("token")).toBe(
      "stored-refresh-token",
    );
  });

  it("deletes local credentials when provider revocation is unreachable", async () => {
    const credentials = new MemoryGoogleCalendarCredentialStore();
    await credentials.save({
      version: 1,
      refreshToken: "stored-refresh-token",
      grantedScopes: [GOOGLE_CALENDAR_READONLY_SCOPE],
      connectedAt: "2026-07-19T10:00:00.000Z",
    });

    await expect(
      disconnectGoogleCalendar(credentials, {
        fetch: async () => {
          throw new Error("offline");
        },
      }),
    ).resolves.toEqual({
      localCredentialsDeleted: true,
      providerRevoked: false,
    });
    await expect(credentials.load()).resolves.toBeNull();
  });

  it("deletes unreadable local credentials without attempting revocation", async () => {
    const order: string[] = [];
    const credentials = {
      async load() {
        order.push("load-failed");
        throw new Error("corrupt vault");
      },
      async save() {},
      async delete() {
        order.push("local-delete");
      },
    };
    const fetchMock = vi.fn<GoogleOAuthFetch>();

    await expect(
      disconnectGoogleCalendar(credentials, { fetch: fetchMock }),
    ).resolves.toEqual({
      localCredentialsDeleted: true,
      providerRevoked: false,
    });
    expect(order).toEqual(["load-failed", "local-delete"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
