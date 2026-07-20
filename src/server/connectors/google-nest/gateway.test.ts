import { describe, expect, it } from "vitest";
import { GoogleNestGateway } from "./gateway";

describe("GoogleNestGateway fixture", () => {
  it("connects, plans, approves, verifies, audits, streams, and disconnects", async () => {
    const gateway = new GoogleNestGateway({ mode: "fixture" });
    const connected = await gateway.beginAuthorization(
      new Date("2026-07-19T12:00:00Z"),
    );
    expect(connected.kind).toBe("fixture");
    const plan = gateway.createPlan(
      {
        deviceId: "nest-device-thermostat",
        capability: "thermostat.set_mode",
        parameters: { mode: "cool" },
      },
      new Date("2026-07-19T12:01:00Z"),
    );
    expect(plan.summary).toContain("cool");
    const result = await gateway.approvePlan(
      plan.id,
      plan.planHash,
      new Date("2026-07-19T12:01:10Z"),
    );
    expect(result.state).toBe("verified");
    expect(result.undoPlan).toMatchObject({
      capability: "thermostat.set_mode",
      reversible: true,
    });
    expect(
      (
        await gateway.peek(new Date("2026-07-19T12:01:20Z"))
      ).batch?.records[0].payload.devices
        .find((device) => device.id === "nest-device-thermostat")
        ?.observations.find((item) => item.kind === "thermostat_mode")?.value,
    ).toEqual({ mode: "cool" });
    const undone = await gateway.approvePlan(
      result.undoPlan!.id,
      result.undoPlan!.planHash,
      new Date("2026-07-19T12:01:30Z"),
    );
    expect(undone.state).toBe("verified");
    await expect(gateway.approvePlan(plan.id, plan.planHash)).rejects.toThrow(
      /invalid|expired|used/i,
    );
    expect(
      (await gateway.peek(new Date("2026-07-19T12:01:20Z"))).audit.map(
        (item) => item.kind,
      ),
    ).toEqual(
      expect.arrayContaining([
        "plan_created",
        "approved",
        "executed",
        "verified",
      ]),
    );
    const offer = `v=0\r\n${"x".repeat(210)}\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=recvonly\r\nm=video 9 UDP/TLS/RTP/SAVPF 102\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n`;
    const stream = await gateway.startStream(
      "nest-device-camera",
      offer,
      new Date("2026-07-19T12:02:00Z"),
    );
    expect(stream.fixture).toBe(true);
    await gateway.stopStream(stream.sessionId);
    await gateway.disconnect();
    expect(await gateway.authorizationStatus()).toBe("disconnected");
  });

  it("rejects stale hashes and unapproved direct execution", async () => {
    const gateway = new GoogleNestGateway({ mode: "fixture" });
    await gateway.beginAuthorization(new Date());
    const plan = gateway.createPlan({
      deviceId: "nest-device-thermostat",
      capability: "thermostat.set_mode",
      parameters: { mode: "off" },
    });
    await expect(gateway.approvePlan(plan.id, "0".repeat(64))).rejects.toThrow(
      /invalid|expired|used/i,
    );
  });

  it("rejects unsafe temperatures, unknown devices, and malformed camera offers", async () => {
    const gateway = new GoogleNestGateway({ mode: "fixture" });
    await gateway.beginAuthorization(new Date());

    expect(() =>
      gateway.createPlan({
        deviceId: "nest-device-thermostat",
        capability: "thermostat.set_temperature",
        parameters: { heatCelsius: 40 },
      }),
    ).toThrow(/safe thermostat range/i);
    expect(() =>
      gateway.createPlan({
        deviceId: "unknown-device",
        capability: "thermostat.set_mode",
        parameters: { mode: "off" },
      }),
    ).toThrow(/does not expose/i);
    await expect(
      gateway.startStream("nest-device-camera", "v=0\r\n"),
    ).rejects.toThrow(/offer is invalid/i);
    await expect(
      gateway.startStream(
        "nest-device-camera",
        `v=0\r\n${"x".repeat(210)}\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv\r\nm=video 9 UDP/TLS/RTP/SAVPF 102\r\na=recvonly\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n`,
      ),
    ).rejects.toThrow(/receive-only/i);
    await expect(
      gateway.startStream(
        "nest-device-thermostat",
        `v=0\r\n${"x".repeat(210)}\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=recvonly\r\nm=video 9 UDP/TLS/RTP/SAVPF 102\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n`,
      ),
    ).rejects.toThrow(/does not offer/i);
  });
});
