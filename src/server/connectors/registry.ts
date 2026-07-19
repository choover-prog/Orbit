import type { WeatherFetch } from "./weather/open-meteo";
import { createWeatherConnector } from "./weather";
import { WeatherConnectorService } from "./weather/service";

export interface CreateConnectorRegistryOptions {
  weatherMode?: string;
  fetchImpl?: WeatherFetch;
  weatherTimeoutMs?: number;
}

export interface OrbitConnectorRegistry {
  weather: WeatherConnectorService;
}

export function createConnectorRegistry(
  options: CreateConnectorRegistryOptions = {},
): OrbitConnectorRegistry {
  return {
    weather: new WeatherConnectorService(
      createWeatherConnector({
        mode: options.weatherMode,
        fetchImpl: options.fetchImpl,
        timeoutMs: options.weatherTimeoutMs,
      }),
    ),
  };
}

let defaultRegistry: OrbitConnectorRegistry | undefined;
let defaultMode: string | undefined;

export function getConnectorRegistry(): OrbitConnectorRegistry {
  const configuredMode = process.env.ORBIT_WEATHER_MODE;
  if (!defaultRegistry || configuredMode !== defaultMode) {
    defaultMode = configuredMode;
    defaultRegistry = createConnectorRegistry({ weatherMode: configuredMode });
  }

  return defaultRegistry;
}
