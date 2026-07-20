import type { DeviceSourceObservation } from "@/domain/orbit/device-atlas";

export const DEVICE_ATLAS_BRIDGE_LIMITS = {
  maximumPayloadBytes: 256 * 1024,
  maximumObservations: 250,
  maximumClockSkewMs: 5 * 60 * 1000,
  maximumIdentityItems: 8,
  maximumCapabilities: 32,
  maximumTextCharacters: 256,
} as const;

export interface DeviceAtlasBridgePayload {
  protocol: "orbit.device-atlas.v1";
  sessionId: string;
  sequence: number;
  capturedAt: string;
  observations: DeviceSourceObservation[];
}

export type BridgeSignatureVerifier = (
  receivedPayload: string,
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

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, allowEmpty = false): value is string {
  return (
    typeof value === "string" &&
    (allowEmpty || value.length > 0) &&
    value.length <= DEVICE_ATLAS_BRIDGE_LIMITS.maximumTextCharacters &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

function stringMember(value: unknown, members: readonly string[]): boolean {
  return typeof value === "string" && members.includes(value);
}

function boundedStringArray(
  value: unknown,
  members: readonly string[],
  maximum: number,
): boolean {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every((item) => stringMember(item, members))
  );
}

function validIdentity(value: unknown): boolean {
  if (!record(value) || !boundedText(value.value)) return false;
  if (value.strength === "strong")
    return stringMember(value.kind, [
      "provider_link",
      "matter_node",
      "manufacturer_serial",
      "user_confirmed",
    ]);
  if (value.strength === "weak")
    return stringMember(value.kind, ["display_name", "service_instance"]);
  return false;
}

function validObservation(value: unknown): value is DeviceSourceObservation {
  if (!record(value)) return false;
  if (
    !boundedText(value.id) ||
    !stringMember(value.source, [
      "google_home",
      "govee",
      "matter",
      "local_mdns",
      "google_nest",
    ]) ||
    !boundedText(value.sourceLabel) ||
    !boundedText(value.displayName) ||
    !boundedText(value.category) ||
    (value.roomLabel !== undefined && !boundedText(value.roomLabel)) ||
    !boundedText(value.observedAt) ||
    !Number.isFinite(Date.parse(value.observedAt)) ||
    !Number.isInteger(value.freshnessSeconds) ||
    (value.freshnessSeconds as number) < 0 ||
    (value.freshnessSeconds as number) > 86_400
  )
    return false;
  if (
    !boundedStringArray(
      value.capabilities,
      [
        "observe.connectivity",
        "observe.power",
        "observe.temperature",
        "control.power",
        "control.brightness",
        "control.color",
        "control.scene",
        "stream.video",
      ],
      DEVICE_ATLAS_BRIDGE_LIMITS.maximumCapabilities,
    ) ||
    !Array.isArray(value.identity) ||
    value.identity.length > DEVICE_ATLAS_BRIDGE_LIMITS.maximumIdentityItems ||
    !value.identity.every(validIdentity) ||
    !record(value.consent) ||
    typeof value.consent.granted !== "boolean" ||
    !boundedText(value.consent.scope) ||
    !stringMember(value.transport, ["local", "cloud", "hybrid"]) ||
    !stringMember(value.status, ["online", "offline", "unknown"]) ||
    !boundedStringArray(
      value.monitoringModes,
      ["event_subscription", "bounded_poll", "manual_refresh"],
      3,
    )
  )
    return false;
  return true;
}

function parsePayload(
  rawPayload: string,
): DeviceAtlasBridgePayload | undefined {
  let value: unknown;
  try {
    value = JSON.parse(rawPayload);
  } catch {
    return undefined;
  }
  if (
    !record(value) ||
    value.protocol !== "orbit.device-atlas.v1" ||
    !boundedText(value.sessionId) ||
    !Number.isSafeInteger(value.sequence) ||
    (value.sequence as number) < 0 ||
    !boundedText(value.capturedAt) ||
    !Array.isArray(value.observations) ||
    value.observations.length >
      DEVICE_ATLAS_BRIDGE_LIMITS.maximumObservations ||
    !value.observations.every(validObservation)
  )
    return undefined;
  return value as unknown as DeviceAtlasBridgePayload;
}

export async function validateBridgeMessage(
  rawPayload: string,
  signature: string,
  now: Date,
  replayGuard: BridgeReplayGuard,
  verify: BridgeSignatureVerifier,
): Promise<
  | { ok: true; payload: DeviceAtlasBridgePayload }
  | { ok: false; reason: string }
> {
  if (
    typeof rawPayload !== "string" ||
    new TextEncoder().encode(rawPayload).byteLength >
      DEVICE_ATLAS_BRIDGE_LIMITS.maximumPayloadBytes
  )
    return { ok: false, reason: "Bridge payload exceeds the byte limit" };
  if (!boundedText(signature) || signature.length > 512)
    return { ok: false, reason: "Bridge signature is invalid" };
  const payload = parsePayload(rawPayload);
  if (!payload) return { ok: false, reason: "Bridge payload is invalid" };
  const capturedAt = Date.parse(payload.capturedAt);
  if (
    !Number.isFinite(capturedAt) ||
    Math.abs(now.getTime() - capturedAt) >
      DEVICE_ATLAS_BRIDGE_LIMITS.maximumClockSkewMs
  )
    return {
      ok: false,
      reason: "Inventory timestamp is outside the accepted window",
    };
  if (!(await verify(rawPayload, signature, payload.sessionId)))
    return { ok: false, reason: "Bridge signature is invalid" };
  if (!replayGuard.accept(payload.sessionId, payload.sequence))
    return { ok: false, reason: "Bridge message was replayed or out of order" };
  return { ok: true, payload };
}
