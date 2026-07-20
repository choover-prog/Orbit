import type {
  ConnectorFailure,
  ConnectorMode,
} from "@/domain/orbit/connectors";

export const WEATHER_CONNECTOR_ID = "weather.open-meteo";
export const WEATHER_LOCATION_LABEL = "Harbor City test area";
export const WEATHER_LATITUDE = 40;
export const WEATHER_LONGITUDE = -83;
export const OPEN_METEO_FORECAST_ENDPOINT =
  "https://api.open-meteo.com/v1/forecast";
export const WEATHER_REQUEST_TIMEOUT_MS = 4_000;
export const WEATHER_FRESHNESS_WINDOW_MS = 15 * 60 * 1_000;

export type WeatherModeResolution =
  { ok: true; mode: ConnectorMode } | { ok: false; failure: ConnectorFailure };

export function resolveWeatherMode(
  value: string | undefined,
): WeatherModeResolution {
  if (value === undefined || value === "fixture") {
    return { ok: true, mode: "fixture" };
  }

  if (value === "live") {
    return { ok: true, mode: "live" };
  }

  return {
    ok: false,
    failure: {
      code: "configuration_required",
      message:
        "Weather is unavailable because ORBIT_WEATHER_MODE must be fixture or live.",
      retryable: false,
    },
  };
}
