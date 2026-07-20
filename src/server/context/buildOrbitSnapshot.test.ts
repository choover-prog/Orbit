import { describe, expect, it, vi } from "vitest";
import { createConnectorRegistry } from "@/server/connectors/registry";
import { MemoryGoogleCalendarCredentialStore } from "@/server/connectors/google-calendar/credential-store";
import { MemoryGoogleNestCredentialStore } from "@/server/connectors/google-nest/credential-store";
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
        ORBIT_GOOGLE_CALENDAR_CLIENT_SECRET: "fake-publisher-secret",
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

  it("creates one read-only cross-source candidate only after both bounded reads", async () => {
    const registry = createConnectorRegistry({
      weatherMode: "fixture",
      calendarMode: "fixture",
      gmailMode: "fixture",
    });
    await registry.calendar.beginAuthorization(NOW);
    await registry.gmail.beginAuthorization(NOW);

    const snapshot = await buildOrbitSnapshot({
      now: NOW,
      contextPreference: "email",
      registry,
    });
    const selected = snapshot.attention.find(
      (bundle) => bundle.id === snapshot.selectedAttentionId,
    );

    expect(snapshot.email).toMatchObject({
      status: "fresh",
      authorization: "connected",
      mode: "fixture",
      complete: true,
      messageCount: 2,
    });
    expect(selected).toMatchObject({
      kind: "calendar_email_preparation",
      actionability: "read_only",
    });
    expect(selected?.recommendation).toBeUndefined();
    expect(selected?.actionProposal).toBeUndefined();
    expect(snapshot.sourceRecords).toHaveLength(6);
  });

  it("does not silently substitute another concern when email is requested but Gmail is disconnected", async () => {
    const registry = createConnectorRegistry({
      weatherMode: "fixture",
      calendarMode: "fixture",
      gmailMode: "fixture",
    });
    await registry.calendar.beginAuthorization(NOW);

    const snapshot = await buildOrbitSnapshot({
      now: NOW,
      contextPreference: "email",
      registry,
    });

    expect(snapshot.selectedAttentionId).toBeNull();
    expect(snapshot.email).toMatchObject({
      status: "disconnected",
      authorization: "disconnected",
      records: [],
    });
  });

  it("normalizes one bounded Nest home and selects only a read-only attention item", async () => {
    const registry = createConnectorRegistry({ nestMode: "fixture" });
    await registry.nest.beginAuthorization(NOW);

    const snapshot = await buildOrbitSnapshot({
      now: NOW,
      contextPreference: "home",
      registry,
    });
    const selected = snapshot.attention.find(
      (bundle) => bundle.id === snapshot.selectedAttentionId,
    );

    expect(snapshot.home).toMatchObject({
      status: "fresh",
      authorization: "connected",
      complete: true,
      structureCount: 1,
      supportedDeviceCount: 2,
      unsupportedDeviceCount: 1,
    });
    expect(selected).toMatchObject({
      kind: "home_temperature_attention",
      actionability: "read_only",
    });
    expect(selected?.actionProposal).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain("fixture/thermostat");
  });

  it("ordinary snapshot reads never invoke a connected Nest provider", async () => {
    const credentials = new MemoryGoogleNestCredentialStore();
    await credentials.save({
      version: 1,
      refreshToken: "fixture-test-token",
      grantedScopes: ["https://www.googleapis.com/auth/sdm.service"],
      connectedAt: NOW.toISOString(),
    });
    const nestFetchImpl = vi.fn<typeof fetch>();
    const registry = createConnectorRegistry({
      nestMode: "live",
      nestCredentialStore: credentials,
      nestFetchImpl,
      nestEnvironment: {
        ORBIT_GOOGLE_NEST_MODE: "live",
        ORBIT_GOOGLE_NEST_CLIENT_ID: "fake-client.apps.googleusercontent.com",
        ORBIT_GOOGLE_NEST_CLIENT_SECRET: "fake-publisher-secret",
        ORBIT_GOOGLE_NEST_PROJECT_ID: "fake-device-access-project",
        ORBIT_GOOGLE_NEST_REDIRECT_URI: "http://127.0.0.1:3000",
      },
    });

    const snapshot = await buildOrbitSnapshot({ now: NOW, registry });

    expect(nestFetchImpl).not.toHaveBeenCalled();
    expect(snapshot.home).toMatchObject({
      status: "connected",
      authorization: "connected",
      records: [],
    });
  });

  it("stays quiet when home context is requested but Nest is disconnected", async () => {
    const snapshot = await buildOrbitSnapshot({
      now: NOW,
      contextPreference: "home",
      registry: createConnectorRegistry({ nestMode: "fixture" }),
    });

    expect(snapshot.selectedAttentionId).toBeNull();
    expect(snapshot.home).toMatchObject({
      status: "disconnected",
      authorization: "disconnected",
      records: [],
    });
  });
});
