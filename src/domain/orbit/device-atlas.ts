import type { IsoDateTime } from "./types";

export type DeviceAtlasSourceKind =
  "google_home" | "govee" | "matter" | "local_mdns" | "google_nest";

export type DeviceAtlasCapability =
  | "observe.connectivity"
  | "observe.power"
  | "observe.temperature"
  | "control.power"
  | "control.brightness"
  | "control.color"
  | "control.scene"
  | "stream.video";

export type DeviceIdentityEvidence =
  | {
      kind: "provider_link" | "matter_node" | "manufacturer_serial";
      value: string;
      strength: "strong";
    }
  | {
      kind: "user_confirmed";
      value: string;
      strength: "strong";
    }
  | {
      kind: "display_name" | "network_endpoint" | "service_instance";
      value: string;
      strength: "weak";
    };

export interface DeviceSourceObservation {
  id: string;
  source: DeviceAtlasSourceKind;
  sourceLabel: string;
  displayName: string;
  category: string;
  roomLabel?: string;
  observedAt: IsoDateTime;
  freshnessSeconds: number;
  capabilities: DeviceAtlasCapability[];
  identity: DeviceIdentityEvidence[];
  consent: {
    granted: boolean;
    scope: string;
  };
  transport: "local" | "cloud" | "hybrid";
  status: "online" | "offline" | "unknown";
}

export interface ControlPathCandidate {
  id: string;
  source: DeviceAtlasSourceKind;
  label: string;
  capabilities: DeviceAtlasCapability[];
  transport: "local" | "cloud" | "hybrid";
  consentGranted: boolean;
  canVerify: boolean;
  reversible: boolean;
  eventDriven: boolean;
  available: boolean;
  score: number;
  reasons: string[];
}

export interface MonitoringPlan {
  strategy: "event_subscription" | "bounded_poll" | "manual_refresh";
  source: DeviceAtlasSourceKind;
  intervalSeconds?: number;
  explanation: string;
}

export interface AtlasDevice {
  id: string;
  displayName: string;
  category: string;
  roomLabel?: string;
  sources: DeviceAtlasSourceKind[];
  observations: DeviceSourceObservation[];
  capabilities: DeviceAtlasCapability[];
  paths: ControlPathCandidate[];
  preferredPath?: ControlPathCandidate;
  monitoring: MonitoringPlan;
  identityConfidence:
    "single_source" | "strong_identity" | "strong_match" | "user_confirmed";
}

export interface AutomationDraft {
  id: string;
  state: "draft" | "simulated";
  title: string;
  trigger: string;
  conditions: string[];
  actions: string[];
  affectedDeviceIds: string[];
  requiredApproval: true;
  simulation: {
    outcome: string;
    sideEffects: string[];
  };
}

export interface DeviceAtlasSnapshot {
  schemaVersion: "1";
  generatedAt: IsoDateTime;
  mode: "fixture";
  devices: AtlasDevice[];
  sourceObservationCount: number;
  unresolvedObservationCount: number;
  privacy: {
    localDiscovery: "off" | "selected_services" | "broad_network";
    retainedNetworkIdentifiers: false;
    credentialGuessing: false;
    autonomousControl: false;
  };
  automationDrafts: AutomationDraft[];
}
