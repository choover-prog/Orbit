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
import {
  createGmailGateway,
  type GmailGateway,
  type GmailGatewayEnvironment,
} from "./gmail";
import type { GmailCredentialStore } from "./gmail/credential-store";
import type { GmailOAuthSessionStore } from "./gmail/oauth-session";
import {
  createGoogleNestGateway,
  type GoogleNestGateway,
  type GoogleNestGatewayEnvironment,
} from "./google-nest";
import type { GoogleNestCredentialStore } from "./google-nest/credential-store";
import type { GoogleNestOAuthSessionStore } from "./google-nest/oauth-session";

export interface CreateConnectorRegistryOptions {
  weatherMode?: string;
  fetchImpl?: WeatherFetch;
  weatherTimeoutMs?: number;
  calendarMode?: string;
  calendarFetchImpl?: typeof globalThis.fetch;
  calendarCredentialStore?: GoogleCalendarCredentialStore;
  calendarSessions?: GoogleCalendarOAuthSessionStore;
  calendarEnvironment?: GoogleCalendarGatewayEnvironment;
  gmailMode?: string;
  gmailFetchImpl?: typeof globalThis.fetch;
  gmailCredentialStore?: GmailCredentialStore;
  gmailSessions?: GmailOAuthSessionStore;
  gmailEnvironment?: GmailGatewayEnvironment;
  nestMode?: string;
  nestFetchImpl?: typeof globalThis.fetch;
  nestCredentialStore?: GoogleNestCredentialStore;
  nestSessions?: GoogleNestOAuthSessionStore;
  nestEnvironment?: GoogleNestGatewayEnvironment;
}

export interface OrbitConnectorRegistry {
  weather: WeatherConnectorService;
  calendar: GoogleCalendarGateway;
  gmail: GmailGateway;
  nest: GoogleNestGateway;
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
    gmail: createGmailGateway({
      mode: options.gmailMode,
      fetchImpl: options.gmailFetchImpl,
      credentialStore: options.gmailCredentialStore,
      sessions: options.gmailSessions,
      environment: options.gmailEnvironment,
    }),
    nest: createGoogleNestGateway({
      mode: options.nestMode,
      fetchImpl: options.nestFetchImpl,
      credentialStore: options.nestCredentialStore,
      sessions: options.nestSessions,
      environment: options.nestEnvironment,
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
  const gmailMode = process.env.ORBIT_GOOGLE_GMAIL_MODE;
  const nestMode = process.env.ORBIT_GOOGLE_NEST_MODE;
  const configurationKey = JSON.stringify([
    configuredMode,
    calendarMode,
    process.env.ORBIT_GOOGLE_CALENDAR_CLIENT_ID,
    process.env.ORBIT_GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.ORBIT_GOOGLE_CALENDAR_REDIRECT_URI,
    gmailMode,
    process.env.ORBIT_GOOGLE_GMAIL_CLIENT_ID,
    process.env.ORBIT_GOOGLE_GMAIL_CLIENT_SECRET,
    process.env.ORBIT_GOOGLE_GMAIL_REDIRECT_URI,
    nestMode,
    process.env.ORBIT_GOOGLE_NEST_CLIENT_ID,
    process.env.ORBIT_GOOGLE_NEST_CLIENT_SECRET,
    process.env.ORBIT_GOOGLE_NEST_PROJECT_ID,
    process.env.ORBIT_GOOGLE_NEST_REDIRECT_URI,
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
        gmailMode,
        nestMode,
      });
  }

  return globalForConnectorRegistry.__orbitConnectorRegistry;
}

export function resetConnectorRegistryForTests(): void {
  globalForConnectorRegistry.__orbitConnectorRegistry?.calendar.resetForTests();
  globalForConnectorRegistry.__orbitConnectorRegistry?.gmail.resetForTests();
  globalForConnectorRegistry.__orbitConnectorRegistry?.nest.resetForTests();
  globalForConnectorRegistry.__orbitConnectorRegistry = undefined;
  globalForConnectorRegistry.__orbitConnectorRegistryConfigurationKey =
    undefined;
}
