import { describe, expect, it, vi } from "vitest";
import {
  BridgeReplayGuard,
  DEVICE_ATLAS_BRIDGE_LIMITS,
  validateBridgeMessage,
} from "./bridge-contract";
import { deviceAtlasFixtureObservations } from "./fixture";

const encoder = new TextEncoder();

function payload(overrides: Record<string, unknown> = {}): Uint8Array {
  return encoder.encode(
    JSON.stringify({
      protocol: "orbit.device-atlas.v1",
      sequence: 1,
      capturedAt: "2026-07-19T14:30:00.000Z",
      observations: deviceAtlasFixtureObservations,
      ...overrides,
    }),
  );
}

async function validate(
  raw: Uint8Array,
  guard = new BridgeReplayGuard(),
  verify = vi.fn().mockResolvedValue(true),
) {
  return validateBridgeMessage(
    raw,
    "fixture-signature",
    "fixture-session",
    new Date("2026-07-19T14:30:01.000Z"),
    guard,
    verify,
  );
}

describe("Device Atlas bridge contract", () => {
  it("verifies the exact received bytes before strict decoding", async () => {
    const raw = payload();
    const verify = vi.fn().mockResolvedValue(true);
    expect((await validate(raw, new BridgeReplayGuard(), verify)).ok).toBe(
      true,
    );
    expect(verify).toHaveBeenCalledWith(
      raw,
      "fixture-signature",
      "fixture-session",
    );
    const invalidUtf8 = new Uint8Array([0xc3, 0x28]);
    const invalidVerify = vi.fn().mockResolvedValue(true);
    expect(
      await validate(invalidUtf8, new BridgeReplayGuard(), invalidVerify),
    ).toEqual({ ok: false, reason: "Bridge payload is invalid" });
    expect(invalidVerify).toHaveBeenCalledWith(
      invalidUtf8,
      "fixture-signature",
      "fixture-session",
    );
  });

  it("rejects an invalid signature before parsing", async () => {
    const result = await validateBridgeMessage(
      new Uint8Array([0xc3, 0x28]),
      "fixture-signature",
      "fixture-session",
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
    expect((await validate(payload(), guard)).ok).toBe(true);
    expect(await validate(payload(), guard)).toEqual({
      ok: false,
      reason: "Bridge message was replayed or out of order",
    });
  });

  it("rejects stale inventories", async () => {
    const result = await validateBridgeMessage(
      payload(),
      "fixture-signature",
      "fixture-session",
      new Date("2026-07-19T15:00:00.000Z"),
      new BridgeReplayGuard(),
      vi.fn().mockResolvedValue(true),
    );
    expect(result).toEqual({
      ok: false,
      reason: "Inventory timestamp is outside the accepted window",
    });
  });

  it("rejects undeclared fields and network identities", async () => {
    const observation = {
      ...deviceAtlasFixtureObservations[0],
      network_endpoint: "192.0.2.1",
    };
    expect(await validate(payload({ observations: [observation] }))).toEqual({
      ok: false,
      reason: "Bridge payload is invalid",
    });
    const identity = {
      ...deviceAtlasFixtureObservations[0].identity[0],
      network_endpoint: "192.0.2.1",
    };
    expect(
      await validate(
        payload({
          observations: [
            { ...deviceAtlasFixtureObservations[0], identity: [identity] },
          ],
        }),
      ),
    ).toEqual({ ok: false, reason: "Bridge payload is invalid" });
  });

  it("rejects oversized payloads before signature verification", async () => {
    const verify = vi.fn().mockResolvedValue(true);
    expect(
      await validate(
        new Uint8Array(DEVICE_ATLAS_BRIDGE_LIMITS.maximumPayloadBytes + 1),
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
