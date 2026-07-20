import type {
  ConnectorFailure,
  HomeContextPayload,
  SourceRecord,
} from "@/domain/orbit/connectors";

export type GoogleNestFailure = ConnectorFailure;

export interface GoogleNestSyncBatch {
  connectorId: "home.google-nest";
  records: Array<SourceRecord<HomeContextPayload>>;
  retrievedAt: string;
  staleAfter: string;
  completeness: "complete" | "structure_cap" | "room_cap" | "device_cap";
  /** Server-only map used for commands; never serialize into OrbitSnapshot. */
  deviceReferences: Record<string, string>;
}

export type GoogleNestSyncOutcome =
  | { ok: true; batch: GoogleNestSyncBatch }
  | { ok: false; failure: GoogleNestFailure };

export interface GoogleNestSyncSource {
  sync(now: Date): Promise<GoogleNestSyncOutcome>;
}
