import type {
  EmailMessageSummary,
  SourceRecord,
} from "@/domain/orbit/connectors";

import { GMAIL_CACHE_MS, GMAIL_LOOKBACK_DAYS } from "./client";
import { GMAIL_CONNECTOR_ID } from "./config";
import type { GmailSyncBatch, GmailSyncSource } from "./types";

const MINUTE_MS = 60 * 1_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

interface FixtureMessage {
  id: string;
  subject: string;
  snippet: string;
  ageMinutes: number;
  important: boolean;
}

const MESSAGES: FixtureMessage[] = [
  {
    id: "project-review-preparation",
    subject: "Project Review",
    snippet: "A fictional agenda update is ready to review.",
    ageMinutes: 45,
    important: true,
  },
  {
    id: "quiet-fixture-message",
    subject: "Fictional weekly note",
    snippet: "This local fixture never contacts Gmail.",
    ageMinutes: 90,
    important: false,
  },
];

function fixtureRecord(
  fixture: FixtureMessage,
  now: Date,
): SourceRecord<EmailMessageSummary> {
  const receivedAt = new Date(
    now.getTime() - fixture.ageMinutes * MINUTE_MS,
  ).toISOString();
  return {
    id: `email.fixture.${fixture.id}`,
    connectorId: GMAIL_CONNECTOR_ID,
    schemaVersion: "1",
    externalReference: `fixture:${fixture.id}`,
    provenance: { sourceLabel: "Fictional Gmail fixture" },
    observedAt: receivedAt,
    retrievedAt: now.toISOString(),
    staleAfter: new Date(now.getTime() + GMAIL_CACHE_MS).toISOString(),
    payload: {
      subject: fixture.subject,
      senderLabel: "Fictional sender",
      receivedAt,
      snippet: fixture.snippet,
      unread: true,
      inbox: true,
      important: fixture.important,
    },
  };
}

export function createFixtureGmailBatch(now: Date): GmailSyncBatch {
  return {
    connectorId: GMAIL_CONNECTOR_ID,
    records: MESSAGES.map((message) => fixtureRecord(message, now)),
    retrievedAt: now.toISOString(),
    staleAfter: new Date(now.getTime() + GMAIL_CACHE_MS).toISOString(),
    window: {
      startsAt: new Date(
        now.getTime() - GMAIL_LOOKBACK_DAYS * DAY_MS,
      ).toISOString(),
      endsAt: now.toISOString(),
    },
    completeness: "complete",
  };
}

export function createFixtureGmailSource(): GmailSyncSource {
  return {
    async sync(now) {
      return { ok: true, batch: createFixtureGmailBatch(now) };
    },
  };
}
