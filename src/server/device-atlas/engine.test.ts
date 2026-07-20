import { describe, expect, it } from "vitest";
import { deviceAtlasFixtureObservations } from "./fixture";
import {
  buildDeviceAtlasSnapshot,
  reconcileDevices,
  scoreControlPath,
} from "./engine";

describe("Device Atlas", () => {
  it("merges only observations with strong identity evidence", () => {
    const devices = reconcileDevices(deviceAtlasFixtureObservations);
    expect(devices).toHaveLength(4);
    expect(devices[0].sources).toEqual(["google_home", "govee"]);
    expect(
      devices.filter((device) => device.displayName === "Entry lamp"),
    ).toHaveLength(2);
  });

  it("prefers an available, consented, verifiable local control path", () => {
    const path = scoreControlPath({
      id: "path",
      source: "matter",
      label: "Matter",
      capabilities: ["control.power"],
      transport: "local",
      consentGranted: true,
      canVerify: true,
      reversible: true,
      eventDriven: true,
      available: true,
    });
    expect(path.score).toBe(100);
    expect(path.reasons).toContain("Explicit permission is present");
  });

  it("never executes an automation while building a snapshot", () => {
    const snapshot = buildDeviceAtlasSnapshot(
      deviceAtlasFixtureObservations,
      "2026-07-19T14:30:00.000Z",
    );
    expect(snapshot.automationDrafts[0]).toMatchObject({
      state: "simulated",
      requiredApproval: true,
    });
    expect(snapshot.automationDrafts[0].simulation.sideEffects).toContain(
      "No device command was sent",
    );
    expect(snapshot.privacy).toEqual({
      localDiscovery: "selected_services",
      retainedNetworkIdentifiers: false,
      credentialGuessing: false,
      autonomousControl: false,
    });
  });

  it("uses events where available and bounded refresh otherwise", () => {
    const devices = reconcileDevices(deviceAtlasFixtureObservations);
    expect(
      devices.find((device) => device.category === "light")?.monitoring
        .strategy,
    ).toBe("event_subscription");
    expect(
      devices.find((device) => device.category === "speaker")?.monitoring,
    ).toMatchObject({
      strategy: "bounded_poll",
      intervalSeconds: 900,
    });
  });

  it("breaks equal scores in favor of broader capability coverage", () => {
    const light = reconcileDevices(deviceAtlasFixtureObservations).find(
      (device) => device.category === "light",
    );
    expect(light?.preferredPath?.source).toBe("govee");
    expect(light?.preferredPath?.capabilities).toContain("control.scene");
  });
});
