import type { ConnectorFailure } from "@/domain/orbit/connectors";
import type { GoogleNestSyncBatch, GoogleNestSyncSource } from "./types";

export const GOOGLE_NEST_MIN_SYNC_INTERVAL_MS = 30_000;
type ReadResult =
  | {
      status: "fresh";
      batch: GoogleNestSyncBatch;
      nextSyncEligibleAt: string;
      fromCache: boolean;
    }
  | {
      status: "stale";
      batch: GoogleNestSyncBatch;
      failure: ConnectorFailure;
      nextSyncEligibleAt: string;
      fromCache: true;
    }
  | {
      status: "rate_limited" | "reauthorization_required" | "unavailable";
      failure: ConnectorFailure;
      nextSyncEligibleAt: string;
      fromCache: false;
    };

export class GoogleNestService {
  private batch?: GoogleNestSyncBatch;
  private failure?: { value: ConnectorFailure; retryAt: number };
  private inFlight?: Promise<ReadResult>;
  private lastAttempt?: number;
  private generation = 0;

  constructor(private readonly source: GoogleNestSyncSource) {}

  peek(now: Date): ReadResult | undefined {
    if (this.failure && now.getTime() < this.failure.retryAt)
      return this.failureResult(this.failure);
    if (!this.batch) return undefined;
    if (now.getTime() < Date.parse(this.batch.staleAfter))
      return this.fresh(this.batch, true);
    return {
      status: "stale",
      batch: this.batch,
      failure: {
        code: "refresh_required",
        message: "Google Nest context is stale. Choose Refresh now.",
        retryable: true,
      },
      nextSyncEligibleAt: new Date(
        this.lastAttempt ?? now.getTime(),
      ).toISOString(),
      fromCache: true,
    };
  }

  async read(now: Date, force = false): Promise<ReadResult> {
    if (this.failure && now.getTime() < this.failure.retryAt)
      return this.failureResult(this.failure);
    if (
      !force &&
      this.batch &&
      now.getTime() < Date.parse(this.batch.staleAfter)
    )
      return this.fresh(this.batch, true);
    if (
      force &&
      this.batch &&
      this.lastAttempt &&
      now.getTime() < this.lastAttempt + GOOGLE_NEST_MIN_SYNC_INTERVAL_MS
    )
      return this.fresh(this.batch, true);
    if (this.inFlight) return this.inFlight;
    const generation = this.generation;
    const pending = this.refresh(now, generation).finally(() => {
      if (this.inFlight === pending) this.inFlight = undefined;
    });
    this.inFlight = pending;
    return pending;
  }

  clear(): void {
    this.generation++;
    this.batch = undefined;
    this.failure = undefined;
    this.inFlight = undefined;
    this.lastAttempt = undefined;
  }

  currentBatch(): GoogleNestSyncBatch | undefined {
    return this.batch;
  }

  private async refresh(now: Date, generation: number): Promise<ReadResult> {
    this.lastAttempt = now.getTime();
    const result = await this.source.sync(now).catch(() => ({
      ok: false as const,
      failure: {
        code: "provider_unavailable" as const,
        message: "Google Nest synchronization failed safely.",
        retryable: true,
        retryAfterSeconds: undefined,
      },
    }));
    if (generation !== this.generation)
      return {
        status: "reauthorization_required",
        failure: {
          code: "authentication_required",
          message: "The Google Nest connection changed during synchronization.",
          retryable: false,
        },
        nextSyncEligibleAt: new Date(now.getTime() + 300_000).toISOString(),
        fromCache: false,
      };
    if (result.ok) {
      this.batch = result.batch;
      this.failure = undefined;
      return this.fresh(result.batch, false);
    }
    const retryAt =
      now.getTime() +
      Math.max(
        30_000,
        Math.min(3_600_000, (result.failure.retryAfterSeconds ?? 0) * 1000),
      );
    this.failure = { value: result.failure, retryAt };
    return this.failureResult(this.failure);
  }

  private fresh(batch: GoogleNestSyncBatch, fromCache: boolean): ReadResult {
    return {
      status: "fresh",
      batch,
      fromCache,
      nextSyncEligibleAt: new Date(
        (this.lastAttempt ?? Date.parse(batch.retrievedAt)) +
          GOOGLE_NEST_MIN_SYNC_INTERVAL_MS,
      ).toISOString(),
    };
  }

  private failureResult(failure: {
    value: ConnectorFailure;
    retryAt: number;
  }): ReadResult {
    return {
      status:
        failure.value.code === "rate_limited"
          ? "rate_limited"
          : failure.value.code === "authentication_required"
            ? "reauthorization_required"
            : "unavailable",
      failure: failure.value,
      nextSyncEligibleAt: new Date(failure.retryAt).toISOString(),
      fromCache: false,
    };
  }
}
