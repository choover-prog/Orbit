import { describe, expect, it } from "vitest";
import type { HomeContextPayload, SourceRecord } from "./connectors";
import { buildHomeContextArtifacts } from "./home-attention";

function record(celsius: number): SourceRecord<HomeContextPayload> {
  const at = "2026-07-19T12:00:00.000Z";
  return {
    id: "home.google-nest.batch",
    connectorId: "home.google-nest",
    schemaVersion: "1",
    externalReference: "sha256:fixture",
    provenance: { sourceLabel: "Google Nest (read only)" },
    observedAt: at,
    retrievedAt: at,
    staleAfter: "2026-07-19T12:05:00.000Z",
    payload: {
      structures: [{ id: "structure-1", displayName: "Home" }],
      rooms: [
        { id: "room-1", structureId: "structure-1", displayName: "Hall" },
      ],
      permissions: [
        {
          id: "home.structure.read",
          access: "read",
          granted: true,
          explanation: "Read selected home organization.",
        },
        {
          id: "home.device.read",
          access: "read",
          granted: true,
          explanation: "Read selected device traits.",
        },
      ],
      devices: [
        {
          id: "device-1",
          displayName: "Hall thermostat",
          category: "thermostat",
          structureId: "structure-1",
          roomId: "room-1",
          supported: true,
          capabilities: [],
          observations: [
            {
              kind: "connectivity",
              observedAt: at,
              value: { status: "online" },
            },
            { kind: "temperature", observedAt: at, value: { celsius } },
          ],
        },
      ],
    },
  };
}

describe("home attention", () => {
  it("creates one read-only concern for an extreme connected thermostat", () => {
    const result = buildHomeContextArtifacts(
      [record(6)],
      new Date("2026-07-19T12:01:00.000Z"),
      { complete: true, fresh: true },
    );
    expect(result.attention).toMatchObject({
      kind: "home_temperature_attention",
      actionability: "read_only",
    });
    expect(result.attention?.actionProposal).toBeUndefined();
  });

  it.each([
    [{ complete: false, fresh: true }],
    [{ complete: true, fresh: false }],
  ])("suppresses attention when the batch gate is %o", (gate) => {
    expect(
      buildHomeContextArtifacts(
        [record(6)],
        new Date("2026-07-19T12:01:00.000Z"),
        gate,
      ).attention,
    ).toBeUndefined();
  });

  it("stays quiet for a normal temperature", () => {
    expect(
      buildHomeContextArtifacts(
        [record(21)],
        new Date("2026-07-19T12:01:00.000Z"),
        { complete: true, fresh: true },
      ).attention,
    ).toBeUndefined();
  });
});
