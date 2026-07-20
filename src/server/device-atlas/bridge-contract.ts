import type { DeviceSourceObservation } from "@/domain/orbit/device-atlas";

export const DEVICE_ATLAS_BRIDGE_LIMITS = {
  maximumObservations: 250,
  maximumClockSkewMs: 5 * 60 * 1000,
} as const;

export interface DeviceAtlasBridgeEnvelope {
  protocol: "orbit.device-atlas.v1";
  sessionId: string;
  sequence: number;
  capturedAt: string;
  observations: DeviceSourceObservation[];
  signature: string;
}

export type BridgeSignatureVerifier = (
  canonicalPayload: string,
  signature: string,
  sessionId: string,
) => Promise<boolean>;

export class BridgeReplayGuard {
  private readonly sequences = new Map<string, number>();

  accept(sessionId: string, sequence: number): boolean {
    const last = this.sequences.get(sessionId) ?? -1;
    if (!Number.isSafeInteger(sequence) || sequence <= last) return false;
    this.sequences.set(sessionId, sequence);
    return true;
  }
}

function canonicalPayload(envelope: DeviceAtlasBridgeEnvelope): string {
  return JSON.stringify({
    protocol: envelope.protocol,
    sessionId: envelope.sessionId,
    sequence: envelope.sequence,
    capturedAt: envelope.capturedAt,
    observations: envelope.observations,
  });
}

export async function validateBridgeEnvelope(
  envelope: DeviceAtlasBridgeEnvelope,
  now: Date,
  replayGuard: BridgeReplayGuard,
  verify: BridgeSignatureVerifier,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (envelope.protocol !== "orbit.device-atlas.v1")
    return { ok: false, reason: "Unsupported bridge protocol" };
  if (!envelope.sessionId || envelope.sessionId.length > 128)
    return { ok: false, reason: "Invalid bridge session" };
  if (
    envelope.observations.length >
    DEVICE_ATLAS_BRIDGE_LIMITS.maximumObservations
  )
    return { ok: false, reason: "Inventory exceeds the bounded record limit" };
  const capturedAt = Date.parse(envelope.capturedAt);
  if (
    !Number.isFinite(capturedAt) ||
    Math.abs(now.getTime() - capturedAt) >
      DEVICE_ATLAS_BRIDGE_LIMITS.maximumClockSkewMs
  ) {
    return {
      ok: false,
      reason: "Inventory timestamp is outside the accepted window",
    };
  }
  if (
    !(await verify(
      canonicalPayload(envelope),
      envelope.signature,
      envelope.sessionId,
    ))
  )
    return { ok: false, reason: "Bridge signature is invalid" };
  if (!replayGuard.accept(envelope.sessionId, envelope.sequence))
    return { ok: false, reason: "Bridge message was replayed or out of order" };
  return { ok: true };
}
