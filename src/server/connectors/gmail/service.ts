import type {
  GmailConnectorFailure,
  GmailSyncBatch,
  GmailSyncSource,
} from "./types";

export type GmailReadResult =
  | {
      status: "fresh";
      batch: GmailSyncBatch;
      fromCache: boolean;
      nextSyncEligibleAt: string;
    }
  | {
      status: "stale";
      batch: GmailSyncBatch;
      failure: GmailConnectorFailure;
      fromCache: true;
      nextSyncEligibleAt: string;
    }
  | {
      status: "rate_limited" | "reauthorization_required" | "unavailable";
      failure: GmailConnectorFailure;
      fromCache: false;
      nextSyncEligibleAt: string;
    };

const DEFAULT_FAILURE_BACKOFF_MS = 30 * 1_000;
const NON_RETRYABLE_BACKOFF_MS = 5 * 60 * 1_000;
const MAX_RETRY_AFTER_MS = 60 * 60 * 1_000;
export const GMAIL_MIN_SYNC_INTERVAL_MS = 30 * 1_000;

interface CachedFailure {
  failure: GmailConnectorFailure;
  retryAt: number;
}

export class GmailService {
  private lastValidatedBatch: GmailSyncBatch | undefined;
  private lastFailure: CachedFailure | undefined;
  private inFlight: Promise<GmailReadResult> | undefined;
  private generation = 0;
  private lastAttemptAt: number | undefined;

  constructor(private readonly source: GmailSyncSource) {}

  peek(now: Date): GmailReadResult | undefined {
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
          "Gmail context is stale. Choose Refresh now to request a new bounded read.",
        retryable: true,
      },
      fromCache: true,
      nextSyncEligibleAt: new Date(
        this.lastAttemptAt === undefined
          ? now.getTime()
          : this.lastAttemptAt + GMAIL_MIN_SYNC_INTERVAL_MS,
      ).toISOString(),
    };
  }

  async read(
    now: Date,
    options: { force?: boolean } = {},
  ): Promise<GmailReadResult> {
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
      now.getTime() < this.lastAttemptAt + GMAIL_MIN_SYNC_INTERVAL_MS
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
  ): Promise<GmailReadResult> {
    this.lastAttemptAt = now.getTime();
    let result;
    try {
      result = await this.source.sync(now);
    } catch {
      result = {
        ok: false as const,
        failure: {
          code: "provider_unavailable" as const,
          message: "Gmail synchronization failed safely.",
          retryable: true,
        },
      };
    }
    if (generation !== this.generation) {
      return {
        status: "reauthorization_required",
        failure: {
          code: "authentication_required",
          message: "The Gmail connection changed before sync completed.",
          retryable: false,
        },
        fromCache: false,
        nextSyncEligibleAt: new Date(
          now.getTime() + NON_RETRYABLE_BACKOFF_MS,
        ).toISOString(),
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
    this.lastFailure = {
      failure: result.failure,
      retryAt:
        now.getTime() +
        (result.failure.retryable
          ? Math.max(DEFAULT_FAILURE_BACKOFF_MS, providerDelay)
          : NON_RETRYABLE_BACKOFF_MS),
    };
    return this.failureView(this.lastFailure);
  }

  private freshView(
    batch: GmailSyncBatch,
    fromCache: boolean,
  ): GmailReadResult {
    return {
      status: "fresh",
      batch,
      fromCache,
      nextSyncEligibleAt: new Date(
        (this.lastAttemptAt ?? Date.parse(batch.retrievedAt)) +
          GMAIL_MIN_SYNC_INTERVAL_MS,
      ).toISOString(),
    };
  }

  private failureView(cached: CachedFailure): GmailReadResult {
    const nextSyncEligibleAt = new Date(cached.retryAt).toISOString();
    if (
      cached.failure.code === "authentication_required" ||
      cached.failure.code === "authorization_denied" ||
      cached.failure.code === "insufficient_scope"
    ) {
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
    return {
      status:
        cached.failure.code === "rate_limited" ? "rate_limited" : "unavailable",
      failure: cached.failure,
      fromCache: false,
      nextSyncEligibleAt,
    };
  }
}
