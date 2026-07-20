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

export type HomeDeviceCategory =
  "thermostat" | "camera" | "doorbell" | "display" | "unsupported";

export type HomeTraitKind =
  | "connectivity"
  | "temperature"
  | "humidity"
  | "hvac"
  | "thermostat_mode"
  | "thermostat_setpoint"
  | "fan"
  | "camera_live_stream";

export type HomeDeviceCapability =
  | { kind: "camera.live_stream"; protocols: Array<"webrtc" | "rtsp"> }
  | {
      kind: "thermostat.set_mode";
      modes: Array<"heat" | "cool" | "heat_cool" | "off">;
    }
  | {
      kind: "thermostat.set_temperature";
      modes: Array<"heat" | "cool" | "heat_cool">;
    }
  | { kind: "fan.set_timer"; maximumSeconds: number };

/** Provider-neutral home hierarchy. Provider resource names never cross this boundary. */
export interface HomeStructure {
  id: string;
  displayName: string;
}

export interface HomeRoom {
  id: string;
  structureId: string;
  displayName: string;
}

export interface HomeTraitObservation {
  kind: HomeTraitKind;
  observedAt: IsoDateTime;
  value:
    | { status: "online" | "offline" | "unknown" }
    | { celsius: number }
    | { percent: number }
    | { status: "heating" | "cooling" | "off" | "unknown" }
    | { mode: "heat" | "cool" | "heat_cool" | "off" | "unknown" }
    | { heatCelsius?: number; coolCelsius?: number }
    | { timerMode: "on" | "off" | "unknown"; timerTimeout?: IsoDateTime }
    | {
        protocols: Array<"webrtc" | "rtsp">;
        maxWidth?: number;
        maxHeight?: number;
      };
}

export interface HomeDevice {
  id: string;
  displayName: string;
  category: HomeDeviceCategory;
  structureId?: string;
  roomId?: string;
  supported: boolean;
  capabilities: HomeDeviceCapability[];
  observations: HomeTraitObservation[];
}

export type HomeCommandCapability =
  "thermostat.set_mode" | "thermostat.set_temperature" | "fan.set_timer";

export interface HomeCommandPlan {
  id: string;
  deviceId: string;
  capability: HomeCommandCapability;
  summary: string;
  expectedEffect: string;
  previousState: string;
  planHash: string;
  expiresAt: IsoDateTime;
  reversible: boolean;
  parameters:
    | { mode: "heat" | "cool" | "heat_cool" | "off" }
    | { heatCelsius?: number; coolCelsius?: number }
    | { timerMode: "on" | "off"; durationSeconds?: number };
}

export interface HomeCommandResult {
  planId: string;
  state: "verified" | "failed" | "verification_failed";
  completedAt: IsoDateTime;
  observedState?: string;
  undoPlan?: HomeCommandPlan;
}

export interface HomeAuditEvent {
  id: string;
  occurredAt: IsoDateTime;
  deviceId: string;
  kind:
    | "plan_created"
    | "approved"
    | "executed"
    | "verified"
    | "failed"
    | "stream_started"
    | "stream_stopped";
  summary: string;
}

export interface HomePermission {
  id:
    | "home.structure.read"
    | "home.device.read"
    | "home.camera.stream"
    | "home.device.control";
  access: "read" | "write";
  granted: boolean;
  explanation: string;
}

export interface HomeContextPayload {
  structures: HomeStructure[];
  rooms: HomeRoom[];
  devices: HomeDevice[];
  permissions: HomePermission[];
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
  kind:
    | "weather"
    | "calendar_conflict"
    | "calendar_email_preparation"
    | "home_temperature_attention";
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

export type HomeAuthorizationStatus = ReadOnlyConnectorAuthorizationStatus;
export type HomeContextStatus = ReadOnlyConnectorContextStatus;

export interface HomeContextSnapshot {
  status: HomeContextStatus;
  authorization: HomeAuthorizationStatus;
  mode: ConnectorMode;
  records: Array<SourceRecord<HomeContextPayload>>;
  complete: boolean;
  structureCount: number;
  roomCount: number;
  deviceCount: number;
  supportedDeviceCount: number;
  unsupportedDeviceCount: number;
  audit: HomeAuditEvent[];
  lastSyncedAt?: IsoDateTime;
  nextSyncEligibleAt?: IsoDateTime;
  attention?: ReadOnlyAttentionBundle;
  failure?: ConnectorFailure;
}

export interface OrbitSnapshot {
  schemaVersion: "1";
  generatedAt: IsoDateTime;
  requestedContext: "weather" | "calendar" | "email" | "home" | null;
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
  home: HomeContextSnapshot;
}
