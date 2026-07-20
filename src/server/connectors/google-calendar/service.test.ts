import { describe, expect, it, vi } from "vitest";

import { createFixtureCalendarBatch } from "./fixture";
import { GoogleCalendarService } from "./service";
import type { CalendarSyncSource } from "./types";

const NOW = new Date("2026-07-19T16:00:00.000Z");

describe("GoogleCalendarService", () => {
  it("caches a validated batch for five minutes", async () => {
    const sync = vi.fn(async (now: Date) => ({
      ok: true as const,
      batch: createFixtureCalendarBatch(now),
    }));
    const service = new GoogleCalendarService({ sync });

    const first = await service.read(NOW);
    const second = await service.read(
      new Date(NOW.getTime() + 4 * 60 * 1_000 + 59_000),
    );

    expect(first).toMatchObject({ status: "fresh", fromCache: false });
    expect(second).toMatchObject({ status: "fresh", fromCache: true });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("refreshes at the exact freshness boundary", async () => {
    const sync = vi.fn(async (now: Date) => ({
      ok: true as const,
      batch: createFixtureCalendarBatch(now),
    }));
    const service = new GoogleCalendarService({ sync });

    await service.read(NOW);
    await service.read(new Date(NOW.getTime() + 5 * 60 * 1_000));

    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent refreshes into a single provider call", async () => {
    let resolve:
      | ((value: Awaited<ReturnType<CalendarSyncSource["sync"]>>) => void)
      | undefined;
    const sync = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<CalendarSyncSource["sync"]>>>((done) => {
          resolve = done;
        }),
    );
    const service = new GoogleCalendarService({ sync });

    const first = service.read(NOW);
    const second = service.read(NOW);
    resolve?.({ ok: true, batch: createFixtureCalendarBatch(NOW) });

    await expect(first).resolves.toMatchObject({ status: "fresh" });
    await expect(second).resolves.toMatchObject({ status: "fresh" });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("returns the last validated batch as stale after a failed refresh", async () => {
    const sync = vi
      .fn<CalendarSyncSource["sync"]>()
      .mockResolvedValueOnce({
        ok: true,
        batch: createFixtureCalendarBatch(NOW),
      })
      .mockResolvedValueOnce({
        ok: false,
        failure: {
          code: "provider_unavailable",
          message: "Calendar is unavailable.",
          retryable: true,
        },
      });
    const service = new GoogleCalendarService({ sync });
    await service.read(NOW);

    const result = await service.read(new Date(NOW.getTime() + 5 * 60 * 1_000));

    expect(result).toMatchObject({
      status: "stale",
      fromCache: true,
      failure: { code: "provider_unavailable" },
      batch: { records: expect.any(Array) },
    });
  });

  it("peeks at cached state without invoking the provider", async () => {
    const sync = vi.fn(async (now: Date) => ({
      ok: true as const,
      batch: createFixtureCalendarBatch(now),
    }));
    const service = new GoogleCalendarService({ sync });

    expect(service.peek(NOW)).toBeUndefined();
    await service.read(NOW);
    const stale = service.peek(new Date(NOW.getTime() + 5 * 60 * 1_000));

    expect(stale).toMatchObject({
      status: "stale",
      fromCache: true,
      failure: { code: "refresh_required" },
    });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("never masks an authorization failure with a stale batch", async () => {
    const sync = vi
      .fn<CalendarSyncSource["sync"]>()
      .mockResolvedValueOnce({
        ok: true,
        batch: createFixtureCalendarBatch(NOW),
      })
      .mockResolvedValueOnce({
        ok: false,
        failure: {
          code: "authentication_required",
          message: "Reconnect.",
          retryable: false,
        },
      });
    const service = new GoogleCalendarService({ sync });
    await service.read(NOW);

    const result = await service.read(new Date(NOW.getTime() + 5 * 60 * 1_000));

    expect(result).toMatchObject({
      status: "reauthorization_required",
      fromCache: false,
    });
    expect("batch" in result).toBe(false);
  });

  it("honors a capped provider backoff and does not retry inside it", async () => {
    const sync = vi.fn(async () => ({
      ok: false as const,
      failure: {
        code: "rate_limited" as const,
        message: "Slow down.",
        retryable: true,
        retryAfterSeconds: 99_999,
      },
    }));
    const service = new GoogleCalendarService({ sync });

    const first = await service.read(NOW);
    const second = await service.read(new Date(NOW.getTime() + 3_599_000));

    expect(first).toMatchObject({
      status: "rate_limited",
      nextSyncEligibleAt: "2026-07-19T17:00:00.000Z",
    });
    expect(second.status).toBe("rate_limited");
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("maps expired authorization and never invents cached data", async () => {
    const sync = vi.fn(async () => ({
      ok: false as const,
      failure: {
        code: "authentication_required" as const,
        message: "Reconnect.",
        retryable: false,
      },
    }));
    const service = new GoogleCalendarService({ sync });

    const result = await service.read(NOW);

    expect(result).toMatchObject({
      status: "reauthorization_required",
      fromCache: false,
    });
    expect("batch" in result).toBe(false);
  });

  it("contains unexpected source failures without leaking exception details", async () => {
    const sync = vi.fn(async () => {
      throw new Error("access-token-secret");
    });
    const service = new GoogleCalendarService({ sync });

    const result = await service.read(NOW);

    expect(result).toMatchObject({
      status: "unavailable",
      failure: {
        code: "provider_unavailable",
        message: "Google Calendar synchronization failed safely.",
      },
    });
    expect(JSON.stringify(result)).not.toContain("access-token-secret");
  });

  it("allows a forced refresh but still respects a recorded rate limit", async () => {
    const sync = vi
      .fn<CalendarSyncSource["sync"]>()
      .mockResolvedValueOnce({
        ok: true,
        batch: createFixtureCalendarBatch(NOW),
      })
      .mockResolvedValueOnce({
        ok: false,
        failure: {
          code: "rate_limited",
          message: "Slow down.",
          retryable: true,
          retryAfterSeconds: 120,
        },
      });
    const service = new GoogleCalendarService({ sync });

    await service.read(NOW);
    const forced = await service.read(new Date(NOW.getTime() + 31_000), {
      force: true,
    });
    await service.read(new Date(NOW.getTime() + 60_000), { force: true });

    expect(forced).toMatchObject({ status: "stale" });
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("locally throttles repeated successful forced refreshes", async () => {
    const sync = vi.fn(async (now: Date) => ({
      ok: true as const,
      batch: createFixtureCalendarBatch(now),
    }));
    const service = new GoogleCalendarService({ sync });

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

  it("clears all in-memory state on disconnect", async () => {
    const sync = vi.fn(async (now: Date) => ({
      ok: true as const,
      batch: createFixtureCalendarBatch(now),
    }));
    const service = new GoogleCalendarService({ sync });
    await service.read(NOW);

    service.clear();
    await service.read(new Date(NOW.getTime() + 1_000));

    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("does not repopulate the cache when disconnect races an in-flight sync", async () => {
    let resolve:
      | ((value: Awaited<ReturnType<CalendarSyncSource["sync"]>>) => void)
      | undefined;
    const sync = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<CalendarSyncSource["sync"]>>>((done) => {
          resolve = done;
        }),
    );
    const service = new GoogleCalendarService({ sync });

    const pending = service.read(NOW);
    service.clear();
    resolve?.({ ok: true, batch: createFixtureCalendarBatch(NOW) });

    await expect(pending).resolves.toMatchObject({
      status: "reauthorization_required",
      fromCache: false,
    });
    expect("batch" in (await pending)).toBe(false);
  });
});
