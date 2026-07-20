import { describe, expect, it, vi } from "vitest";
import {
  BridgeReplayGuard,
  DEVICE_ATLAS_BRIDGE_LIMITS,
  validateBridgeMessage,
} from "./bridge-contract";
import { deviceAtlasFixtureObservations } from "./fixture";

function payload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    protocol: "orbit.device-atlas.v1",
    sessionId: "fixture-session",
    sequence: 1,
    capturedAt: "2026-07-19T14:30:00.000Z",
    observations: deviceAtlasFixtureObservations,
    ...overrides,
  });
}

describe("Device Atlas bridge contract", () => {
  it("verifies the exact received bytes", async () => {
    const raw = payload();
    const verify = vi.fn().mockResolvedValue(true);
    const result = await validateBridgeMessage(
      raw,
      "fixture-signature",
      new Date("2026-07-19T14:30:01.000Z"),
      new BridgeReplayGuard(),
      verify,
    );
    expect(result.ok).toBe(true);
    expect(verify).toHaveBeenCalledWith(
      raw,
      "fixture-signature",
      "fixture-session",
    );
  });

  it("rejects an invalid signature", async () => {
    const result = await validateBridgeMessage(
      payload(),
      "fixture-signature",
      new Date("2026-07-19T14:30:01.000Z"),
      new BridgeReplayGuard(),
      vi.fn().mockResolvedValue(false),
    );
    expect(result).toEqual({
      ok: false,
      reason: "Bridge signature is invalid",
    });
  });

  it("rejects replayed messages", async () => {
    const guard = new BridgeReplayGuard();
    const verify = vi.fn().mockResolvedValue(true);
    const now = new Date("2026-07-19T14:30:01.000Z");
    expect(
      (await validateBridgeMessage(payload(), "sig", now, guard, verify)).ok,
    ).toBe(true);
    expect(
      await validateBridgeMessage(payload(), "sig", now, guard, verify),
    ).toEqual({
      ok: false,
      reason: "Bridge message was replayed or out of order",
    });
  });

  it("rejects stale inventories", async () => {
    const result = await validateBridgeMessage(
      payload(),
      "fixture-signature",
      new Date("2026-07-19T15:00:00.000Z"),
      new BridgeReplayGuard(),
      vi.fn().mockResolvedValue(true),
    );
    expect(result).toEqual({
      ok: false,
      reason: "Inventory timestamp is outside the accepted window",
    });
  });

  it("rejects malformed, oversized, or network-identity payloads before verification", async () => {
    const verify = vi.fn().mockResolvedValue(true);
    const now = new Date("2026-07-19T14:30:01.000Z");
    const networkObservation = {
      ...deviceAtlasFixtureObservations[0],
      identity: [
        { kind: "network_endpoint", value: "192.0.2.1", strength: "weak" },
      ],
    };
    expect(
      await validateBridgeMessage(
        payload({ observations: [networkObservation] }),
        "sig",
        now,
        new BridgeReplayGuard(),
        verify,
      ),
    ).toEqual({ ok: false, reason: "Bridge payload is invalid" });
    expect(
      await validateBridgeMessage(
        "x".repeat(DEVICE_ATLAS_BRIDGE_LIMITS.maximumPayloadBytes + 1),
        "sig",
        now,
        new BridgeReplayGuard(),
        verify,
      ),
    ).toEqual({
      ok: false,
      reason: "Bridge payload exceeds the byte limit",
    });
    expect(verify).not.toHaveBeenCalled();
  });
});
