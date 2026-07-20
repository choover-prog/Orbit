import type {
  HomeContextPayload,
  ReadOnlyAttentionBundle,
  SourceRecord,
} from "./connectors";

const LOW_CELSIUS = 10;
const HIGH_CELSIUS = 32;

export function buildHomeContextArtifacts(
  records: Array<SourceRecord<HomeContextPayload>>,
  now: Date,
  gate: { complete: boolean; fresh: boolean },
): { attention?: ReadOnlyAttentionBundle } {
  if (!gate.complete || !gate.fresh || !Number.isFinite(now.getTime())) {
    return {};
  }

  const candidates = records.flatMap((record) =>
    record.payload.devices.flatMap((device) => {
      if (!device.supported || device.category !== "thermostat") return [];
      const connectivity = device.observations.find(
        (observation) => observation.kind === "connectivity",
      );
      if (
        connectivity?.value &&
        "status" in connectivity.value &&
        connectivity.value.status !== "online"
      ) {
        return [];
      }
      const temperature = device.observations.find(
        (observation) => observation.kind === "temperature",
      );
      if (
        !temperature?.value ||
        !("celsius" in temperature.value) ||
        (temperature.value.celsius >= LOW_CELSIUS &&
          temperature.value.celsius <= HIGH_CELSIUS)
      ) {
        return [];
      }
      return [
        {
          record,
          device,
          celsius: temperature.value.celsius,
          distance: Math.max(
            LOW_CELSIUS - temperature.value.celsius,
            temperature.value.celsius - HIGH_CELSIUS,
          ),
        },
      ];
    }),
  );

  candidates.sort(
    (a, b) => b.distance - a.distance || a.device.id.localeCompare(b.device.id),
  );
  const candidate = candidates[0];
  if (!candidate) return {};

  const direction = candidate.celsius < LOW_CELSIUS ? "low" : "high";
  const fahrenheit = Math.round((candidate.celsius * 9) / 5 + 32);
  const id = `attention_home_temperature_${candidate.device.id}`;
  return {
    attention: {
      id,
      kind: "home_temperature_attention",
      label: `${candidate.device.displayName} reports an unusually ${direction} temperature.`,
      explanation: `A connected thermostat reported ${fahrenheit}°F. Orbit is only showing the reading; it cannot change the thermostat.`,
      actionability: "read_only",
      item: {
        id,
        title: `${candidate.device.displayName} may need a look`,
        reason: `The current thermostat reading is ${fahrenheit}°F.`,
        status: "active",
        evidenceIds: [`evidence_${id}`],
        otherEligibleCount: Math.max(0, candidates.length - 1),
      },
      contextRecords: [],
      evidence: [
        {
          id: `evidence_${id}`,
          sourceLabel: candidate.record.provenance.sourceLabel,
          summary: `${candidate.device.displayName} reported ${fahrenheit}°F during the latest bounded read.`,
          observedAt: candidate.record.observedAt,
          freshnessLabel: "Home context is current",
          epistemicStatus: "fact",
          sourceRecordIds: [candidate.record.id],
          staleAfter: candidate.record.staleAfter,
          freshnessStatus: "fresh",
        },
      ],
    },
  };
}
