import type {
  ConnectorSyncResult,
  ContextConnector,
  WeatherReading,
} from "@/domain/orbit/connectors";

import { WEATHER_CONNECTOR_ID, resolveWeatherMode } from "./config";
import { syncFixtureWeather } from "./fixture";
import { type OpenMeteoSyncOptions, syncOpenMeteoWeather } from "./open-meteo";

export interface CreateWeatherConnectorOptions extends OpenMeteoSyncOptions {
  mode?: string;
}

export function createWeatherConnector(
  options: CreateWeatherConnectorOptions = {},
): ContextConnector<WeatherReading> {
  const modeResolution = resolveWeatherMode(
    options.mode ?? process.env.ORBIT_WEATHER_MODE,
  );

  if (!modeResolution.ok) {
    const failure = modeResolution.failure;
    return {
      id: WEATHER_CONNECTOR_ID,
      mode: "fixture",
      async sync(): Promise<ConnectorSyncResult<WeatherReading>> {
        return {
          ok: false,
          mode: "fixture",
          health: "misconfigured",
          records: [],
          failure,
        };
      },
    };
  }

  if (modeResolution.mode === "live") {
    return {
      id: WEATHER_CONNECTOR_ID,
      mode: "live",
      sync(request) {
        return syncOpenMeteoWeather(request, options);
      },
    };
  }

  return {
    id: WEATHER_CONNECTOR_ID,
    mode: "fixture",
    sync: syncFixtureWeather,
  };
}

export {
  OPEN_METEO_FORECAST_ENDPOINT,
  WEATHER_CONNECTOR_ID,
  WEATHER_LOCATION_LABEL,
  WEATHER_REQUEST_TIMEOUT_MS,
  resolveWeatherMode,
} from "./config";
export { createFixtureWeatherRecord } from "./fixture";
export type { OpenMeteoSyncOptions, WeatherFetch } from "./open-meteo";
export {
  buildOpenMeteoForecastUrl,
  mapWmoWeatherCode,
  syncOpenMeteoWeather,
} from "./open-meteo";
