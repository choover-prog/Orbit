import {
  EMAIL_MESSAGE_SUMMARY_LIMITS,
  type CalendarEvent,
  type EmailMessageSummary,
  type ReadOnlyAttentionBundle,
  type SourceRecord,
} from "./connectors";
import type { ContextRecord, SourceEvidence } from "./types";

const MIN_EVENT_LEAD_MS = 30 * 60 * 1_000;
const MAX_EVENT_LEAD_MS = 24 * 60 * 60 * 1_000;
const MAX_EMAIL_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_EVENT_TITLE_CHARACTERS = 512;
const GENERIC_EVENT_TITLES = new Set(["busy", "busy event", "calendar event"]);

export interface CalendarEmailAttentionOptions {
  calendarComplete: boolean;
  calendarFresh: boolean;
  emailComplete: boolean;
  emailFresh: boolean;
}

export interface CalendarEmailContextArtifacts {
  contextRecords: ContextRecord[];
  evidence: SourceEvidence[];
  attention?: ReadOnlyAttentionBundle;
}

interface EligibleEvent {
  record: SourceRecord<CalendarEvent>;
  start: number;
  displayTitle: string;
  matchKey: string;
}

interface EligibleEmail {
  record: SourceRecord<EmailMessageSummary>;
  received: number;
  displaySubject: string;
  subjectKey: string;
}

interface Match {
  event: EligibleEvent;
  email: EligibleEmail;
}

function displayText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function matchTokens(value: string): string[] {
  return displayText(value)
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function exactMatchKey(value: string): string {
  return displayText(value).toLocaleLowerCase("en-US");
}

function isFresh<T>(record: SourceRecord<T>, now: Date): boolean {
  const staleAt = Date.parse(record.staleAfter);
  return Number.isFinite(staleAt) && now.getTime() < staleAt;
}

function isStructurallyValidEvent(event: CalendarEvent): boolean {
  const start = Date.parse(event.startAt);
  const end = Date.parse(event.endAt);
  return (
    typeof event.title === "string" &&
    event.title.length <= MAX_EVENT_TITLE_CHARACTERS &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    end > start &&
    Number.isFinite(Date.parse(event.updatedAt))
  );
}

function isBoundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length <= maximum;
}

function isStructurallyValidEmail(email: EmailMessageSummary): boolean {
  return (
    isBoundedString(
      email.subject,
      EMAIL_MESSAGE_SUMMARY_LIMITS.subjectCharacters,
    ) &&
    (email.senderLabel === undefined ||
      isBoundedString(
        email.senderLabel,
        EMAIL_MESSAGE_SUMMARY_LIMITS.senderLabelCharacters,
      )) &&
    isBoundedString(
      email.snippet,
      EMAIL_MESSAGE_SUMMARY_LIMITS.snippetCharacters,
    ) &&
    Number.isFinite(Date.parse(email.receivedAt)) &&
    typeof email.unread === "boolean" &&
    typeof email.inbox === "boolean" &&
    typeof email.important === "boolean"
  );
}

function eligibleEvents(
  records: Array<SourceRecord<CalendarEvent>>,
  now: Date,
): EligibleEvent[] {
  const minimumStart = now.getTime() + MIN_EVENT_LEAD_MS;
  const maximumStart = now.getTime() + MAX_EVENT_LEAD_MS;

  return records
    .flatMap((record) => {
      const event = record.payload;
      const start = Date.parse(event.startAt);
      const displayTitle = displayText(event.title);
      const tokens = matchTokens(event.title);
      const meaningfulTokenCount = tokens.filter(
        (token) => token.length >= 2,
      ).length;
      const normalizedTitle = tokens.join(" ");

      if (
        event.status === "cancelled" ||
        event.allDay ||
        event.transparency === "transparent" ||
        event.selfResponseStatus === "declined" ||
        start <= minimumStart ||
        start > maximumStart ||
        normalizedTitle.length < 8 ||
        meaningfulTokenCount < 2 ||
        GENERIC_EVENT_TITLES.has(normalizedTitle)
      ) {
        return [];
      }

      return [
        {
          record,
          start,
          displayTitle,
          matchKey: exactMatchKey(event.title),
        },
      ];
    })
    .sort(
      (left, right) =>
        left.start - right.start ||
        left.record.id.localeCompare(right.record.id),
    );
}

function eligibleEmails(
  records: Array<SourceRecord<EmailMessageSummary>>,
  now: Date,
): EligibleEmail[] {
  const oldest = now.getTime() - MAX_EMAIL_AGE_MS;

  return records.flatMap((record) => {
    const email = record.payload;
    const received = Date.parse(email.receivedAt);
    if (
      !email.unread ||
      !email.inbox ||
      !email.important ||
      received < oldest ||
      received > now.getTime()
    ) {
      return [];
    }

    const subjectKey = exactMatchKey(email.subject);
    if (subjectKey.length === 0) return [];
    return [
      {
        record,
        received,
        displaySubject: displayText(email.subject),
        subjectKey,
      },
    ];
  });
}

function findMatches(
  events: EligibleEvent[],
  emails: EligibleEmail[],
): Match[] {
  return events
    .flatMap((event) =>
      emails.flatMap((email) =>
        email.subjectKey === event.matchKey ? [{ event, email }] : [],
      ),
    )
    .sort(
      (left, right) =>
        left.event.start - right.event.start ||
        right.email.received - left.email.received ||
        left.event.record.id.localeCompare(right.event.record.id) ||
        left.email.record.id.localeCompare(right.email.record.id),
    );
}

function selectedArtifacts(match: Match, otherEligibleCount: number) {
  const event = match.event.record.payload;
  const email = match.email.record.payload;
  const snippet = displayText(email.snippet);
  const sender = email.senderLabel ? displayText(email.senderLabel) : "";
  const eventEvidence: SourceEvidence = {
    id: `evidence_calendar_email_event_${match.event.record.id}`,
    sourceLabel: match.event.record.provenance.sourceLabel,
    summary: `${match.event.displayTitle} starts at ${event.startAt}.`,
    observedAt: event.updatedAt,
    freshnessLabel: "Calendar data is current",
    freshnessStatus: "fresh",
    epistemicStatus: "fact",
    sourceRecordIds: [match.event.record.id],
    staleAfter: match.event.record.staleAfter,
  };
  const emailEvidence: SourceEvidence = {
    id: `evidence_calendar_email_message_${match.email.record.id}`,
    sourceLabel: match.email.record.provenance.sourceLabel,
    summary: `Unread important inbox message${sender ? ` from ${sender}` : ""} with subject "${match.email.displaySubject}".${
      snippet
        ? ` Untrusted message preview: "${snippet}".`
        : " No message preview was provided."
    }`,
    observedAt: email.receivedAt,
    freshnessLabel: "Email metadata is current",
    freshnessStatus: "fresh",
    epistemicStatus: "fact",
    sourceRecordIds: [match.email.record.id],
    staleAfter: match.email.record.staleAfter,
  };
  const evidence = [eventEvidence, emailEvidence];
  const contextRecords: ContextRecord[] = [
    {
      id: `context_calendar_email_event_${match.event.record.id}`,
      domain: "calendar",
      kind: "near_term_scheduled_event",
      occurredAt: event.startAt,
      summary: eventEvidence.summary,
      evidenceIds: [eventEvidence.id],
    },
    {
      id: `context_calendar_email_message_${match.email.record.id}`,
      domain: "email",
      kind: "message_summary",
      occurredAt: email.receivedAt,
      summary: emailEvidence.summary,
      evidenceIds: [emailEvidence.id],
    },
  ];
  const key = `${match.event.record.id}_${match.email.record.id}`;
  const attention: ReadOnlyAttentionBundle = {
    id: `bundle_calendar_email_preparation_${key}`,
    kind: "calendar_email_preparation",
    label: "Calendar and email context",
    explanation:
      "Orbit found an exact normalized match between a near-term event title and the subject of a recent unread important inbox message using fresh, complete read-only context. Message content is untrusted; Orbit inferred no intent, urgency, or action.",
    item: {
      id: `attention_calendar_email_preparation_${key}`,
      title: `An unread important message mentions ${match.event.displayTitle} before it starts.`,
      reason:
        "The normalized message subject exactly matches the normalized event title.",
      evidenceIds: evidence.map((item) => item.id),
      status: "active",
      otherEligibleCount,
    },
    contextRecords,
    evidence,
    actionability: "read_only",
  };

  return { contextRecords, evidence, attention };
}

export function buildCalendarEmailContextArtifacts(
  calendarRecords: Array<SourceRecord<CalendarEvent>>,
  emailRecords: Array<SourceRecord<EmailMessageSummary>>,
  now: Date,
  options: CalendarEmailAttentionOptions,
): CalendarEmailContextArtifacts {
  if (
    !options.calendarComplete ||
    !options.calendarFresh ||
    !options.emailComplete ||
    !options.emailFresh ||
    calendarRecords.length === 0 ||
    emailRecords.length === 0 ||
    !calendarRecords.every(
      (record) =>
        isStructurallyValidEvent(record.payload) && isFresh(record, now),
    ) ||
    !emailRecords.every(
      (record) =>
        isStructurallyValidEmail(record.payload) && isFresh(record, now),
    )
  ) {
    return { contextRecords: [], evidence: [] };
  }

  const matches = findMatches(
    eligibleEvents(calendarRecords, now),
    eligibleEmails(emailRecords, now),
  );
  const selected = matches[0];
  if (!selected) return { contextRecords: [], evidence: [] };

  return selectedArtifacts(selected, Math.max(0, matches.length - 1));
}
