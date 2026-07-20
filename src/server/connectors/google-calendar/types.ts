import type {
  CalendarEvent,
  ConnectorFailure,
  SourceRecord,
} from "@/domain/orbit/connectors";

export type CalendarConnectorFailure = ConnectorFailure;

export interface CalendarSyncWindow {
  startsAt: string;
  endsAt: string;
}

export interface CalendarSyncBatch {
  connectorId: "calendar.google";
  records: Array<SourceRecord<CalendarEvent>>;
  retrievedAt: string;
  staleAfter: string;
  window: CalendarSyncWindow;
  pageCount: number;
  completeness: "complete" | "page_cap";
}

export type CalendarSyncOutcome =
  | { ok: true; batch: CalendarSyncBatch }
  | { ok: false; failure: CalendarConnectorFailure };

export interface CalendarSyncSource {
  sync(now: Date): Promise<CalendarSyncOutcome>;
}
