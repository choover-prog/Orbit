import { describe, expect, it, vi } from "vitest";
import { createConnectorRegistry } from "@/server/connectors/registry";
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
});
