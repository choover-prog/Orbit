import { describe, expect, it } from "vitest";
import type { SourceRecord, WeatherReading } from "./connectors";
import { buildWeatherContextArtifacts } from "./weather-attention";

const now = new Date("2026-07-18T14:00:00.000Z");

function weatherRecord(
  overrides: Partial<WeatherReading> = {},
  staleAfter = "2026-07-18T14:15:00.000Z",
): SourceRecord<WeatherReading> {
  return {
    id: "source_weather_test",
    connectorId: "weather.open-meteo",
    schemaVersion: "1",
    externalReference: "forecast:40.00,-83.00",
    provenance: {
      sourceLabel: "Fictional weather fixture",
    },
    observedAt: now.toISOString(),
    retrievedAt: now.toISOString(),
    staleAfter,
    payload: {
      locationLabel: "Harbor City test area",
      observedAt: now.toISOString(),
      condition: "Light rain",
      weatherCode: 61,
      temperatureF: 72,
      apparentTemperatureF: 73,
      relativeHumidityPercent: 68,
      precipitationInches: 0.02,
      windSpeedMph: 8,
      windGustMph: 14,
      isDay: true,
      modeled: true,
      hourly: [
        {
          at: now.toISOString(),
          temperatureF: 72,
          precipitationProbabilityPercent: 70,
          weatherCode: 61,
        },
      ],
      ...overrides,
    },
  };
}

describe("weather attention", () => {
  it("creates one read-only attention bundle at the precipitation boundary", () => {
    const result = buildWeatherContextArtifacts(weatherRecord(), now);

    expect(result.attention?.actionability).toBe("read_only");
    expect(result.attention?.item.title).toMatch(/Precipitation is likely/i);
    expect(result.evidence.freshnessStatus).toBe("fresh");
    expect(result.evidence.attribution).toBeUndefined();
  });

  it("does not create an attention item below deterministic thresholds", () => {
    const result = buildWeatherContextArtifacts(
      weatherRecord({
        hourly: [
          {
            at: now.toISOString(),
            temperatureF: 72,
            precipitationProbabilityPercent: 69,
            weatherCode: 2,
          },
        ],
        weatherCode: 2,
        condition: "Partly cloudy",
      }),
      now,
    );

    expect(result.attention).toBeUndefined();
  });

  it("does not describe missing future coverage as a zero-percent forecast", () => {
    const result = buildWeatherContextArtifacts(
      weatherRecord({
        hourly: [
          {
            at: "2026-07-18T13:00:00.000Z",
            temperatureF: 72,
            precipitationProbabilityPercent: 90,
            weatherCode: 61,
          },
        ],
      }),
      now,
    );

    expect(result.attention).toBeUndefined();
    expect(result.evidence.summary).toMatch(/No current or future/i);
    expect(result.evidence.summary).not.toContain("0% peak");
  });

  it("treats the exact stale-after boundary as stale and suppresses attention", () => {
    const record = weatherRecord({}, now.toISOString());
    record.provenance = {
      sourceLabel: "Open-Meteo forecast",
      attribution: {
        label: "Weather data by Open-Meteo.com",
        url: "https://open-meteo.com/",
        license: "CC BY 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        transformed: true,
      },
    };
    const result = buildWeatherContextArtifacts(record, now);

    expect(result.attention).toBeUndefined();
    expect(result.evidence.freshnessStatus).toBe("stale");
    expect(result.evidence.attribution?.label).toBe(
      "Weather data by Open-Meteo.com",
    );
  });

  it("prioritizes extreme-temperature attention over precipitation", () => {
    const result = buildWeatherContextArtifacts(
      weatherRecord({ apparentTemperatureF: 101 }),
      now,
    );

    expect(result.attention?.item.title).toContain("101°F");
    expect(result.attention?.explanation).toMatch(/forecast signal/i);
  });
});
