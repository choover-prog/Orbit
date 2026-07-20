import { describe, expect, it, vi } from "vitest";

import { GMAIL_READONLY_SCOPE } from "./config";
import { MemoryGmailCredentialStore } from "./credential-store";
import { GmailGateway } from "./gateway";

const NOW = new Date("2026-07-19T16:00:00.000Z");
const LIVE_ENVIRONMENT = {
  ORBIT_GOOGLE_GMAIL_MODE: "live",
  ORBIT_GOOGLE_GMAIL_CLIENT_ID: "fake-client.apps.googleusercontent.com",
  ORBIT_GOOGLE_GMAIL_CLIENT_SECRET: "fake-publisher-secret",
  ORBIT_GOOGLE_GMAIL_REDIRECT_URI: "http://127.0.0.1:3000",
};

function messageList(id = "provider-message-id") {
  return { messages: [{ id }] };
}

function messageDetail(id = "provider-message-id") {
  return {
    id,
    threadId: "provider-thread-id",
    labelIds: ["INBOX", "UNREAD", "IMPORTANT"],
    snippet: "A bounded preview.",
    internalDate: String(NOW.getTime() - 60_000),
    payload: { headers: [{ name: "Subject", value: "Project Review" }] },
  };
}

function tokenResponse(accessToken = "fake-access-token", expiresIn = 3_600) {
  return Response.json({
    access_token: accessToken,
    expires_in: expiresIn,
    scope: GMAIL_READONLY_SCOPE,
    token_type: "Bearer",
  });
}

async function connectedCredentials() {
  const credentials = new MemoryGmailCredentialStore();
  await credentials.save({
    version: 1,
    refreshToken: "fake-refresh-token",
    grantedScopes: [GMAIL_READONLY_SCOPE],
    connectedAt: NOW.toISOString(),
  });
  return credentials;
}

describe("GmailGateway", () => {
  it("keeps fixture mode disconnected until consent and never uses the network", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const gateway = new GmailGateway({ mode: "fixture", fetchImpl });

    await expect(gateway.read(NOW)).resolves.toMatchObject({
      status: "disconnected",
      authorization: "disconnected",
    });

    const connected = await gateway.beginAuthorization(NOW);
    expect(connected.kind).toBe("fixture");
    if (connected.kind === "fixture") {
      expect(connected.state).toMatchObject({
        status: "fresh",
        authorization: "connected",
        batch: { completeness: "complete" },
      });
      expect(connected.state.batch?.records).toHaveLength(2);
    }
    expect(fetchImpl).not.toHaveBeenCalled();

    await expect(gateway.disconnect()).resolves.toEqual({
      localCredentialsDeleted: true,
      providerRevoked: true,
    });
    await expect(gateway.authorizationStatus()).resolves.toBe("disconnected");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed when live secure storage is unsupported", async () => {
    const gateway = new GmailGateway({
      environment: LIVE_ENVIRONMENT,
      platform: "linux",
    });

    await expect(gateway.read(NOW)).resolves.toMatchObject({
      status: "storage_unavailable",
      authorization: "storage_unavailable",
      failure: { code: "storage_unavailable" },
    });
  });

  it("refreshes server-side and returns only minimized email records", async () => {
    const credentials = await connectedCredentials();
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.href === "https://oauth2.googleapis.com/token") {
        return tokenResponse();
      }
      if (url.searchParams.get("format") === "metadata") {
        return Response.json({
          ...messageDetail(),
          raw: "must not cross the boundary",
          payload: {
            headers: [{ name: "Subject", value: "Project Review" }],
            body: { data: "private-body" },
          },
        });
      }
      if (url.origin === "https://gmail.googleapis.com") {
        return Response.json(messageList());
      }
      throw new Error(`Unexpected test endpoint: ${url.href}`);
    });
    const gateway = new GmailGateway({
      environment: LIVE_ENVIRONMENT,
      credentialStore: credentials,
      fetchImpl,
    });

    const state = await gateway.read(NOW);

    expect(state).toMatchObject({
      status: "fresh",
      authorization: "connected",
      mode: "live",
    });
    const serialized = JSON.stringify(state.batch?.records);
    expect(serialized).toContain("Project Review");
    expect(serialized).toContain("A bounded preview");
    expect(serialized).not.toContain("provider-message-id");
    expect(serialized).not.toContain("provider-thread-id");
    expect(serialized).not.toContain("must not cross");
    expect(serialized).not.toContain("private-body");
  });

  it("cannot restore rotated credentials after disconnect races a refresh", async () => {
    const credentials = await connectedCredentials();
    let resolveToken: ((response: Response) => void) | undefined;
    const tokenResponsePromise = new Promise<Response>((resolve) => {
      resolveToken = resolve;
    });
    const fetchImpl = vi.fn<typeof fetch>((input) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        return tokenResponsePromise;
      }
      if (url === "https://oauth2.googleapis.com/revoke") {
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected test endpoint: ${url}`));
    });
    const gateway = new GmailGateway({
      environment: LIVE_ENVIRONMENT,
      credentialStore: credentials,
      fetchImpl,
    });

    const read = gateway.read(NOW);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await gateway.disconnect();
    resolveToken?.(
      Response.json({
        access_token: "late-access-token",
        refresh_token: "late-rotated-refresh-token",
        expires_in: 3_600,
        scope: GMAIL_READONLY_SCOPE,
        token_type: "Bearer",
      }),
    );

    await expect(read).resolves.toMatchObject({
      status: "reauthorization_required",
    });
    await expect(credentials.load()).resolves.toBeNull();
  });

  it("never serves cached mail after invalid_grant follows a provider 401", async () => {
    const credentials = await connectedCredentials();
    let tokenRequests = 0;
    let listRequests = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.href === "https://oauth2.googleapis.com/token") {
        tokenRequests += 1;
        return tokenRequests === 1
          ? tokenResponse("initial-access-token", 86_400)
          : Response.json({ error: "invalid_grant" }, { status: 400 });
      }
      if (url.searchParams.get("format") === "metadata") {
        return Response.json(messageDetail());
      }
      if (url.origin === "https://gmail.googleapis.com") {
        listRequests += 1;
        return listRequests === 1
          ? Response.json(messageList())
          : Response.json({}, { status: 401 });
      }
      throw new Error(`Unexpected test endpoint: ${url.href}`);
    });
    const gateway = new GmailGateway({
      environment: LIVE_ENVIRONMENT,
      credentialStore: credentials,
      fetchImpl,
    });

    await expect(gateway.read(NOW)).resolves.toMatchObject({ status: "fresh" });
    const rejected = await gateway.read(
      new Date(NOW.getTime() + 5 * 60 * 1_000),
    );

    expect(rejected).toMatchObject({
      status: "reauthorization_required",
      authorization: "reauthorization_required",
    });
    expect("batch" in rejected).toBe(false);
    expect(tokenRequests).toBe(2);
    expect(listRequests).toBe(2);
    await expect(credentials.load()).resolves.toBeNull();
  });
});
