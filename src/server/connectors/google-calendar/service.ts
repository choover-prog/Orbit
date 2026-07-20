import type {
  CalendarConnectorFailure,
  CalendarSyncBatch,
  CalendarSyncSource,
} from "./types";

export type CalendarReadResult =
  | {
      status: "fresh";
      batch: CalendarSyncBatch;
      fromCache: boolean;
      nextSyncEligibleAt: string;
    }
  | {
      status: "stale";
      batch: CalendarSyncBatch;
      failure: CalendarConnectorFailure;
      fromCache: true;
      nextSyncEligibleAt: string;
    }
  | {
      status: "rate_limited" | "reauthorization_required" | "unavailable";
      failure: CalendarConnectorFailure;
      fromCache: false;
      nextSyncEligibleAt: string;
    };

interface CachedFailure {
  failure: CalendarConnectorFailure;
  retryAt: number;
}

const DEFAULT_FAILURE_BACKOFF_MS = 30 * 1_000;
const NON_RETRYABLE_BACKOFF_MS = 5 * 60 * 1_000;
const MAX_RETRY_AFTER_MS = 60 * 60 * 1_000;
export const GOOGLE_CALENDAR_MIN_SYNC_INTERVAL_MS = 30 * 1_000;

export class GoogleCalendarService {
  private lastValidatedBatch: CalendarSyncBatch | undefined;
  private lastFailure: CachedFailure | undefined;
  private inFlight: Promise<CalendarReadResult> | undefined;
  private generation = 0;
  private lastAttemptAt: number | undefined;

  constructor(private readonly source: CalendarSyncSource) {}

  /** Returns local state only. It never invokes the provider source. */
  peek(now: Date): CalendarReadResult | undefined {
    if (this.lastFailure) return this.failureView(this.lastFailure);
    if (!this.lastValidatedBatch) return undefined;

    if (now.getTime() < Date.parse(this.lastValidatedBatch.staleAfter)) {
      return this.freshView(this.lastValidatedBatch, true);
    }

    return {
      status: "stale",
      batch: this.lastValidatedBatch,
      failure: {
        code: "refresh_required",
        message:
          "Calendar context is stale. Choose Refresh now to request a new bounded read.",
        retryable: true,
      },
      fromCache: true,
      nextSyncEligibleAt: new Date(
        this.lastAttemptAt === undefined
          ? now.getTime()
          : this.lastAttemptAt + GOOGLE_CALENDAR_MIN_SYNC_INTERVAL_MS,
      ).toISOString(),
    };
  }

  async read(
    now: Date,
    options: { force?: boolean } = {},
  ): Promise<CalendarReadResult> {
    if (this.lastFailure && now.getTime() < this.lastFailure.retryAt) {
      return this.failureView(this.lastFailure);
    }

    if (
      !options.force &&
      this.lastValidatedBatch &&
      now.getTime() < Date.parse(this.lastValidatedBatch.staleAfter)
    ) {
      return this.freshView(this.lastValidatedBatch, true);
    }

    if (
      options.force &&
      this.lastValidatedBatch &&
      this.lastAttemptAt !== undefined &&
      now.getTime() < this.lastAttemptAt + GOOGLE_CALENDAR_MIN_SYNC_INTERVAL_MS
    ) {
      return this.freshView(this.lastValidatedBatch, true);
    }

    if (this.inFlight) return this.inFlight;

    const generation = this.generation;
    const pending = this.refresh(now, generation).finally(() => {
      if (this.inFlight === pending) this.inFlight = undefined;
    });
    this.inFlight = pending;
    return pending;
  }

  clear(): void {
    this.generation += 1;
    this.lastValidatedBatch = undefined;
    this.lastFailure = undefined;
    this.inFlight = undefined;
    this.lastAttemptAt = undefined;
  }

  private async refresh(
    now: Date,
    generation: number,
  ): Promise<CalendarReadResult> {
    this.lastAttemptAt = now.getTime();
    let result;
    try {
      result = await this.source.sync(now);
    } catch {
      result = {
        ok: false as const,
        failure: {
          code: "provider_unavailable" as const,
          message: "Google Calendar synchronization failed safely.",
          retryable: true,
        },
      };
    }
    if (generation !== this.generation) {
      const retryAt = now.getTime() + NON_RETRYABLE_BACKOFF_MS;
      return {
        status: "reauthorization_required",
        failure: {
          code: "authentication_required",
          message: "The Calendar connection changed before sync completed.",
          retryable: false,
        },
        fromCache: false,
        nextSyncEligibleAt: new Date(retryAt).toISOString(),
      };
    }

    if (result.ok) {
      this.lastValidatedBatch = result.batch;
      this.lastFailure = undefined;
      return this.freshView(result.batch, false);
    }

    const providerDelay = Math.min(
      (result.failure.retryAfterSeconds ?? 0) * 1_000,
      MAX_RETRY_AFTER_MS,
    );
    const backoff = result.failure.retryable
      ? Math.max(DEFAULT_FAILURE_BACKOFF_MS, providerDelay)
      : NON_RETRYABLE_BACKOFF_MS;
    this.lastFailure = {
      failure: result.failure,
      retryAt: now.getTime() + backoff,
    };
    return this.failureView(this.lastFailure);
  }

  private freshView(
    batch: CalendarSyncBatch,
    fromCache: boolean,
  ): CalendarReadResult {
    return {
      status: "fresh",
      batch,
      fromCache,
      nextSyncEligibleAt: new Date(
        (this.lastAttemptAt ?? Date.parse(batch.retrievedAt)) +
          GOOGLE_CALENDAR_MIN_SYNC_INTERVAL_MS,
      ).toISOString(),
    };
  }

  private failureView(cached: CachedFailure): CalendarReadResult {
    const nextSyncEligibleAt = new Date(cached.retryAt).toISOString();
    const authorizationFailed =
      cached.failure.code === "authentication_required" ||
      cached.failure.code === "authorization_denied" ||
      cached.failure.code === "insufficient_scope";

    if (authorizationFailed) {
      return {
        status: "reauthorization_required",
        failure: cached.failure,
        fromCache: false,
        nextSyncEligibleAt,
      };
    }

    if (this.lastValidatedBatch) {
      return {
        status: "stale",
        batch: this.lastValidatedBatch,
        failure: cached.failure,
        fromCache: true,
        nextSyncEligibleAt,
      };
    }

    const status =
      cached.failure.code === "rate_limited" ? "rate_limited" : "unavailable";

    return {
      status,
      failure: cached.failure,
      fromCache: false,
      nextSyncEligibleAt,
    };
  }
}
