import { describe, expect, it, vi } from "vitest";
import { createConnectorRegistry } from "@/server/connectors/registry";
import { MemoryGoogleCalendarCredentialStore } from "@/server/connectors/google-calendar/credential-store";
import { buildOrbitSnapshot } from "./buildOrbitSnapshot";

const NOW = new Date("2026-07-18T16:00:00.000Z");

describe("buildOrbitSnapshot", () => {
  it("keeps travel primary by default and adds fixture weather without network access", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const snapshot = await buildOrbitSnapshot({
      now: NOW,
      registry: createConnectorRegistry({
        weatherMode: "fixture",
        fetchImpl,
      }),
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(snapshot.selectedAttentionId).toBe("bundle_travel_conflict");
    expect(snapshot.attention.map((bundle) => bundle.kind)).toEqual([
      "travel_conflict",
      "weather",
    ]);
    expect(snapshot.weather.status).toBe("fresh");
    expect(snapshot.weather.mode).toBe("fixture");
  });

  it("selects fresh weather explicitly without making it actionable", async () => {
    const snapshot = await buildOrbitSnapshot({
      now: NOW,
      contextPreference: "weather",
      registry: createConnectorRegistry({ weatherMode: "fixture" }),
    });
    const selected = snapshot.attention.find(
      (bundle) => bundle.id === snapshot.selectedAttentionId,
    );

    expect(selected).toMatchObject({
      kind: "weather",
      actionability: "read_only",
    });
    expect(selected?.actionProposal).toBeUndefined();
  });

  it("does not silently substitute travel when requested weather is unavailable", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("unavailable", { status: 503 }));
    const snapshot = await buildOrbitSnapshot({
      now: NOW,
      contextPreference: "weather",
      registry: createConnectorRegistry({
        weatherMode: "live",
        fetchImpl,
      }),
    });

    expect(snapshot.selectedAttentionId).toBeNull();
    expect(snapshot.weather.status).toBe("unavailable");
    expect(
      snapshot.connections.find(({ id }) => id === "connection_weather"),
    ).toMatchObject({
      mode: "live",
      health: "unavailable",
    });
  });

  it("fails closed for invalid connector configuration", async () => {
    const snapshot = await buildOrbitSnapshot({
      now: NOW,
      contextPreference: "weather",
      registry: createConnectorRegistry({ weatherMode: "automatic" }),
    });

    expect(snapshot.selectedAttentionId).toBeNull();
    expect(snapshot.weather.status).toBe("misconfigured");
  });

  it("selects one fresh Calendar overlap without exposing an action", async () => {
    const registry = createConnectorRegistry({
      weatherMode: "fixture",
      calendarMode: "fixture",
    });
    await registry.calendar.beginAuthorization(NOW);

    const snapshot = await buildOrbitSnapshot({
      now: NOW,
      contextPreference: "calendar",
      registry,
    });
    const selected = snapshot.attention.find(
      (bundle) => bundle.id === snapshot.selectedAttentionId,
    );

    expect(snapshot.calendar).toMatchObject({
      status: "fresh",
      authorization: "connected",
      mode: "fixture",
      complete: true,
      eventCount: 3,
    });
    expect(selected).toMatchObject({
      kind: "calendar_conflict",
      actionability: "read_only",
    });
    expect(selected?.actionProposal).toBeUndefined();
    expect(
      snapshot.connections.find(
        ({ id }) => id === "connection_google_calendar",
      ),
    ).toMatchObject({ health: "connected", mode: "fixture" });
    expect(
      snapshot.connections.find(({ id }) => id === "connection_demo_calendar"),
    ).toMatchObject({ displayName: "Demo calendar", mode: "fixture" });
  });

  it("ordinary snapshot reads never invoke a connected Calendar provider", async () => {
    const credentials = new MemoryGoogleCalendarCredentialStore();
    await credentials.save({
      version: 1,
      refreshToken: "fixture-test-token",
      grantedScopes: [
        "https://www.googleapis.com/auth/calendar.events.owned.readonly",
      ],
      connectedAt: NOW.toISOString(),
    });
    const calendarFetchImpl = vi.fn<typeof fetch>();
    const registry = createConnectorRegistry({
      weatherMode: "fixture",
      calendarMode: "live",
      calendarCredentialStore: credentials,
      calendarFetchImpl,
      calendarEnvironment: {
        ORBIT_GOOGLE_CALENDAR_MODE: "live",
        ORBIT_GOOGLE_CALENDAR_CLIENT_ID:
          "fake-client.apps.googleusercontent.com",
        ORBIT_GOOGLE_CALENDAR_REDIRECT_URI: "http://127.0.0.1:3000",
      },
    });

    const snapshot = await buildOrbitSnapshot({ now: NOW, registry });

    expect(calendarFetchImpl).not.toHaveBeenCalled();
    expect(snapshot.calendar).toMatchObject({
      status: "connected",
      authorization: "connected",
      records: [],
    });
  });

  it("stays quiet when Calendar is explicitly requested but disconnected", async () => {
    const snapshot = await buildOrbitSnapshot({
      now: NOW,
      contextPreference: "calendar",
      registry: createConnectorRegistry({
        weatherMode: "fixture",
        calendarMode: "fixture",
      }),
    });

    expect(snapshot.selectedAttentionId).toBeNull();
    expect(snapshot.calendar).toMatchObject({
      status: "disconnected",
      authorization: "disconnected",
      records: [],
    });
  });
});
