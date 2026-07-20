import { describe, expect, it } from "vitest";

import type { CalendarEvent, SourceRecord } from "./connectors";
import { buildCalendarContextArtifacts } from "./calendar-attention";

const NOW = new Date("2026-07-19T16:00:00.000Z");

function eventRecord(
  id: string,
  startAt: string,
  endAt: string,
  overrides: Partial<CalendarEvent> = {},
  staleAfter = "2026-07-19T16:05:00.000Z",
): SourceRecord<CalendarEvent> {
  return {
    id: `calendar.google.${id}`,
    connectorId: "calendar.google",
    schemaVersion: "1",
    externalReference: `sha256:${id}`,
    provenance: { sourceLabel: "Google Calendar (read only)" },
    observedAt: "2026-07-19T15:00:00.000Z",
    retrievedAt: NOW.toISOString(),
    staleAfter,
    payload: {
      title: `Event ${id}`,
      startAt,
      endAt,
      allDay: false,
      status: "confirmed",
      transparency: "opaque",
      selfResponseStatus: "accepted",
      updatedAt: "2026-07-19T15:00:00.000Z",
      ...overrides,
    },
  };
}

describe("calendar attention", () => {
  it("selects exactly the earliest deterministic overlap", () => {
    const records = [
      eventRecord(
        "later-a",
        "2026-07-19T18:00:00.000Z",
        "2026-07-19T19:00:00.000Z",
      ),
      eventRecord(
        "early-b",
        "2026-07-19T16:30:00.000Z",
        "2026-07-19T17:15:00.000Z",
        { title: "Project Review" },
      ),
      eventRecord(
        "later-b",
        "2026-07-19T18:30:00.000Z",
        "2026-07-19T19:30:00.000Z",
      ),
      eventRecord(
        "early-a",
        "2026-07-19T16:20:00.000Z",
        "2026-07-19T16:50:00.000Z",
        { title: "Arrival buffer" },
      ),
    ];

    const result = buildCalendarContextArtifacts(records, NOW, {
      complete: true,
      fresh: true,
    });

    expect(result.attention).toMatchObject({
      kind: "calendar_conflict",
      actionability: "read_only",
      item: {
        title: "Arrival buffer overlaps Project Review.",
        reason: "The events overlap by 20 minutes.",
        otherEligibleCount: 1,
      },
    });
    expect(result.attention?.evidence).toHaveLength(2);
    expect(result.attention?.actionProposal).toBeUndefined();
    expect(result.attention?.recommendation).toBeUndefined();
  });

  it("treats adjacent events as non-overlapping", () => {
    const result = buildCalendarContextArtifacts(
      [
        eventRecord(
          "first",
          "2026-07-19T16:30:00.000Z",
          "2026-07-19T17:00:00.000Z",
        ),
        eventRecord(
          "second",
          "2026-07-19T17:00:00.000Z",
          "2026-07-19T17:30:00.000Z",
        ),
      ],
      NOW,
      { complete: true, fresh: true },
    );

    expect(result.attention).toBeUndefined();
  });

  it.each([
    ["cancelled", { status: "cancelled" }],
    ["all-day", { allDay: true }],
    ["transparent", { transparency: "transparent" }],
    ["self-declined", { selfResponseStatus: "declined" }],
  ] satisfies Array<[string, Partial<CalendarEvent>]>)(
    "ignores a %s event",
    (_label, ignoredOverrides) => {
      const result = buildCalendarContextArtifacts(
        [
          eventRecord(
            "ignored",
            "2026-07-19T16:30:00.000Z",
            "2026-07-19T17:30:00.000Z",
            ignoredOverrides,
          ),
          eventRecord(
            "active",
            "2026-07-19T17:00:00.000Z",
            "2026-07-19T18:00:00.000Z",
          ),
        ],
        NOW,
        { complete: true, fresh: true },
      );

      expect(result.attention).toBeUndefined();
    },
  );

  it("ignores events that have ended", () => {
    const result = buildCalendarContextArtifacts(
      [
        eventRecord(
          "ended-a",
          "2026-07-19T14:00:00.000Z",
          "2026-07-19T15:00:00.000Z",
        ),
        eventRecord(
          "ended-b",
          "2026-07-19T14:30:00.000Z",
          "2026-07-19T15:30:00.000Z",
        ),
      ],
      NOW,
      { complete: true, fresh: true },
    );

    expect(result.attention).toBeUndefined();
  });

  it("suppresses attention for an incomplete page set", () => {
    const result = buildCalendarContextArtifacts(
      [
        eventRecord(
          "a",
          "2026-07-19T16:30:00.000Z",
          "2026-07-19T17:30:00.000Z",
        ),
        eventRecord(
          "b",
          "2026-07-19T17:00:00.000Z",
          "2026-07-19T18:00:00.000Z",
        ),
      ],
      NOW,
      { complete: false, fresh: true },
    );

    expect(result.attention).toBeUndefined();
    expect(result.contextRecords).toHaveLength(2);
  });

  it("suppresses attention at and after the stale boundary", () => {
    const records = [
      eventRecord(
        "a",
        "2026-07-19T16:30:00.000Z",
        "2026-07-19T17:30:00.000Z",
        {},
        NOW.toISOString(),
      ),
      eventRecord(
        "b",
        "2026-07-19T17:00:00.000Z",
        "2026-07-19T18:00:00.000Z",
        {},
        NOW.toISOString(),
      ),
    ];

    const result = buildCalendarContextArtifacts(records, NOW, {
      complete: true,
      fresh: true,
    });

    expect(result.attention).toBeUndefined();
  });

  it("suppresses attention when a failed refresh makes a still-cached batch operationally stale", () => {
    const records = [
      eventRecord("a", "2026-07-19T16:30:00.000Z", "2026-07-19T17:30:00.000Z"),
      eventRecord("b", "2026-07-19T17:00:00.000Z", "2026-07-19T18:00:00.000Z"),
    ];

    const result = buildCalendarContextArtifacts(records, NOW, {
      complete: true,
      fresh: false,
    });

    expect(result.attention).toBeUndefined();
    expect(
      result.evidence.every((item) => item.freshnessStatus === "stale"),
    ).toBe(true);
  });

  it("suppresses attention if any record is malformed", () => {
    const records = [
      eventRecord(
        "valid",
        "2026-07-19T16:30:00.000Z",
        "2026-07-19T17:30:00.000Z",
      ),
      eventRecord("malformed", "not-a-date", "2026-07-19T18:00:00.000Z"),
    ];

    const result = buildCalendarContextArtifacts(records, NOW, {
      complete: true,
      fresh: true,
    });

    expect(result.attention).toBeUndefined();
    expect(result.contextRecords).toHaveLength(1);
  });

  it("finds nested non-adjacent overlaps, not only neighboring end times", () => {
    const result = buildCalendarContextArtifacts(
      [
        eventRecord(
          "long",
          "2026-07-19T16:10:00.000Z",
          "2026-07-19T20:00:00.000Z",
        ),
        eventRecord(
          "short-one",
          "2026-07-19T16:20:00.000Z",
          "2026-07-19T16:30:00.000Z",
        ),
        eventRecord(
          "short-two",
          "2026-07-19T16:40:00.000Z",
          "2026-07-19T16:50:00.000Z",
        ),
      ],
      NOW,
      { complete: true, fresh: true },
    );

    expect(result.attention?.item.title).toContain(
      "Event long overlaps Event short-one",
    );
    expect(result.attention?.item.otherEligibleCount).toBe(1);
  });
});
