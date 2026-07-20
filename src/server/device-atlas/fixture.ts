import type { DeviceSourceObservation } from "@/domain/orbit/device-atlas";
import { buildDeviceAtlasSnapshot } from "./engine";

const observedAt = "2026-07-19T14:30:00.000Z";

export const deviceAtlasFixtureObservations: DeviceSourceObservation[] = [
  {
    id: "google_home_entry_lamp",
    source: "google_home",
    sourceLabel: "Google Home companion",
    displayName: "Entry lamp",
    category: "light",
    roomLabel: "Entry",
    observedAt,
    freshnessSeconds: 300,
    capabilities: [
      "observe.connectivity",
      "observe.power",
      "control.power",
      "control.brightness",
    ],
    identity: [
      {
        kind: "provider_link",
        value: "fictional:govee:entry-lamp-01",
        strength: "strong",
      },
      { kind: "display_name", value: "Entry lamp", strength: "weak" },
    ],
    consent: { granted: true, scope: "Selected home and devices" },
    transport: "hybrid",
    status: "online",
  },
  {
    id: "govee_entry_lamp",
    source: "govee",
    sourceLabel: "Govee",
    displayName: "Entry lamp",
    category: "light",
    roomLabel: "Entry",
    observedAt,
    freshnessSeconds: 120,
    capabilities: [
      "observe.connectivity",
      "observe.power",
      "control.power",
      "control.brightness",
      "control.color",
      "control.scene",
    ],
    identity: [
      {
        kind: "provider_link",
        value: "fictional:govee:entry-lamp-01",
        strength: "strong",
      },
    ],
    consent: { granted: true, scope: "Selected fictional Govee devices" },
    transport: "cloud",
    status: "online",
  },
  {
    id: "matter_coffee_plug",
    source: "matter",
    sourceLabel: "Selected Matter service",
    displayName: "Coffee plug",
    category: "outlet",
    roomLabel: "Kitchen",
    observedAt,
    freshnessSeconds: 30,
    capabilities: ["observe.connectivity", "observe.power", "control.power"],
    identity: [
      {
        kind: "matter_node",
        value: "fixture-fabric-1:node-22",
        strength: "strong",
      },
    ],
    consent: { granted: true, scope: "One selected local service" },
    transport: "local",
    status: "online",
  },
  {
    id: "mdns_speaker",
    source: "local_mdns",
    sourceLabel: "Local service picker",
    displayName: "Kitchen speaker",
    category: "speaker",
    roomLabel: "Kitchen",
    observedAt,
    freshnessSeconds: 60,
    capabilities: ["observe.connectivity"],
    identity: [
      {
        kind: "service_instance",
        value: "fictional-speaker._googlecast._tcp",
        strength: "weak",
      },
    ],
    consent: { granted: true, scope: "One selected service" },
    transport: "local",
    status: "online",
  },
  {
    id: "same_name_untrusted",
    source: "local_mdns",
    sourceLabel: "Local service picker",
    displayName: "Entry lamp",
    category: "unknown",
    observedAt,
    freshnessSeconds: 60,
    capabilities: ["observe.connectivity"],
    identity: [{ kind: "display_name", value: "Entry lamp", strength: "weak" }],
    consent: { granted: true, scope: "One selected service" },
    transport: "local",
    status: "unknown",
  },
];

export function getDeviceAtlasFixture() {
  return buildDeviceAtlasSnapshot(deviceAtlasFixtureObservations, observedAt);
}
