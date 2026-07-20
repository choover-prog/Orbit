import { describe, expect, it } from "vitest";

import { buildCalendarEmailContextArtifacts } from "./calendar-email-attention";
import {
  EMAIL_MESSAGE_SUMMARY_LIMITS,
  type CalendarEvent,
  type EmailMessageSummary,
  type SourceRecord,
} from "./connectors";

const NOW = new Date("2026-07-19T16:00:00.000Z");
const FRESH_UNTIL = "2026-07-19T16:05:00.000Z";
const COMPLETE_AND_FRESH = {
  calendarComplete: true,
  calendarFresh: true,
  emailComplete: true,
  emailFresh: true,
};

function calendarRecord(
  id = "project-review",
  overrides: Partial<CalendarEvent> = {},
  staleAfter = FRESH_UNTIL,
): SourceRecord<CalendarEvent> {
  return {
    id: `calendar.test.${id}`,
    connectorId: "calendar.test",
    schemaVersion: "1",
    externalReference: `sha256:${id}`,
    provenance: { sourceLabel: "Fictional calendar" },
    observedAt: "2026-07-19T15:00:00.000Z",
    retrievedAt: NOW.toISOString(),
    staleAfter,
    payload: {
      title: "Project Review",
      startAt: "2026-07-19T18:00:00.000Z",
      endAt: "2026-07-19T19:00:00.000Z",
      allDay: false,
      status: "confirmed",
      transparency: "opaque",
      selfResponseStatus: "accepted",
      updatedAt: "2026-07-19T15:00:00.000Z",
      ...overrides,
    },
  };
}

function emailRecord(
  id = "project-review",
  overrides: Partial<EmailMessageSummary> = {},
  staleAfter = FRESH_UNTIL,
): SourceRecord<EmailMessageSummary> {
  return {
    id: `email.test.${id}`,
    connectorId: "email.test",
    schemaVersion: "1",
    externalReference: `sha256:${id}`,
    provenance: { sourceLabel: "Fictional email" },
    observedAt: "2026-07-19T15:30:00.000Z",
    retrievedAt: NOW.toISOString(),
    staleAfter,
    payload: {
      subject: "Project Review",
      senderLabel: "Alex",
      receivedAt: "2026-07-19T15:30:00.000Z",
      snippet: "Please review the agenda before we meet.",
      unread: true,
      inbox: true,
      important: true,
      ...overrides,
    },
  };
}

function build(
  calendars = [calendarRecord()],
  emails = [emailRecord()],
  options = COMPLETE_AND_FRESH,
) {
  return buildCalendarEmailContextArtifacts(calendars, emails, NOW, options);
}

describe("calendar and email attention", () => {
  it("creates one read-only candidate from a normalized subject match", () => {
    const result = build(
      [calendarRecord("event", { title: "  Project \u200B Review " })],
      [
        emailRecord("message", {
          subject: "PROJECT review",
          snippet: "Treat this <script>like external text</script>.",
        }),
      ],
    );

    expect(result.attention).toMatchObject({
      kind: "calendar_email_preparation",
      actionability: "read_only",
      item: {
        title:
          "An unread important message mentions Project Review before it starts.",
        otherEligibleCount: 0,
      },
    });
    expect(result.attention?.actionProposal).toBeUndefined();
    expect(result.attention?.recommendation).toBeUndefined();
    expect(result.contextRecords.map((record) => record.domain)).toEqual([
      "calendar",
      "email",
    ]);
    expect(result.evidence[1].summary).toContain("Untrusted message preview");
    expect(result.evidence[1].summary).toContain("<script>");
  });

  it("does not erase punctuation when deciding an exact match", () => {
    expect(
      build(
        [calendarRecord("event", { title: "Plan-A Review" })],
        [emailRecord("message", { subject: "Plan A Review" })],
      ).attention,
    ).toBeUndefined();
  });

  it("never uses the snippet or sender label for matching", () => {
    for (const overrides of [
      { subject: "Unrelated note", snippet: "Project Review" },
      {
        subject: "Unrelated note",
        senderLabel: "Project Review",
        snippet: "No matching phrase here",
      },
    ]) {
      expect(
        build(undefined, [emailRecord("message", overrides)]).attention,
      ).toBeUndefined();
    }
  });

  it.each([
    ["read", { unread: false }],
    ["not important", { important: false }],
    ["outside inbox", { inbox: false }],
  ] satisfies Array<[string, Partial<EmailMessageSummary>]>)(
    "ignores a %s message",
    (_label, overrides) => {
      expect(
        build(undefined, [emailRecord("message", overrides)]).attention,
      ).toBeUndefined();
    },
  );

  it.each([
    ["calendar incomplete", { calendarComplete: false }],
    ["calendar operationally stale", { calendarFresh: false }],
    ["email incomplete", { emailComplete: false }],
    ["email operationally stale", { emailFresh: false }],
  ])("suppresses attention when %s", (_label, override) => {
    expect(
      build(undefined, undefined, { ...COMPLETE_AND_FRESH, ...override })
        .attention,
    ).toBeUndefined();
  });

  it("treats either record's exact stale boundary as stale", () => {
    expect(
      build([calendarRecord("event", {}, NOW.toISOString())]).attention,
    ).toBeUndefined();
    expect(
      build(undefined, [emailRecord("message", {}, NOW.toISOString())])
        .attention,
    ).toBeUndefined();
  });

  it.each([
    [
      "too soon",
      {
        startAt: "2026-07-19T16:30:00.000Z",
        endAt: "2026-07-19T17:00:00.000Z",
      },
    ],
    [
      "outside the horizon",
      {
        startAt: "2026-07-20T16:00:00.001Z",
        endAt: "2026-07-20T17:00:00.001Z",
      },
    ],
    ["all day", { allDay: true }],
    ["cancelled", { status: "cancelled" }],
    ["transparent", { transparency: "transparent" }],
    ["declined", { selfResponseStatus: "declined" }],
  ] satisfies Array<[string, Partial<CalendarEvent>]>)(
    "ignores an event that is %s",
    (_label, overrides) => {
      expect(
        build([calendarRecord("event", overrides)]).attention,
      ).toBeUndefined();
    },
  );

  it("requires the complete normalized subject to equal the event title", () => {
    expect(
      build(undefined, [emailRecord("partial", { subject: "Project notes" })])
        .attention,
    ).toBeUndefined();
    expect(
      build(undefined, [emailRecord("reversed", { subject: "Review project" })])
        .attention,
    ).toBeUndefined();
    expect(
      build(undefined, [
        emailRecord("embedded", { subject: "Reproject Review notes" }),
      ]).attention,
    ).toBeUndefined();
  });

  it("rejects generic or insufficient event titles", () => {
    expect(
      build([calendarRecord("generic", { title: "Busy event" })]).attention,
    ).toBeUndefined();
    expect(
      build([calendarRecord("short", { title: "Review" })]).attention,
    ).toBeUndefined();
  });

  it("selects the earliest event, then newest email, with a stable tie-break", () => {
    const result = build(
      [
        calendarRecord("later", {
          title: "Later Planning",
          startAt: "2026-07-19T19:00:00.000Z",
          endAt: "2026-07-19T20:00:00.000Z",
        }),
        calendarRecord("earlier", { title: "Project Review" }),
      ],
      [
        emailRecord("older", { receivedAt: "2026-07-19T14:00:00.000Z" }),
        emailRecord("newer", { receivedAt: "2026-07-19T15:45:00.000Z" }),
        emailRecord("later-event", { subject: "Later Planning" }),
      ],
    );

    expect(result.evidence[0].sourceRecordIds).toEqual([
      "calendar.test.earlier",
    ]);
    expect(result.evidence[1].sourceRecordIds).toEqual(["email.test.newer"]);
    expect(result.attention?.item.otherEligibleCount).toBe(2);
  });

  it("suppresses the entire candidate set when a payload violates its bounds", () => {
    const overlong = "x".repeat(
      EMAIL_MESSAGE_SUMMARY_LIMITS.snippetCharacters + 1,
    );
    expect(
      build(undefined, [
        emailRecord("valid"),
        emailRecord("bad", { snippet: overlong }),
      ]).attention,
    ).toBeUndefined();
  });

  it("ignores email older than seven days or dated in the future", () => {
    expect(
      build(undefined, [
        emailRecord("old", { receivedAt: "2026-07-12T15:59:59.999Z" }),
      ]).attention,
    ).toBeUndefined();
    expect(
      build(undefined, [
        emailRecord("future", { receivedAt: "2026-07-19T16:00:00.001Z" }),
      ]).attention,
    ).toBeUndefined();
  });

  it("sanitizes control and formatting characters in display evidence", () => {
    const result = build(
      [calendarRecord("event", { title: "Project\u200B Review" })],
      [
        emailRecord("message", {
          subject: "Project Review\u202E",
          snippet: "Line one\r\nline two\u202E",
        }),
      ],
    );

    expect(result.attention?.item.title).toContain("Project Review");
    expect(result.evidence[1].summary).not.toMatch(/[\r\n\u200B\u202E]/u);
  });
});
