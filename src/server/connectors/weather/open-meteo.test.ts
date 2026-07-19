import { describe, expect, it, vi } from "vitest";

import {
  OPEN_METEO_FORECAST_ENDPOINT,
  WEATHER_LOCATION_LABEL,
  createWeatherConnector,
  mapWmoWeatherCode,
  resolveWeatherMode,
} from "./index";

const NOW = new Date("2026-07-18T16:00:00.000Z");

function validProviderBody(): unknown {
  return {
    latitude: 40,
    longitude: -83,
    utc_offset_seconds: 0,
    timezone: "GMT",
    current_units: {
      time: "iso8601",
      interval: "seconds",
      temperature_2m: "°F",
      apparent_temperature: "°F",
      relative_humidity_2m: "%",
      precipitation: "inch",
      weather_code: "wmo code",
      wind_speed_10m: "mp/h",
      wind_gusts_10m: "mp/h",
      is_day: "",
    },
    current: {
      time: "2026-07-18T16:00",
      interval: 900,
      temperature_2m: 78.2,
      apparent_temperature: 80.1,
      relative_humidity_2m: 62,
      precipitation: 0,
      weather_code: 2,
      wind_speed_10m: 7.4,
      wind_gusts_10m: 14.1,
      is_day: 1,
    },
    hourly: {
      time: ["2026-07-18T17:00", "2026-07-18T18:00"],
      temperature_2m: [79, 78],
      precipitation_probability: [12, 18],
      weather_code: [2, 3],
    },
    hourly_units: {
      time: "iso8601",
      temperature_2m: "°F",
      precipitation_probability: "%",
      weather_code: "wmo code",
    },
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("weather connector mode selection", () => {
  it("resolves an omitted mode to fixture", () => {
    expect(resolveWeatherMode(undefined)).toEqual({
      ok: true,
      mode: "fixture",
    });
  });

  it("serves fixture data without making a network request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const connector = createWeatherConnector({
      mode: "fixture",
      fetchImpl,
    });

    const result = await connector.sync({ now: NOW });

    expect(result.ok).toBe(true);
    expect(connector.mode).toBe("fixture");
    expect(fetchImpl).not.toHaveBeenCalled();
    if (!result.ok) throw new Error("Expected fixture sync to succeed");
    expect(result.records).toHaveLength(1);
    expect(result.records[0].payload.locationLabel).toBe(
      WEATHER_LOCATION_LABEL,
    );
    expect(
      Math.max(
        ...result.records[0].payload.hourly.map(
          (point) => point.precipitationProbabilityPercent,
        ),
      ),
    ).toBeGreaterThanOrEqual(70);
  });

  it("fails closed when the configured mode is invalid", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const connector = createWeatherConnector({
      mode: "automatic",
      fetchImpl,
    });

    const result = await connector.sync({ now: NOW });

    expect(connector.mode).toBe("fixture");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      health: "misconfigured",
      failure: {
        code: "configuration_required",
        retryable: false,
      },
    });
  });
});

describe("live Open-Meteo connector", () => {
  it("requests only the fixed endpoint and returns a normalized SourceRecord", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(validProviderBody()));
    const connector = createWeatherConnector({ mode: "live", fetchImpl });

    const result = await connector.sync({ now: NOW });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [requested, init] = fetchImpl.mock.calls[0];
    const requestedUrl = new URL(String(requested));
    expect(`${requestedUrl.origin}${requestedUrl.pathname}`).toBe(
      OPEN_METEO_FORECAST_ENDPOINT,
    );
    expect(requestedUrl.searchParams.get("latitude")).toBe("40");
    expect(requestedUrl.searchParams.get("longitude")).toBe("-83");
    expect(requestedUrl.searchParams.get("timezone")).toBe("UTC");
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected live sync to succeed");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      connectorId: "weather.open-meteo",
      schemaVersion: "1",
      observedAt: "2026-07-18T16:00:00.000Z",
      retrievedAt: NOW.toISOString(),
      staleAfter: "2026-07-18T16:15:00.000Z",
      payload: {
        locationLabel: WEATHER_LOCATION_LABEL,
        condition: "Partly cloudy",
        temperatureF: 78.2,
        modeled: true,
      },
    });
  });

  it("classifies request timeouts without retrying", async () => {
    const timeout = Object.assign(new Error("timed out"), {
      name: "TimeoutError",
    });
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(timeout);
    const connector = createWeatherConnector({ mode: "live", fetchImpl });

    const result = await connector.sync({ now: NOW });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: false,
      failure: { code: "timeout", retryable: true },
    });
  });

  it("classifies HTTP 429 and preserves a numeric retry delay", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({}, 429, { "retry-after": "120" }));
    const connector = createWeatherConnector({ mode: "live", fetchImpl });

    const result = await connector.sync({ now: NOW });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: false,
      failure: {
        code: "rate_limited",
        retryable: true,
        retryAfterSeconds: 120,
      },
    });
  });

  it("parses an HTTP-date retry delay", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({}, 429, {
        "retry-after": new Date(NOW.getTime() + 120_000).toUTCString(),
      }),
    );
    const connector = createWeatherConnector({ mode: "live", fetchImpl });

    const result = await connector.sync({ now: NOW });

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "rate_limited", retryAfterSeconds: 120 },
    });
  });

  it("classifies provider 5xx failures without retrying", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({}, 503, { "retry-after": "45" }));
    const connector = createWeatherConnector({ mode: "live", fetchImpl });

    const result = await connector.sync({ now: NOW });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: false,
      failure: {
        code: "provider_unavailable",
        retryable: true,
        retryAfterSeconds: 45,
      },
    });
  });

  it("accepts the provider's current-hour forecast bucket after half past", async () => {
    const body = validProviderBody() as {
      current: { time: string };
      hourly: { time: string[] };
    };
    body.current.time = "2026-07-18T16:45";
    body.hourly.time = ["2026-07-18T16:00", "2026-07-18T17:00"];
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(body));

    const result = await createWeatherConnector({
      mode: "live",
      fetchImpl,
    }).sync({ now: new Date("2026-07-18T16:45:00.000Z") });

    expect(result.ok).toBe(true);
  });

  it("rejects malformed provider data instead of partially normalizing it", async () => {
    const body = validProviderBody() as {
      hourly: { precipitation_probability: unknown[] };
    };
    body.hourly.precipitation_probability[0] = "likely";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(body));
    const connector = createWeatherConnector({ mode: "live", fetchImpl });

    const result = await connector.sync({ now: NOW });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: false,
      failure: { code: "invalid_response", retryable: false },
    });
  });

  it("rejects a response body that exceeds the connector byte limit", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ padding: "x".repeat(140_000) }));

    const result = await createWeatherConnector({
      mode: "live",
      fetchImpl,
    }).sync({ now: NOW });

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "invalid_response", retryable: false },
    });
  });

  it("rejects unexpected units instead of mislabeling provider values", async () => {
    const body = validProviderBody() as {
      current_units: { temperature_2m: string };
    };
    body.current_units.temperature_2m = "°C";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(body));

    const result = await createWeatherConnector({
      mode: "live",
      fetchImpl,
    }).sync({ now: NOW });

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "invalid_response" },
    });
  });

  it("rejects a response for a different location", async () => {
    const body = validProviderBody() as { latitude: number };
    body.latitude = 45;
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(body));

    const result = await createWeatherConnector({
      mode: "live",
      fetchImpl,
    }).sync({ now: NOW });

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "invalid_response" },
    });
  });

  it("rejects implausibly old current conditions", async () => {
    const body = validProviderBody() as { current: { time: string } };
    body.current.time = "2026-07-18T12:00";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(body));

    const result = await createWeatherConnector({
      mode: "live",
      fetchImpl,
    }).sync({ now: NOW });

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "invalid_response" },
    });
  });

  it("treats the exact observation-age boundary as invalid", async () => {
    const body = validProviderBody() as { current: { time: string } };
    body.current.time = "2026-07-18T15:30";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(body));

    const result = await createWeatherConnector({
      mode: "live",
      fetchImpl,
    }).sync({ now: NOW });

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "invalid_response" },
    });
  });

  it("rejects an hourly forecast with no current or future point", async () => {
    const body = validProviderBody() as {
      hourly: { time: string[] };
    };
    body.hourly.time = ["2026-07-18T14:00", "2026-07-18T15:00"];
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(body));

    const result = await createWeatherConnector({
      mode: "live",
      fetchImpl,
    }).sync({ now: NOW });

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "invalid_response" },
    });
  });

  it("rejects unordered or duplicate forecast points", async () => {
    const body = validProviderBody() as {
      hourly: { time: string[] };
    };
    body.hourly.time = ["2026-07-18T18:00", "2026-07-18T17:00"];
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(body));

    const result = await createWeatherConnector({
      mode: "live",
      fetchImpl,
    }).sync({ now: NOW });

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "invalid_response" },
    });
  });

  it("classifies a timeout while reading the response body", async () => {
    const timeout = Object.assign(new Error("timed out"), {
      name: "TimeoutError",
    });
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(timeout);
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);

    const result = await createWeatherConnector({
      mode: "live",
      fetchImpl,
    }).sync({ now: NOW });

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "timeout", retryable: true },
    });
  });
});

describe("WMO condition mapping", () => {
  it.each([
    [0, "Clear sky"],
    [48, "Fog"],
    [63, "Moderate rain"],
    [86, "Snow showers"],
    [99, "Thunderstorm with hail"],
    [42, "Unrecognized conditions"],
  ])("maps code %i to %s", (code, condition) => {
    expect(mapWmoWeatherCode(code)).toBe(condition);
  });
});
