import type {
  AttentionBundle,
  SourceRecord,
  WeatherReading,
} from "./connectors";
import type { AttentionItem, ContextRecord, SourceEvidence } from "./types";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export interface WeatherContextArtifacts {
  contextRecord: ContextRecord;
  evidence: SourceEvidence;
  attention?: AttentionBundle;
}

function isFresh(record: SourceRecord<WeatherReading>, now: Date) {
  return now.getTime() < new Date(record.staleAfter).getTime();
}

function precipitationPeak(reading: WeatherReading, now: Date) {
  const horizon = now.getTime() + SIX_HOURS_MS;
  const relevantPoints = reading.hourly.filter((point) => {
    const at = new Date(point.at).getTime();
    return at >= now.getTime() && at <= horizon;
  });

  if (relevantPoints.length === 0) return null;

  return relevantPoints.reduce(
    (peak, point) => Math.max(peak, point.precipitationProbabilityPercent),
    0,
  );
}

function attentionCopy(
  reading: WeatherReading,
  precipitationPercent: number | null,
) {
  if (reading.apparentTemperatureF >= 100) {
    return {
      title: `It may feel like ${Math.round(reading.apparentTemperatureF)}°F in ${reading.locationLabel}.`,
      reason:
        "The modeled apparent temperature crosses Orbit's high-heat attention threshold.",
      explanation:
        "Orbit surfaced this because the modeled apparent temperature is at least 100°F. It is a forecast signal, not a direct observation or health recommendation.",
    };
  }

  if (reading.apparentTemperatureF <= 15) {
    return {
      title: `It may feel like ${Math.round(reading.apparentTemperatureF)}°F in ${reading.locationLabel}.`,
      reason:
        "The modeled apparent temperature crosses Orbit's low-temperature attention threshold.",
      explanation:
        "Orbit surfaced this because the modeled apparent temperature is at most 15°F. It is a forecast signal, not a direct observation or health recommendation.",
    };
  }

  if (reading.windGustMph >= 40) {
    return {
      title: `Wind gusts may reach ${Math.round(reading.windGustMph)} mph in ${reading.locationLabel}.`,
      reason:
        "The modeled gust speed crosses Orbit's wind attention threshold.",
      explanation:
        "Orbit surfaced this because modeled gusts reach at least 40 mph. No action is inferred from weather alone.",
    };
  }

  if (precipitationPercent !== null && precipitationPercent >= 70) {
    return {
      title: "Precipitation is likely in the next six hours.",
      reason: `The modeled probability reaches ${Math.round(precipitationPercent)}% in ${reading.locationLabel}.`,
      explanation:
        "Orbit surfaced this because modeled precipitation probability reaches 70% within the next six hours. No personal impact or action is inferred without more context.",
    };
  }

  return null;
}

export function buildWeatherContextArtifacts(
  record: SourceRecord<WeatherReading>,
  now: Date,
): WeatherContextArtifacts {
  const fresh = isFresh(record, now);
  const reading = record.payload;
  const precipitationPercent = precipitationPeak(reading, now);
  const evidenceId = `evidence_${record.id}`;
  const contextId = `context_${record.id}`;
  const freshnessStatus = fresh ? "fresh" : "stale";

  const evidence: SourceEvidence = {
    id: evidenceId,
    sourceLabel: record.provenance.sourceLabel,
    summary:
      precipitationPercent === null
        ? `${reading.condition}, ${Math.round(reading.temperatureF)}°F. No current or future precipitation-probability point is available in the next six hours.`
        : `${reading.condition}, ${Math.round(reading.temperatureF)}°F, with a ${Math.round(precipitationPercent)}% peak precipitation probability in the next six hours.`,
    observedAt: reading.observedAt,
    freshnessLabel: fresh
      ? "Modeled forecast is current"
      : "Modeled forecast is stale",
    epistemicStatus: "derived",
    sourceRecordIds: [record.id],
    staleAfter: record.staleAfter,
    freshnessStatus,
    ...(record.provenance.attribution
      ? { attribution: record.provenance.attribution }
      : {}),
  };

  const contextRecord: ContextRecord = {
    id: contextId,
    domain: "weather",
    kind: "modeled_forecast",
    occurredAt: reading.observedAt,
    summary: evidence.summary,
    evidenceIds: [evidence.id],
  };

  const copy = fresh ? attentionCopy(reading, precipitationPercent) : null;
  if (!copy) return { contextRecord, evidence };

  const item: AttentionItem = {
    id: `attention_${record.id}`,
    title: copy.title,
    reason: copy.reason,
    evidenceIds: [evidence.id],
    status: "active",
    otherEligibleCount: 0,
  };

  return {
    contextRecord,
    evidence,
    attention: {
      id: `bundle_${record.id}`,
      kind: "weather",
      label: "Weather update",
      explanation: copy.explanation,
      item,
      contextRecords: [contextRecord],
      evidence: [evidence],
      actionability: "read_only",
    },
  };
}
