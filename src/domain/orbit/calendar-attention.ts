import type {
  CalendarEvent,
  ReadOnlyAttentionBundle,
  SourceRecord,
} from "./connectors";
import type { ContextRecord, SourceEvidence } from "./types";

export interface CalendarContextArtifacts {
  contextRecords: ContextRecord[];
  evidence: SourceEvidence[];
  attention?: ReadOnlyAttentionBundle;
}

export interface CalendarAttentionOptions {
  complete: boolean;
  fresh: boolean;
}

interface EligibleEvent {
  record: SourceRecord<CalendarEvent>;
  start: number;
  end: number;
}

interface Conflict {
  first: EligibleEvent;
  second: EligibleEvent;
  startsAt: number;
  endsAt: number;
}

function isValidEvent(event: CalendarEvent): boolean {
  return (
    Number.isFinite(Date.parse(event.startAt)) &&
    Number.isFinite(Date.parse(event.endAt)) &&
    Number.isFinite(Date.parse(event.updatedAt)) &&
    Date.parse(event.endAt) > Date.parse(event.startAt)
  );
}

function isFresh(record: SourceRecord<CalendarEvent>, now: Date): boolean {
  const staleAt = Date.parse(record.staleAfter);
  return Number.isFinite(staleAt) && now.getTime() < staleAt;
}

function eligibleEvents(
  records: Array<SourceRecord<CalendarEvent>>,
  now: Date,
): EligibleEvent[] {
  return records
    .filter((record) => {
      const event = record.payload;
      return (
        isValidEvent(event) &&
        event.status !== "cancelled" &&
        !event.allDay &&
        event.transparency !== "transparent" &&
        event.selfResponseStatus !== "declined" &&
        Date.parse(event.endAt) > now.getTime()
      );
    })
    .map((record) => ({
      record,
      start: Date.parse(record.payload.startAt),
      end: Date.parse(record.payload.endAt),
    }))
    .sort(
      (left, right) =>
        left.start - right.start ||
        left.end - right.end ||
        left.record.id.localeCompare(right.record.id),
    );
}

function conflicts(events: EligibleEvent[]): Conflict[] {
  const found: Conflict[] = [];
  for (let left = 0; left < events.length; left += 1) {
    for (let right = left + 1; right < events.length; right += 1) {
      const first = events[left];
      const second = events[right];
      if (second.start >= first.end) break;
      const startsAt = Math.max(first.start, second.start);
      const endsAt = Math.min(first.end, second.end);
      if (startsAt < endsAt) {
        found.push({ first, second, startsAt, endsAt });
      }
    }
  }

  return found.sort(
    (left, right) =>
      left.startsAt - right.startsAt ||
      left.endsAt - right.endsAt ||
      left.first.record.id.localeCompare(right.first.record.id) ||
      left.second.record.id.localeCompare(right.second.record.id),
  );
}

function evidenceFor(
  record: SourceRecord<CalendarEvent>,
  fresh: boolean,
): SourceEvidence {
  const event = record.payload;
  return {
    id: `evidence_${record.id}`,
    sourceLabel: record.provenance.sourceLabel,
    summary: `${event.title} runs from ${event.startAt} to ${event.endAt}.`,
    observedAt: event.updatedAt,
    freshnessLabel: fresh
      ? "Calendar data is current"
      : "Calendar data may be out of date",
    epistemicStatus: "fact",
    sourceRecordIds: [record.id],
    staleAfter: record.staleAfter,
    freshnessStatus: fresh ? "fresh" : "stale",
  };
}

function contextFor(
  record: SourceRecord<CalendarEvent>,
  evidence: SourceEvidence,
): ContextRecord {
  return {
    id: `context_${record.id}`,
    domain: "calendar",
    kind: "scheduled_event",
    occurredAt: record.payload.startAt,
    summary: evidence.summary,
    evidenceIds: [evidence.id],
  };
}

export function buildCalendarContextArtifacts(
  records: Array<SourceRecord<CalendarEvent>>,
  now: Date,
  options: CalendarAttentionOptions,
): CalendarContextArtifacts {
  const validRecords = records.filter((record) => isValidEvent(record.payload));
  const evidence = validRecords.map((record) =>
    evidenceFor(record, options.fresh && isFresh(record, now)),
  );
  const contextRecords = validRecords.map((record, index) =>
    contextFor(record, evidence[index]),
  );

  if (
    !options.complete ||
    !options.fresh ||
    validRecords.length !== records.length ||
    !records.every((record) => isFresh(record, now))
  ) {
    return { contextRecords, evidence };
  }

  const candidates = conflicts(eligibleEvents(records, now));
  const selected = candidates[0];
  if (!selected) return { contextRecords, evidence };

  const selectedRecords = [selected.first.record, selected.second.record];
  const selectedEvidence = selectedRecords.map((record) =>
    evidenceFor(record, true),
  );
  const selectedContext = selectedRecords.map((record, index) =>
    contextFor(record, selectedEvidence[index]),
  );
  const overlapMinutes = Math.max(
    1,
    Math.ceil((selected.endsAt - selected.startsAt) / (60 * 1_000)),
  );
  const conflictKey = `${selected.first.record.id}_${selected.second.record.id}`;

  return {
    contextRecords,
    evidence,
    attention: {
      id: `bundle_calendar_conflict_${conflictKey}`,
      kind: "calendar_conflict",
      label: "Calendar timing conflict",
      explanation:
        "Orbit found a direct overlap in fresh, read-only calendar data. It cannot change either event.",
      item: {
        id: `attention_calendar_conflict_${conflictKey}`,
        title: `${selected.first.record.payload.title} overlaps ${selected.second.record.payload.title}.`,
        reason: `The events overlap by ${overlapMinutes} minute${overlapMinutes === 1 ? "" : "s"}.`,
        evidenceIds: selectedEvidence.map((item) => item.id),
        status: "active",
        otherEligibleCount: Math.max(0, candidates.length - 1),
      },
      contextRecords: selectedContext,
      evidence: selectedEvidence,
      actionability: "read_only",
    },
  };
}
