import { describe, expect, it, vi } from "vitest";

import { createFixtureGmailBatch } from "./fixture";
import { GmailService } from "./service";
import type { GmailSyncSource } from "./types";

const NOW = new Date("2026-07-19T16:00:00.000Z");

describe("GmailService", () => {
  it("caches a validated batch until the exact freshness boundary", async () => {
    const sync = vi.fn(async (now: Date) => ({
      ok: true as const,
      batch: createFixtureGmailBatch(now),
    }));
    const service = new GmailService({ sync });

    const first = await service.read(NOW);
    const cached = await service.read(
      new Date(NOW.getTime() + 5 * 60 * 1_000 - 1),
    );
    const refreshed = await service.read(
      new Date(NOW.getTime() + 5 * 60 * 1_000),
    );

    expect(first).toMatchObject({ status: "fresh", fromCache: false });
    expect(cached).toMatchObject({ status: "fresh", fromCache: true });
    expect(refreshed).toMatchObject({ status: "fresh", fromCache: false });
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent refreshes into one source call", async () => {
    let resolve:
      | ((value: Awaited<ReturnType<GmailSyncSource["sync"]>>) => void)
      | undefined;
    const sync = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<GmailSyncSource["sync"]>>>((done) => {
          resolve = done;
        }),
    );
    const service = new GmailService({ sync });

    const first = service.read(NOW);
    const second = service.read(NOW);
    resolve?.({ ok: true, batch: createFixtureGmailBatch(NOW) });

    await expect(first).resolves.toMatchObject({ status: "fresh" });
    await expect(second).resolves.toMatchObject({ status: "fresh" });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("returns the last validated batch as stale after a retryable failure", async () => {
    const sync = vi
      .fn<GmailSyncSource["sync"]>()
      .mockResolvedValueOnce({
        ok: true,
        batch: createFixtureGmailBatch(NOW),
      })
      .mockResolvedValueOnce({
        ok: false,
        failure: {
          code: "provider_unavailable",
          message: "Gmail is unavailable.",
          retryable: true,
        },
      });
    const service = new GmailService({ sync });
    await service.read(NOW);

    const result = await service.read(new Date(NOW.getTime() + 300_000));

    expect(result).toMatchObject({
      status: "stale",
      fromCache: true,
      failure: { code: "provider_unavailable" },
      batch: { records: expect.any(Array) },
    });
  });

  it("peeks without invoking the provider and marks expired cache stale", async () => {
    const sync = vi.fn(async (now: Date) => ({
      ok: true as const,
      batch: createFixtureGmailBatch(now),
    }));
    const service = new GmailService({ sync });

    expect(service.peek(NOW)).toBeUndefined();
    await service.read(NOW);
    const stale = service.peek(new Date(NOW.getTime() + 300_000));

    expect(stale).toMatchObject({
      status: "stale",
      fromCache: true,
      failure: { code: "refresh_required" },
    });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("never masks an authorization failure with stale email", async () => {
    const sync = vi
      .fn<GmailSyncSource["sync"]>()
      .mockResolvedValueOnce({
        ok: true,
        batch: createFixtureGmailBatch(NOW),
      })
      .mockResolvedValueOnce({
        ok: false,
        failure: {
          code: "authentication_required",
          message: "Reconnect.",
          retryable: false,
        },
      });
    const service = new GmailService({ sync });
    await service.read(NOW);

    const result = await service.read(new Date(NOW.getTime() + 300_000));

    expect(result).toMatchObject({
      status: "reauthorization_required",
      fromCache: false,
    });
    expect("batch" in result).toBe(false);
  });

  it("caps provider retry-after and avoids requests during backoff", async () => {
    const sync = vi.fn(async () => ({
      ok: false as const,
      failure: {
        code: "rate_limited" as const,
        message: "Slow down.",
        retryable: true,
        retryAfterSeconds: 99_999,
      },
    }));
    const service = new GmailService({ sync });

    const first = await service.read(NOW);
    const second = await service.read(new Date(NOW.getTime() + 3_599_000));

    expect(first).toMatchObject({
      status: "rate_limited",
      nextSyncEligibleAt: "2026-07-19T17:00:00.000Z",
    });
    expect(second.status).toBe("rate_limited");
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("throttles successful forced refreshes for thirty seconds", async () => {
    const sync = vi.fn(async (now: Date) => ({
      ok: true as const,
      batch: createFixtureGmailBatch(now),
    }));
    const service = new GmailService({ sync });

    const first = await service.read(NOW);
    const throttled = await service.read(new Date(NOW.getTime() + 29_000), {
      force: true,
    });
    const refreshed = await service.read(new Date(NOW.getTime() + 30_000), {
      force: true,
    });

    expect(first.nextSyncEligibleAt).toBe("2026-07-19T16:00:30.000Z");
    expect(throttled).toMatchObject({ status: "fresh", fromCache: true });
    expect(refreshed).toMatchObject({ status: "fresh", fromCache: false });
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("contains unexpected source exceptions without leaking details", async () => {
    const sync = vi.fn(async () => {
      throw new Error("private-access-token");
    });
    const service = new GmailService({ sync });

    const result = await service.read(NOW);

    expect(result).toMatchObject({
      status: "unavailable",
      failure: {
        code: "provider_unavailable",
        message: "Gmail synchronization failed safely.",
      },
    });
    expect(JSON.stringify(result)).not.toContain("private-access-token");
  });

  it("does not repopulate cache when disconnect races an in-flight sync", async () => {
    let resolve:
      | ((value: Awaited<ReturnType<GmailSyncSource["sync"]>>) => void)
      | undefined;
    const sync = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<GmailSyncSource["sync"]>>>((done) => {
          resolve = done;
        }),
    );
    const service = new GmailService({ sync });

    const pending = service.read(NOW);
    service.clear();
    resolve?.({ ok: true, batch: createFixtureGmailBatch(NOW) });

    await expect(pending).resolves.toMatchObject({
      status: "reauthorization_required",
      fromCache: false,
    });
    expect("batch" in (await pending)).toBe(false);
    expect(service.peek(NOW)).toBeUndefined();
  });
});
