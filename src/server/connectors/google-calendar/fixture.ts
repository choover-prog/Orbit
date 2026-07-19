import type { CalendarEvent, SourceRecord } from "@/domain/orbit/connectors";

import { GOOGLE_CALENDAR_CACHE_MS } from "./client";
import { GOOGLE_CALENDAR_CONNECTOR_ID } from "./config";
import type { CalendarSyncBatch, CalendarSyncSource } from "./types";

const MINUTE_MS = 60 * 1_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

interface FixtureEvent {
  id: string;
  title: string;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
}

const EVENTS: FixtureEvent[] = [
  {
    id: "flight-arrival-buffer",
    title: "Airport arrival buffer",
    startOffsetMinutes: 20,
    endOffsetMinutes: 50,
  },
  {
    id: "project-review",
    title: "Project Review",
    startOffsetMinutes: 45,
    endOffsetMinutes: 75,
  },
  {
    id: "quiet-focus",
    title: "Focus time",
    startOffsetMinutes: 120,
    endOffsetMinutes: 180,
  },
];

function fixtureRecord(
  fixture: FixtureEvent,
  now: Date,
): SourceRecord<CalendarEvent> {
  const event: CalendarEvent = {
    title: fixture.title,
    startAt: new Date(
      now.getTime() + fixture.startOffsetMinutes * MINUTE_MS,
    ).toISOString(),
    endAt: new Date(
      now.getTime() + fixture.endOffsetMinutes * MINUTE_MS,
    ).toISOString(),
    allDay: false,
    status: "confirmed",
    transparency: "opaque",
    selfResponseStatus: "accepted",
    updatedAt: new Date(now.getTime() - MINUTE_MS).toISOString(),
  };

  return {
    id: `calendar.fixture.${fixture.id}`,
    connectorId: GOOGLE_CALENDAR_CONNECTOR_ID,
    schemaVersion: "1",
    externalReference: `fixture:${fixture.id}`,
    provenance: { sourceLabel: "Fictional Google Calendar fixture" },
    observedAt: event.updatedAt,
    retrievedAt: now.toISOString(),
    staleAfter: new Date(
      now.getTime() + GOOGLE_CALENDAR_CACHE_MS,
    ).toISOString(),
    payload: event,
  };
}

export function createFixtureCalendarBatch(now: Date): CalendarSyncBatch {
  return {
    connectorId: GOOGLE_CALENDAR_CONNECTOR_ID,
    records: EVENTS.map((event) => fixtureRecord(event, now)),
    retrievedAt: now.toISOString(),
    staleAfter: new Date(
      now.getTime() + GOOGLE_CALENDAR_CACHE_MS,
    ).toISOString(),
    window: {
      startsAt: new Date(now.getTime() - DAY_MS).toISOString(),
      endsAt: new Date(now.getTime() + 14 * DAY_MS).toISOString(),
    },
    pageCount: 1,
    completeness: "complete",
  };
}

export function createFixtureCalendarSource(): CalendarSyncSource {
  return {
    async sync(now) {
      return { ok: true, batch: createFixtureCalendarBatch(now) };
    },
  };
}
