import type {
  ConnectorFailure,
  EmailMessageSummary,
  SourceRecord,
} from "@/domain/orbit/connectors";

export type GmailConnectorFailure = ConnectorFailure;

export interface GmailSyncWindow {
  startsAt: string;
  endsAt: string;
}

export interface GmailSyncBatch {
  connectorId: "email.google";
  records: Array<SourceRecord<EmailMessageSummary>>;
  retrievedAt: string;
  staleAfter: string;
  window: GmailSyncWindow;
  completeness: "complete" | "message_cap" | "detail_failure";
}

export type GmailSyncOutcome =
  | { ok: true; batch: GmailSyncBatch }
  | { ok: false; failure: GmailConnectorFailure };

export interface GmailSyncSource {
  sync(now: Date): Promise<GmailSyncOutcome>;
}
