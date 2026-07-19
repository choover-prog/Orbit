import type { WeatherFetch } from "./weather/open-meteo";
import { createWeatherConnector } from "./weather";
import { WeatherConnectorService } from "./weather/service";
import {
  createGoogleCalendarGateway,
  type GoogleCalendarGateway,
  type GoogleCalendarGatewayEnvironment,
} from "./google-calendar";
import type { GoogleCalendarCredentialStore } from "./google-calendar/credential-store";
import type { GoogleCalendarOAuthSessionStore } from "./google-calendar/oauth-session";

export interface CreateConnectorRegistryOptions {
  weatherMode?: string;
  fetchImpl?: WeatherFetch;
  weatherTimeoutMs?: number;
  calendarMode?: string;
  calendarFetchImpl?: typeof globalThis.fetch;
  calendarCredentialStore?: GoogleCalendarCredentialStore;
  calendarSessions?: GoogleCalendarOAuthSessionStore;
  calendarEnvironment?: GoogleCalendarGatewayEnvironment;
}

export interface OrbitConnectorRegistry {
  weather: WeatherConnectorService;
  calendar: GoogleCalendarGateway;
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
    calendar: createGoogleCalendarGateway({
      mode: options.calendarMode,
      fetchImpl: options.calendarFetchImpl,
      credentialStore: options.calendarCredentialStore,
      sessions: options.calendarSessions,
      environment: options.calendarEnvironment,
    }),
  };
}

const globalForConnectorRegistry = globalThis as typeof globalThis & {
  __orbitConnectorRegistry?: OrbitConnectorRegistry;
  __orbitConnectorRegistryConfigurationKey?: string;
};

export function getConnectorRegistry(): OrbitConnectorRegistry {
  const configuredMode = process.env.ORBIT_WEATHER_MODE;
  const calendarMode = process.env.ORBIT_GOOGLE_CALENDAR_MODE;
  const configurationKey = JSON.stringify([
    configuredMode,
    calendarMode,
    process.env.ORBIT_GOOGLE_CALENDAR_CLIENT_ID,
    process.env.ORBIT_GOOGLE_CALENDAR_REDIRECT_URI,
    process.env.LOCALAPPDATA,
  ]);
  if (
    !globalForConnectorRegistry.__orbitConnectorRegistry ||
    configurationKey !==
      globalForConnectorRegistry.__orbitConnectorRegistryConfigurationKey
  ) {
    globalForConnectorRegistry.__orbitConnectorRegistryConfigurationKey =
      configurationKey;
    globalForConnectorRegistry.__orbitConnectorRegistry =
      createConnectorRegistry({
        weatherMode: configuredMode,
        calendarMode,
      });
  }

  return globalForConnectorRegistry.__orbitConnectorRegistry;
}

export function resetConnectorRegistryForTests(): void {
  globalForConnectorRegistry.__orbitConnectorRegistry?.calendar.resetForTests();
  globalForConnectorRegistry.__orbitConnectorRegistry = undefined;
  globalForConnectorRegistry.__orbitConnectorRegistryConfigurationKey =
    undefined;
}
