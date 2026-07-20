import { describe, expect, it, vi } from "vitest";
import { BridgeReplayGuard, validateBridgeEnvelope } from "./bridge-contract";

function envelope() {
  return {
    protocol: "orbit.device-atlas.v1" as const,
    sessionId: "fixture-session",
    sequence: 1,
    capturedAt: "2026-07-19T14:30:00.000Z",
    observations: [],
    signature: "fixture-signature",
  };
}

describe("Device Atlas bridge contract", () => {
  it("rejects an invalid signature", async () => {
    const result = await validateBridgeEnvelope(
      envelope(),
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
      await validateBridgeEnvelope(envelope(), now, guard, verify),
    ).toEqual({ ok: true });
    expect(
      await validateBridgeEnvelope(envelope(), now, guard, verify),
    ).toEqual({
      ok: false,
      reason: "Bridge message was replayed or out of order",
    });
  });

  it("rejects stale inventories", async () => {
    const result = await validateBridgeEnvelope(
      envelope(),
      new Date("2026-07-19T15:00:00.000Z"),
      new BridgeReplayGuard(),
      vi.fn().mockResolvedValue(true),
    );
    expect(result).toEqual({
      ok: false,
      reason: "Inventory timestamp is outside the accepted window",
    });
  });
});
