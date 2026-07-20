import type {
  AtlasDevice,
  AutomationDraft,
  ControlPathCandidate,
  DeviceAtlasCapability,
  DeviceAtlasSnapshot,
  DeviceSourceObservation,
  MonitoringPlan,
} from "@/domain/orbit/device-atlas";

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function strongKeys(observation: DeviceSourceObservation): string[] {
  return observation.identity
    .filter((item) => item.strength === "strong")
    .map((item) => `${item.kind}:${item.value.toLowerCase()}`);
}

export function scoreControlPath(
  candidate: Omit<ControlPathCandidate, "score" | "reasons">,
): ControlPathCandidate {
  let score = 0;
  const reasons: string[] = [];
  if (candidate.consentGranted) {
    score += 30;
    reasons.push("Explicit permission is present");
  }
  if (candidate.available) {
    score += 20;
    reasons.push("Path is currently available");
  }
  if (candidate.transport === "local") {
    score += 15;
    reasons.push("Local transport reduces cloud dependency");
  } else if (candidate.transport === "hybrid") {
    score += 10;
    reasons.push("Hybrid transport can retain local responsiveness");
  }
  if (candidate.canVerify) {
    score += 15;
    reasons.push("Provider state can verify an approved action");
  }
  if (candidate.reversible) {
    score += 10;
    reasons.push("Supported changes can be reversed");
  }
  if (candidate.eventDriven) {
    score += 10;
    reasons.push("Event updates avoid frequent polling");
  }
  if (!candidate.consentGranted)
    reasons.push("Unavailable until permission is granted");
  if (!candidate.available)
    reasons.push("Provider path is not currently reachable");
  return { ...candidate, score, reasons };
}

function pathFor(observation: DeviceSourceObservation): ControlPathCandidate {
  const controlCapabilities = observation.capabilities.filter(
    (capability) =>
      capability.startsWith("control.") || capability === "stream.video",
  );
  return scoreControlPath({
    id: `path_${observation.id}`,
    source: observation.source,
    label: observation.sourceLabel,
    capabilities: controlCapabilities,
    transport: observation.transport,
    consentGranted: observation.consent.granted,
    canVerify: observation.capabilities.some((item) =>
      item.startsWith("observe."),
    ),
    reversible: controlCapabilities.every((item) => item !== "stream.video"),
    eventDriven:
      observation.source === "govee" || observation.source === "matter",
    available: observation.status !== "offline",
  });
}

function monitoringFor(
  observations: DeviceSourceObservation[],
): MonitoringPlan {
  const eventSource = observations.find(
    (item) =>
      item.consent.granted &&
      item.status !== "offline" &&
      (item.source === "govee" || item.source === "matter"),
  );
  if (eventSource) {
    return {
      strategy: "event_subscription",
      source: eventSource.source,
      explanation: `${eventSource.sourceLabel} can publish state changes without continuous scanning.`,
    };
  }
  const pollSource = observations.find(
    (item) => item.consent.granted && item.status !== "offline",
  );
  if (pollSource) {
    return {
      strategy: "bounded_poll",
      source: pollSource.source,
      intervalSeconds: 900,
      explanation: `Orbit checks ${pollSource.sourceLabel} no more than every 15 minutes while the app is active.`,
    };
  }
  return {
    strategy: "manual_refresh",
    source: observations[0].source,
    explanation:
      "No continuously authorized source is available; refresh is user initiated.",
  };
}

function makeDevice(
  observations: DeviceSourceObservation[],
  index: number,
): AtlasDevice {
  const paths = observations
    .map(pathFor)
    .sort(
      (a, b) =>
        b.score - a.score || b.capabilities.length - a.capabilities.length,
    );
  const capabilities = unique(
    observations.flatMap((observation) => observation.capabilities),
  ) as DeviceAtlasCapability[];
  const confirmed = observations.some((observation) =>
    observation.identity.some((item) => item.kind === "user_confirmed"),
  );
  return {
    id: `atlas_device_${index + 1}`,
    displayName: observations[0].displayName,
    category: observations[0].category,
    roomLabel: observations.find((item) => item.roomLabel)?.roomLabel,
    sources: unique(observations.map((item) => item.source)),
    observations,
    capabilities,
    paths,
    preferredPath: paths.find(
      (path) =>
        path.consentGranted && path.available && path.capabilities.length > 0,
    ),
    monitoring: monitoringFor(observations),
    identityConfidence: confirmed
      ? "user_confirmed"
      : observations.length > 1
        ? "strong_match"
        : strongKeys(observations[0]).length > 0
          ? "strong_identity"
          : "single_source",
  };
}

export function reconcileDevices(
  observations: DeviceSourceObservation[],
): AtlasDevice[] {
  const groups: DeviceSourceObservation[][] = [];
  for (const observation of observations) {
    const keys = new Set(strongKeys(observation));
    const group = groups.find((candidate) =>
      candidate.some((existing) =>
        strongKeys(existing).some((key) => keys.has(key)),
      ),
    );
    if (group && keys.size > 0) group.push(observation);
    else groups.push([observation]);
  }
  return groups.map(makeDevice);
}

export function createAutomationDraft(devices: AtlasDevice[]): AutomationDraft {
  const light = devices.find((device) =>
    device.capabilities.includes("control.scene"),
  );
  return {
    id: "automation_draft_arrival_light",
    state: "simulated",
    title: "A calmer arrival home",
    trigger: "When the selected household member arrives after sunset",
    conditions: ["The home is currently unoccupied", "The light is reachable"],
    actions: ["Set the entry light to the Warm Welcome scene"],
    affectedDeviceIds: light ? [light.id] : [],
    requiredApproval: true,
    simulation: {
      outcome: light
        ? `${light.displayName} would use ${light.preferredPath?.label ?? "an approved path"}.`
        : "No compatible light is currently available.",
      sideEffects: [
        "No device command was sent",
        "No automation was activated",
      ],
    },
  };
}

export function buildDeviceAtlasSnapshot(
  observations: DeviceSourceObservation[],
  generatedAt: string,
): DeviceAtlasSnapshot {
  const devices = reconcileDevices(observations);
  return {
    schemaVersion: "1",
    generatedAt,
    mode: "fixture",
    devices,
    sourceObservationCount: observations.length,
    unresolvedObservationCount: devices.filter(
      (device) => device.identityConfidence === "single_source",
    ).length,
    privacy: {
      localDiscovery: "selected_services",
      retainedNetworkIdentifiers: false,
      credentialGuessing: false,
      autonomousControl: false,
    },
    automationDrafts: [createAutomationDraft(devices)],
  };
}
