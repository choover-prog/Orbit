import {
  createHash,
  createPublicKey,
  timingSafeEqual,
  verify as verifySignature,
  type KeyObject,
} from "node:crypto";

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{24,128}$/u;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const MAXIMUM_PUBLIC_KEY_BYTES = 256;
const MAXIMUM_SIGNATURE_BYTES = 144;
const DEFAULT_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const SIGNATURE_DOMAIN = Buffer.from(
  "orbit.device-atlas.signature.v1\0",
  "ascii",
);

export interface DeviceAtlasPairingDescriptor {
  protocol: "orbit.device-atlas.v1";
  sessionId: string;
  publicKeyDerBase64Url: string;
  publicKeySha256: string;
}

interface BridgeSession {
  publicKey: KeyObject;
  fingerprint: string;
  expiresAt: number;
}

function decodeBase64Url(value: string, maximumBytes: number): Buffer {
  if (!BASE64URL_PATTERN.test(value))
    throw new Error("Invalid base64url value");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length === 0 || decoded.length > maximumBytes)
    throw new Error("Decoded value is outside the accepted size");
  if (decoded.toString("base64url") !== value)
    throw new Error("Non-canonical base64url value");
  return decoded;
}

function equalText(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export function createBridgeSignatureInput(
  payload: Uint8Array,
  authenticatedSessionId: string,
): Buffer {
  if (!SESSION_ID_PATTERN.test(authenticatedSessionId))
    throw new Error("Invalid bridge session id");
  return Buffer.concat([
    SIGNATURE_DOMAIN,
    Buffer.from(authenticatedSessionId, "ascii"),
    Buffer.from([0]),
    Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength),
  ]);
}

export class DeviceAtlasBridgeSessionRegistry {
  private readonly sessions = new Map<string, BridgeSession>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly lifetimeMs: number = DEFAULT_SESSION_LIFETIME_MS,
  ) {
    if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs <= 0)
      throw new Error("Bridge session lifetime must be positive");
  }

  pair(
    descriptor: DeviceAtlasPairingDescriptor,
    confirmedFingerprint: string,
  ): void {
    if (
      descriptor.protocol !== "orbit.device-atlas.v1" ||
      !SESSION_ID_PATTERN.test(descriptor.sessionId)
    )
      throw new Error("Invalid bridge pairing descriptor");
    const publicKeyDer = decodeBase64Url(
      descriptor.publicKeyDerBase64Url,
      MAXIMUM_PUBLIC_KEY_BYTES,
    );
    const calculatedFingerprint = createHash("sha256")
      .update(publicKeyDer)
      .digest("base64url");
    if (
      !equalText(calculatedFingerprint, descriptor.publicKeySha256) ||
      !equalText(calculatedFingerprint, confirmedFingerprint)
    )
      throw new Error("Bridge public-key fingerprint was not confirmed");

    const publicKey = createPublicKey({
      key: publicKeyDer,
      format: "der",
      type: "spki",
    });
    if (
      publicKey.asymmetricKeyType !== "ec" ||
      publicKey.asymmetricKeyDetails?.namedCurve !== "prime256v1"
    )
      throw new Error("Bridge key must be P-256");

    this.sessions.set(descriptor.sessionId, {
      publicKey,
      fingerprint: calculatedFingerprint,
      expiresAt: this.now() + this.lifetimeMs,
    });
  }

  remove(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  has(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.expiresAt <= this.now()) {
      this.sessions.delete(sessionId);
      return false;
    }
    return true;
  }

  fingerprint(sessionId: string): string | undefined {
    return this.has(sessionId)
      ? this.sessions.get(sessionId)?.fingerprint
      : undefined;
  }

  verify = async (
    payload: Uint8Array,
    signatureBase64Url: string,
    authenticatedSessionId: string,
  ): Promise<boolean> => {
    if (!this.has(authenticatedSessionId)) return false;
    let signature: Buffer;
    try {
      signature = decodeBase64Url(signatureBase64Url, MAXIMUM_SIGNATURE_BYTES);
    } catch {
      return false;
    }
    const session = this.sessions.get(authenticatedSessionId);
    if (!session) return false;
    return verifySignature(
      "sha256",
      createBridgeSignatureInput(payload, authenticatedSessionId),
      session.publicKey,
      signature,
    );
  };
}
