import { describe, expect, it, vi } from "vitest";
import { MemoryGoogleCalendarCredentialStore } from "./credential-store";
import { GoogleCalendarGateway } from "./gateway";

const NOW = new Date("2026-07-19T16:00:00.000Z");
const LIVE_ENVIRONMENT = {
  ORBIT_GOOGLE_CALENDAR_MODE: "live",
  ORBIT_GOOGLE_CALENDAR_CLIENT_ID: "fake-client.apps.googleusercontent.com",
  ORBIT_GOOGLE_CALENDAR_CLIENT_SECRET: "fake-publisher-secret",
  ORBIT_GOOGLE_CALENDAR_REDIRECT_URI: "http://127.0.0.1:3000",
};

describe("GoogleCalendarGateway", () => {
  it("keeps fixture mode disconnected until explicit consent and performs no network request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const gateway = new GoogleCalendarGateway({
      mode: "fixture",
      fetchImpl,
    });

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
      });
      expect(connected.state.batch?.records).toHaveLength(3);
    }
    expect(fetchImpl).not.toHaveBeenCalled();

    await gateway.disconnect();
    await expect(gateway.authorizationStatus()).resolves.toBe("disconnected");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed when live secure storage is unsupported", async () => {
    const gateway = new GoogleCalendarGateway({
      environment: LIVE_ENVIRONMENT,
      platform: "linux",
    });

    await expect(gateway.read(NOW)).resolves.toMatchObject({
      status: "storage_unavailable",
      authorization: "storage_unavailable",
      failure: { code: "storage_unavailable" },
    });
  });

  it("refreshes server-side and returns only minimized Calendar records", async () => {
    const credentials = new MemoryGoogleCalendarCredentialStore();
    await credentials.save({
      version: 1,
      refreshToken: "fake-refresh-token",
      grantedScopes: [
        "https://www.googleapis.com/auth/calendar.events.owned.readonly",
      ],
      connectedAt: NOW.toISOString(),
    });
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        return Response.json({
          access_token: "fake-access-token",
          expires_in: 3600,
          scope:
            "https://www.googleapis.com/auth/calendar.events.owned.readonly",
          token_type: "Bearer",
        });
      }
      if (
        url.startsWith(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events?",
        )
      ) {
        return Response.json({
          items: [
            {
              id: "provider-secret-id",
              summary: "Project Review",
              description: "must not cross the boundary",
              location: "private location",
              status: "confirmed",
              transparency: "opaque",
              start: { dateTime: "2026-07-19T17:00:00.000Z" },
              end: { dateTime: "2026-07-19T18:00:00.000Z" },
              updated: "2026-07-19T15:00:00.000Z",
            },
          ],
        });
      }
      throw new Error(`Unexpected test endpoint: ${url}`);
    });
    const gateway = new GoogleCalendarGateway({
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
    expect(serialized).not.toContain("provider-secret-id");
    expect(serialized).not.toContain("must not cross");
    expect(serialized).not.toContain("private location");
  });

  it("cannot restore a rotated credential after disconnect races a refresh", async () => {
    const credentials = new MemoryGoogleCalendarCredentialStore();
    await credentials.save({
      version: 1,
      refreshToken: "old-fake-refresh-token",
      grantedScopes: [
        "https://www.googleapis.com/auth/calendar.events.owned.readonly",
      ],
      connectedAt: NOW.toISOString(),
    });
    let resolveToken: ((response: Response) => void) | undefined;
    const tokenResponse = new Promise<Response>((resolve) => {
      resolveToken = resolve;
    });
    const fetchImpl = vi.fn<typeof fetch>((input) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") return tokenResponse;
      if (url === "https://oauth2.googleapis.com/revoke") {
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected test endpoint: ${url}`));
    });
    const gateway = new GoogleCalendarGateway({
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
        expires_in: 3600,
        scope: "https://www.googleapis.com/auth/calendar.events.owned.readonly",
        token_type: "Bearer",
      }),
    );

    await expect(read).resolves.toMatchObject({
      status: "reauthorization_required",
    });
    await expect(credentials.load()).resolves.toBeNull();
  });

  it("invalidates a rejected access token once and never serves cached events after invalid_grant", async () => {
    const credentials = new MemoryGoogleCalendarCredentialStore();
    await credentials.save({
      version: 1,
      refreshToken: "fake-refresh-token",
      grantedScopes: [
        "https://www.googleapis.com/auth/calendar.events.owned.readonly",
      ],
      connectedAt: NOW.toISOString(),
    });
    let tokenRequests = 0;
    let eventRequests = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        tokenRequests += 1;
        return tokenRequests === 1
          ? Response.json({
              access_token: "initial-access-token",
              expires_in: 86_400,
              scope:
                "https://www.googleapis.com/auth/calendar.events.owned.readonly",
              token_type: "Bearer",
            })
          : Response.json({ error: "invalid_grant" }, { status: 400 });
      }
      if (url.startsWith("https://www.googleapis.com/calendar/")) {
        eventRequests += 1;
        return eventRequests === 1
          ? Response.json({
              items: [
                {
                  id: "private-id",
                  summary: "Project Review",
                  status: "confirmed",
                  transparency: "opaque",
                  start: { dateTime: "2026-07-19T17:00:00.000Z" },
                  end: { dateTime: "2026-07-19T18:00:00.000Z" },
                  updated: "2026-07-19T15:00:00.000Z",
                },
              ],
            })
          : Response.json({}, { status: 401 });
      }
      throw new Error(`Unexpected test endpoint: ${url}`);
    });
    const gateway = new GoogleCalendarGateway({
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
    expect(eventRequests).toBe(2);
    await expect(credentials.load()).resolves.toBeNull();

    await expect(
      gateway.read(new Date(NOW.getTime() + 6 * 60 * 1_000)),
    ).resolves.toMatchObject({ status: "disconnected" });
    expect(tokenRequests).toBe(2);
    expect(eventRequests).toBe(2);
  });
});
