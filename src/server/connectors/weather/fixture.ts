import type {
  ConnectorSyncRequest,
  ConnectorSyncResult,
  SourceRecord,
  WeatherReading,
} from "@/domain/orbit/connectors";

import {
  WEATHER_CONNECTOR_ID,
  WEATHER_FRESHNESS_WINDOW_MS,
  WEATHER_LOCATION_LABEL,
} from "./config";

const MINUTE_MS = 60 * 1_000;
const HOUR_MS = 60 * MINUTE_MS;

function atOffset(now: Date, offsetMs: number): string {
  return new Date(now.getTime() + offsetMs).toISOString();
}

export function createFixtureWeatherRecord(
  now: Date,
): SourceRecord<WeatherReading> {
  const observedAt = atOffset(now, -2 * MINUTE_MS);

  return {
    id: `weather.fixture.${Date.parse(observedAt)}`,
    connectorId: WEATHER_CONNECTOR_ID,
    schemaVersion: "1",
    externalReference: "fixture:weather:harbor-city",
    provenance: {
      sourceLabel: "Fictional weather fixture",
    },
    observedAt,
    retrievedAt: now.toISOString(),
    staleAfter: atOffset(now, WEATHER_FRESHNESS_WINDOW_MS),
    payload: {
      locationLabel: WEATHER_LOCATION_LABEL,
      observedAt,
      condition: "Light rain",
      weatherCode: 61,
      temperatureF: 63,
      apparentTemperatureF: 62,
      relativeHumidityPercent: 82,
      precipitationInches: 0.02,
      windSpeedMph: 8,
      windGustMph: 15,
      isDay: true,
      modeled: true,
      hourly: [
        {
          at: atOffset(now, HOUR_MS),
          temperatureF: 62,
          precipitationProbabilityPercent: 86,
          weatherCode: 61,
        },
        {
          at: atOffset(now, 2 * HOUR_MS),
          temperatureF: 61,
          precipitationProbabilityPercent: 78,
          weatherCode: 63,
        },
        {
          at: atOffset(now, 3 * HOUR_MS),
          temperatureF: 61,
          precipitationProbabilityPercent: 48,
          weatherCode: 51,
        },
        {
          at: atOffset(now, 4 * HOUR_MS),
          temperatureF: 62,
          precipitationProbabilityPercent: 20,
          weatherCode: 3,
        },
      ],
    },
  };
}

export async function syncFixtureWeather(
  request: ConnectorSyncRequest,
): Promise<ConnectorSyncResult<WeatherReading>> {
  const record = createFixtureWeatherRecord(request.now);

  return {
    ok: true,
    mode: "fixture",
    health: "connected",
    records: [record],
    cursor: {
      connectorId: WEATHER_CONNECTOR_ID,
      syncedThrough: record.retrievedAt,
    },
  };
}
