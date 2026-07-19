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
  kind: "weather";
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

export interface OrbitSnapshot {
  schemaVersion: "1";
  generatedAt: IsoDateTime;
  person: PersonReference;
  selectedAttentionId: string | null;
  attention: AttentionBundle[];
  contextRecords: ContextRecord[];
  evidence: SourceEvidence[];
  sourceRecords: Array<SourceRecord<WeatherReading>>;
  connections: ConnectionStatus[];
  weather: WeatherContextSnapshot;
}
