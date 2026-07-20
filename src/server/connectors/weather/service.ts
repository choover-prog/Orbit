import type {
  ConnectorFailure,
  ConnectorMode,
  ContextConnector,
  SourceRecord,
  WeatherReading,
} from "@/domain/orbit/connectors";

export type WeatherReadResult =
  | {
      status: "fresh";
      mode: ConnectorMode;
      record: SourceRecord<WeatherReading>;
      fromCache: boolean;
    }
  | {
      status: "stale";
      mode: ConnectorMode;
      record: SourceRecord<WeatherReading>;
      failure: ConnectorFailure;
      fromCache: true;
    }
  | {
      status: "unavailable" | "misconfigured";
      mode: ConnectorMode;
      failure: ConnectorFailure;
      fromCache: false;
    };

interface CachedFailure {
  status: "unavailable" | "misconfigured";
  mode: ConnectorMode;
  failure: ConnectorFailure;
  retryAt: number;
}

const DEFAULT_FAILURE_BACKOFF_MS = 30 * 1_000;
const NON_RETRYABLE_BACKOFF_MS = 5 * 60 * 1_000;
const MAX_RETRY_AFTER_MS = 60 * 60 * 1_000;

export class WeatherConnectorService {
  private lastValidRecord: SourceRecord<WeatherReading> | undefined;
  private lastFailure: CachedFailure | undefined;
  private inFlight: Promise<WeatherReadResult> | undefined;

  constructor(private readonly connector: ContextConnector<WeatherReading>) {}

  async read(now: Date): Promise<WeatherReadResult> {
    if (
      this.lastValidRecord &&
      now.getTime() < new Date(this.lastValidRecord.staleAfter).getTime()
    ) {
      return {
        status: "fresh",
        mode: this.connector.mode,
        record: this.lastValidRecord,
        fromCache: true,
      };
    }

    if (this.lastFailure && now.getTime() < this.lastFailure.retryAt) {
      return this.failureView(this.lastFailure);
    }

    if (this.inFlight) return this.inFlight;

    const pending = this.refresh(now).finally(() => {
      if (this.inFlight === pending) this.inFlight = undefined;
    });
    this.inFlight = pending;
    return pending;
  }

  private async refresh(now: Date): Promise<WeatherReadResult> {
    const result = await this.connector.sync({ now });
    if (result.ok) {
      const record = result.records[0];
      if (!record) {
        return this.rememberFailure(
          {
            code: "invalid_response",
            message: "Weather returned no validated records.",
            retryable: false,
          },
          result.mode,
          "unavailable",
          now,
        );
      }

      this.lastValidRecord = record;
      this.lastFailure = undefined;
      return {
        status: "fresh",
        mode: result.mode,
        record,
        fromCache: false,
      };
    }

    return this.rememberFailure(
      result.failure,
      result.mode,
      result.health === "misconfigured" ? "misconfigured" : "unavailable",
      now,
    );
  }

  private rememberFailure(
    failure: ConnectorFailure,
    mode: ConnectorMode,
    status: "unavailable" | "misconfigured",
    now: Date,
  ): WeatherReadResult {
    const providerDelay = Math.min(
      (failure.retryAfterSeconds ?? 0) * 1_000,
      MAX_RETRY_AFTER_MS,
    );
    const backoff = failure.retryable
      ? Math.max(DEFAULT_FAILURE_BACKOFF_MS, providerDelay)
      : NON_RETRYABLE_BACKOFF_MS;
    this.lastFailure = {
      failure,
      mode,
      status,
      retryAt: now.getTime() + backoff,
    };

    return this.failureView(this.lastFailure);
  }

  private failureView(failure: CachedFailure): WeatherReadResult {
    if (this.lastValidRecord) {
      return {
        status: "stale",
        mode: failure.mode,
        record: this.lastValidRecord,
        failure: failure.failure,
        fromCache: true,
      };
    }

    return {
      status: failure.status,
      mode: failure.mode,
      failure: failure.failure,
      fromCache: false,
    };
  }
}
