import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createBridgeSignatureInput,
  DeviceAtlasBridgeSessionRegistry,
} from "./bridge-session";

function fixture() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  const fingerprint = createHash("sha256")
    .update(publicKeyDer)
    .digest("base64url");
  return {
    privateKey,
    descriptor: {
      protocol: "orbit.device-atlas.v1" as const,
      sessionId: "test-device-session-1234567890",
      publicKeyDerBase64Url: publicKeyDer.toString("base64url"),
      publicKeySha256: fingerprint,
    },
    fingerprint,
  };
}

describe("DeviceAtlasBridgeSessionRegistry", () => {
  it("pairs only a confirmed P-256 key and verifies exact payload bytes", async () => {
    const entry = fixture();
    const registry = new DeviceAtlasBridgeSessionRegistry();
    registry.pair(entry.descriptor, entry.fingerprint);
    const payload = Buffer.from('{"protocol":"orbit.device-atlas.v1"}');
    const signature = sign(
      "sha256",
      createBridgeSignatureInput(payload, entry.descriptor.sessionId),
      entry.privateKey,
    ).toString("base64url");

    await expect(
      registry.verify(payload, signature, entry.descriptor.sessionId),
    ).resolves.toBe(true);
    await expect(
      registry.verify(
        Buffer.concat([payload, Buffer.from(" ")]),
        signature,
        entry.descriptor.sessionId,
      ),
    ).resolves.toBe(false);
  });

  it("rejects a captured signature replayed through another paired session", async () => {
    const entry = fixture();
    const registry = new DeviceAtlasBridgeSessionRegistry();
    registry.pair(entry.descriptor, entry.fingerprint);
    const secondSessionId = "second-device-session-123456789";
    registry.pair(
      { ...entry.descriptor, sessionId: secondSessionId },
      entry.fingerprint,
    );
    const payload = Buffer.from('{"sequence":0}');
    const signature = sign(
      "sha256",
      createBridgeSignatureInput(payload, entry.descriptor.sessionId),
      entry.privateKey,
    ).toString("base64url");

    await expect(
      registry.verify(payload, signature, entry.descriptor.sessionId),
    ).resolves.toBe(true);
    await expect(
      registry.verify(payload, signature, secondSessionId),
    ).resolves.toBe(false);
  });

  it("rejects an unconfirmed fingerprint", () => {
    const entry = fixture();
    expect(() =>
      registry().pair(entry.descriptor, "wrong-fingerprint"),
    ).toThrow(/fingerprint was not confirmed/u);
  });

  it("expires and removes sessions", async () => {
    let now = 1000;
    const entry = fixture();
    const registry = new DeviceAtlasBridgeSessionRegistry(() => now, 100);
    registry.pair(entry.descriptor, entry.fingerprint);
    expect(registry.fingerprint(entry.descriptor.sessionId)).toBe(
      entry.fingerprint,
    );

    now = 1100;
    expect(registry.has(entry.descriptor.sessionId)).toBe(false);
    await expect(
      registry.verify(new Uint8Array([1]), "AA", entry.descriptor.sessionId),
    ).resolves.toBe(false);
  });

  it("disconnect removes the verifier immediately", () => {
    const entry = fixture();
    const registry = new DeviceAtlasBridgeSessionRegistry();
    registry.pair(entry.descriptor, entry.fingerprint);
    expect(registry.remove(entry.descriptor.sessionId)).toBe(true);
    expect(registry.has(entry.descriptor.sessionId)).toBe(false);
  });
});

function registry() {
  return new DeviceAtlasBridgeSessionRegistry();
}
