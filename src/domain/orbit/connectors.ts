import type {
  ActionProposal,
  AttentionItem,
  ConnectionStatus,
  ContextRecord,
  IsoDateTime,
  PersonReference,
  Recommendation,
  SourceAttribution,
  SourceEvidence,
} from "./types";

export type ConnectorMode = "fixture" | "live";

export type ConnectorErrorCode =
  | "configuration_required"
  | "authentication_required"
  | "authorization_denied"
  | "insufficient_scope"
  | "storage_unavailable"
  | "refresh_required"
  | "timeout"
  | "rate_limited"
  | "provider_unavailable"
  | "invalid_response";

export interface ConnectorFailure {
  code: ConnectorErrorCode;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

export interface SyncCursor {
  connectorId: string;
  syncedThrough: IsoDateTime;
  continuationToken?: string;
}

export interface SourceRecord<TPayload = unknown> {
  id: string;
  connectorId: string;
  schemaVersion: "1";
  externalReference: string;
  provenance: {
    sourceLabel: string;
    attribution?: SourceAttribution;
  };
  observedAt: IsoDateTime;
  retrievedAt: IsoDateTime;
  staleAfter: IsoDateTime;
  payload: TPayload;
}

export interface ConnectorSyncRequest {
  now: Date;
  cursor?: SyncCursor;
}

export type ConnectorSyncResult<TPayload> =
  | {
      ok: true;
      mode: ConnectorMode;
      health: "connected";
      records: Array<SourceRecord<TPayload>>;
      cursor: SyncCursor;
    }
  | {
      ok: false;
      mode: ConnectorMode;
      health: "unavailable" | "misconfigured";
      records: [];
      failure: ConnectorFailure;
    };

export interface ContextConnector<TPayload> {
  readonly id: string;
  readonly mode: ConnectorMode;
  sync(request: ConnectorSyncRequest): Promise<ConnectorSyncResult<TPayload>>;
}

export interface HourlyWeatherPoint {
  at: IsoDateTime;
  temperatureF: number;
  precipitationProbabilityPercent: number;
  weatherCode: number;
}

export interface WeatherReading {
  locationLabel: string;
  observedAt: IsoDateTime;
  condition: string;
  weatherCode: number;
  temperatureF: number;
  apparentTemperatureF: number;
  relativeHumidityPercent: number;
  precipitationInches: number;
  windSpeedMph: number;
  windGustMph: number;
  isDay: boolean;
  modeled: true;
  hourly: HourlyWeatherPoint[];
}

export type CalendarEventStatus = "confirmed" | "tentative" | "cancelled";
export type CalendarSelfResponseStatus =
  "accepted" | "tentative" | "declined" | "needsAction" | "unknown";

/**
 * Provider-neutral, deliberately minimal calendar context. Raw Google event
 * bodies and provider identifiers must never cross into this contract.
 */
export interface CalendarEvent {
  title: string;
  startAt: IsoDateTime;
  endAt: IsoDateTime;
  allDay: boolean;
  status: CalendarEventStatus;
  transparency: "opaque" | "transparent";
  selfResponseStatus: CalendarSelfResponseStatus;
  updatedAt: IsoDateTime;
}

/**
 * Hard bounds for normalized email context. Provider adapters must enforce
 * these limits before records cross into Orbit Core. Domain policy validates
 * them again before email can contribute to attention.
 */
export const EMAIL_MESSAGE_SUMMARY_LIMITS = {
  recordsPerSync: 25,
  subjectCharacters: 512,
  senderLabelCharacters: 256,
  snippetCharacters: 1_024,
} as const;

/**
 * Provider-neutral, deliberately minimal email context. Subject, sender, and
 * snippet are untrusted external content and must only be rendered as text.
 * Raw provider message bodies, addresses, and identifiers must not cross into
 * this contract.
 */
export interface EmailMessageSummary {
  subject: string;
  senderLabel?: string;
  receivedAt: IsoDateTime;
  snippet: string;
  unread: boolean;
  inbox: boolean;
  important: boolean;
}

interface AttentionBundleBase {
  id: string;
  label: string;
  explanation: string;
  item: AttentionItem;
  contextRecords: ContextRecord[];
  evidence: SourceEvidence[];
}

export interface MockedActionAttentionBundle extends AttentionBundleBase {
  kind: "travel_conflict";
  recommendation: Recommendation;
  actionProposal: ActionProposal;
  actionability: "mocked_action";
}

export interface ReadOnlyAttentionBundle extends AttentionBundleBase {
  kind: "weather" | "calendar_conflict" | "calendar_email_preparation";
  recommendation?: Recommendation;
  actionProposal?: never;
  actionability: "read_only";
}

export type AttentionBundle =
  MockedActionAttentionBundle | ReadOnlyAttentionBundle;

export interface WeatherContextSnapshot {
  status: "fresh" | "stale" | "unavailable" | "misconfigured";
  mode: ConnectorMode;
  reading?: WeatherReading;
  attention?: AttentionBundle;
  failure?: ConnectorFailure;
}

export type ReadOnlyConnectorAuthorizationStatus =
  | "configuration_required"
  | "disconnected"
  | "connected"
  | "reauthorization_required"
  | "storage_unavailable";

export type ReadOnlyConnectorContextStatus =
  | ReadOnlyConnectorAuthorizationStatus
  | "syncing"
  | "fresh"
  | "stale"
  | "rate_limited"
  | "unavailable";

export type CalendarAuthorizationStatus = ReadOnlyConnectorAuthorizationStatus;

export type CalendarContextStatus = ReadOnlyConnectorContextStatus;

export interface CalendarContextSnapshot {
  status: CalendarContextStatus;
  authorization: CalendarAuthorizationStatus;
  mode: ConnectorMode;
  records: Array<SourceRecord<CalendarEvent>>;
  complete: boolean;
  eventCount: number;
  windowStart?: IsoDateTime;
  windowEnd?: IsoDateTime;
  lastSyncedAt?: IsoDateTime;
  nextSyncEligibleAt?: IsoDateTime;
  attention?: ReadOnlyAttentionBundle;
  failure?: ConnectorFailure;
}

export type EmailAuthorizationStatus = ReadOnlyConnectorAuthorizationStatus;

export type EmailContextStatus = ReadOnlyConnectorContextStatus;

export interface EmailContextSnapshot {
  status: EmailContextStatus;
  authorization: EmailAuthorizationStatus;
  mode: ConnectorMode;
  records: Array<SourceRecord<EmailMessageSummary>>;
  complete: boolean;
  messageCount: number;
  windowStart?: IsoDateTime;
  windowEnd?: IsoDateTime;
  lastSyncedAt?: IsoDateTime;
  nextSyncEligibleAt?: IsoDateTime;
  attention?: ReadOnlyAttentionBundle;
  failure?: ConnectorFailure;
}

export interface OrbitSnapshot {
  schemaVersion: "1";
  generatedAt: IsoDateTime;
  requestedContext: "weather" | "calendar" | "email" | null;
  person: PersonReference;
  selectedAttentionId: string | null;
  attention: AttentionBundle[];
  contextRecords: ContextRecord[];
  evidence: SourceEvidence[];
  sourceRecords: Array<SourceRecord>;
  connections: ConnectionStatus[];
  weather: WeatherContextSnapshot;
  calendar: CalendarContextSnapshot;
  email: EmailContextSnapshot;
}
