import { describe, expect, it, vi } from "vitest";
import type {
  ConnectorSyncResult,
  ContextConnector,
  WeatherReading,
} from "@/domain/orbit/connectors";
import { createFixtureWeatherRecord } from "./fixture";
import { WeatherConnectorService } from "./service";

const NOW = new Date("2026-07-18T16:00:00.000Z");

function connectorWith(
  sync: ContextConnector<WeatherReading>["sync"],
): ContextConnector<WeatherReading> {
  return { id: "weather.test", mode: "live", sync };
}

describe("WeatherConnectorService", () => {
  it("uses a fresh in-memory record for fifteen minutes", async () => {
    const record = createFixtureWeatherRecord(NOW);
    const sync = vi.fn(
      async (): Promise<ConnectorSyncResult<WeatherReading>> => ({
        ok: true,
        mode: "live",
        health: "connected",
        records: [record],
        cursor: {
          connectorId: "weather.test",
          syncedThrough: record.retrievedAt,
        },
      }),
    );
    const service = new WeatherConnectorService(connectorWith(sync));

    const first = await service.read(NOW);
    const second = await service.read(
      new Date(NOW.getTime() + 14 * 60 * 1_000),
    );

    expect(first.status).toBe("fresh");
    expect(second).toMatchObject({ status: "fresh", fromCache: true });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("returns the last valid record as stale after a provider failure", async () => {
    const record = createFixtureWeatherRecord(NOW);
    const sync = vi
      .fn<ContextConnector<WeatherReading>["sync"]>()
      .mockResolvedValueOnce({
        ok: true,
        mode: "live",
        health: "connected",
        records: [record],
        cursor: {
          connectorId: "weather.test",
          syncedThrough: record.retrievedAt,
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        mode: "live",
        health: "unavailable",
        records: [],
        failure: {
          code: "timeout",
          message: "Weather timed out.",
          retryable: true,
        },
      });
    const service = new WeatherConnectorService(connectorWith(sync));

    await service.read(NOW);
    const result = await service.read(
      new Date(NOW.getTime() + 15 * 60 * 1_000),
    );

    expect(result).toMatchObject({
      status: "stale",
      record: { id: record.id },
      failure: { code: "timeout" },
    });
    await service.read(new Date(NOW.getTime() + 15 * 60 * 1_000 + 10_000));
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("keeps a validated fallback when a later refresh is malformed", async () => {
    const record = createFixtureWeatherRecord(NOW);
    const sync = vi
      .fn<ContextConnector<WeatherReading>["sync"]>()
      .mockResolvedValueOnce({
        ok: true,
        mode: "live",
        health: "connected",
        records: [record],
        cursor: {
          connectorId: "weather.test",
          syncedThrough: record.retrievedAt,
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        mode: "live",
        health: "unavailable",
        records: [],
        failure: {
          code: "invalid_response",
          message: "Weather returned invalid data.",
          retryable: false,
        },
      });
    const service = new WeatherConnectorService(connectorWith(sync));

    await service.read(NOW);
    const result = await service.read(
      new Date(NOW.getTime() + 15 * 60 * 1_000),
    );

    expect(result).toMatchObject({
      status: "stale",
      record: { id: record.id },
      failure: { code: "invalid_response" },
    });
  });

  it("does not invent stale data when no valid record exists", async () => {
    const sync = vi.fn(async () => ({
      ok: false as const,
      mode: "live" as const,
      health: "unavailable" as const,
      records: [] as [],
      failure: {
        code: "provider_unavailable" as const,
        message: "Weather is unavailable.",
        retryable: true,
      },
    }));
    const service = new WeatherConnectorService(connectorWith(sync));

    const result = await service.read(NOW);
    await service.read(new Date(NOW.getTime() + 10_000));

    expect(result.status).toBe("unavailable");
    expect("record" in result).toBe(false);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent refreshes into one provider request", async () => {
    let resolveSync:
      ((result: ConnectorSyncResult<WeatherReading>) => void) | undefined;
    const sync = vi.fn(
      () =>
        new Promise<ConnectorSyncResult<WeatherReading>>((resolve) => {
          resolveSync = resolve;
        }),
    );
    const service = new WeatherConnectorService(connectorWith(sync));

    const first = service.read(NOW);
    const second = service.read(NOW);
    const record = createFixtureWeatherRecord(NOW);
    resolveSync?.({
      ok: true,
      mode: "live",
      health: "connected",
      records: [record],
      cursor: {
        connectorId: "weather.test",
        syncedThrough: record.retrievedAt,
      },
    });

    await expect(first).resolves.toMatchObject({ status: "fresh" });
    await expect(second).resolves.toMatchObject({ status: "fresh" });
    expect(sync).toHaveBeenCalledTimes(1);
  });
});
