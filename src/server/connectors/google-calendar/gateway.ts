import type {
  CalendarAuthorizationStatus,
  CalendarContextStatus,
  ConnectorFailure,
  ConnectorMode,
} from "@/domain/orbit/connectors";
import { syncGoogleCalendar } from "./client";
import {
  resolveGoogleCalendarOAuthConfig,
  type GoogleCalendarOAuthConfig,
  type GoogleCalendarOAuthEnvironment,
} from "./config";
import {
  createGoogleCalendarCredentialStore,
  GoogleCalendarCredentialStoreError,
  type GoogleCalendarCredentialStore,
} from "./credential-store";
import { createFixtureCalendarSource } from "./fixture";
import {
  beginGoogleCalendarAuthorization,
  completeGoogleCalendarAuthorization,
  disconnectGoogleCalendar,
  GoogleCalendarOAuthError,
  refreshGoogleCalendarAccessToken,
  type GoogleCalendarAccessToken,
  type GoogleCalendarAuthorizationStart,
  type GoogleCalendarDisconnectResult,
  type GoogleOAuthFetch,
} from "./oauth";
import {
  getGoogleCalendarOAuthSessionStore,
  type GoogleCalendarOAuthSessionStore,
} from "./oauth-session";
import { GoogleCalendarService, type CalendarReadResult } from "./service";
import type { CalendarSyncBatch, CalendarSyncOutcome } from "./types";

const ACCESS_TOKEN_SKEW_MS = 60 * 1_000;
const FIXTURE_REFRESH_TOKEN = "fixture-refresh-token-not-a-credential";
const FIXTURE_ACCESS_TOKEN = "fixture-access-token-not-a-credential";

export interface GoogleCalendarGatewayEnvironment extends GoogleCalendarOAuthEnvironment {
  ORBIT_GOOGLE_CALENDAR_MODE?: string;
  LOCALAPPDATA?: string;
}

export interface GoogleCalendarGatewayOptions {
  environment?: GoogleCalendarGatewayEnvironment;
  mode?: string;
  credentialStore?: GoogleCalendarCredentialStore;
  sessions?: GoogleCalendarOAuthSessionStore;
  fetchImpl?: typeof globalThis.fetch;
  platform?: NodeJS.Platform;
  localAppData?: string;
}

export interface GoogleCalendarGatewayState {
  status: CalendarContextStatus;
  authorization: CalendarAuthorizationStatus;
  mode: ConnectorMode;
  batch?: CalendarSyncBatch;
  failure?: ConnectorFailure;
  nextSyncEligibleAt?: string;
  fromCache?: boolean;
}

export type GoogleCalendarAuthorizationResult =
  | { kind: "fixture"; state: GoogleCalendarGatewayState }
  | {
      kind: "redirect";
      authorization: GoogleCalendarAuthorizationStart;
      redirectUri: string;
    };

function configurationFailure(message: string): ConnectorFailure {
  return {
    code: "configuration_required",
    message,
    retryable: false,
  };
}

function storageFailure(message: string): ConnectorFailure {
  return {
    code: "storage_unavailable",
    message,
    retryable: false,
  };
}

function oauthFailure(error: unknown): ConnectorFailure {
  if (error instanceof GoogleCalendarCredentialStoreError) {
    return storageFailure(error.message);
  }

  if (error instanceof GoogleCalendarOAuthError) {
    switch (error.code) {
      case "not_connected":
      case "reauthorization_required":
        return {
          code: "authentication_required",
          message: "Google Calendar must be connected again.",
          retryable: false,
        };
      case "insufficient_scope":
        return {
          code: "insufficient_scope",
          message: error.message,
          retryable: false,
        };
      case "network_error":
        return {
          code: "provider_unavailable",
          message: "Google Calendar authorization is temporarily unavailable.",
          retryable: true,
        };
      case "provider_rejected":
        return {
          code: "provider_unavailable",
          message: "Google rejected the Calendar credential request.",
          retryable: false,
        };
      case "invalid_request":
      case "invalid_response":
        return {
          code: "invalid_response",
          message: error.message,
          retryable: false,
        };
    }
  }

  return {
    code: "provider_unavailable",
    message: "Google Calendar is temporarily unavailable.",
    retryable: true,
  };
}

function resolveMode(value: string | undefined): {
  mode: ConnectorMode;
  failure?: ConnectorFailure;
} {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "fixture") return { mode: "fixture" };
  if (normalized === "live") return { mode: "live" };
  return {
    mode: "fixture",
    failure: configurationFailure(
      "ORBIT_GOOGLE_CALENDAR_MODE must be fixture or live.",
    ),
  };
}

export class GoogleCalendarGateway {
  readonly mode: ConnectorMode;

  private readonly credentials: GoogleCalendarCredentialStore;
  private readonly sessions: GoogleCalendarOAuthSessionStore;
  private readonly oauthConfig?: GoogleCalendarOAuthConfig;
  private readonly fetchImpl?: typeof globalThis.fetch;
  private readonly service: GoogleCalendarService;
  private readonly startupFailure?: ConnectorFailure;
  private accessToken?: GoogleCalendarAccessToken;
  private accessTokenInFlight?: Promise<GoogleCalendarAccessToken>;
  private credentialGeneration = 0;

  constructor(options: GoogleCalendarGatewayOptions = {}) {
    const environment =
      options.environment ?? (process.env as GoogleCalendarGatewayEnvironment);
    const modeResult = resolveMode(
      options.mode ?? environment.ORBIT_GOOGLE_CALENDAR_MODE,
    );
    this.mode = modeResult.mode;
    this.fetchImpl = options.fetchImpl;
    this.sessions = options.sessions ?? getGoogleCalendarOAuthSessionStore();

    let startupFailure = modeResult.failure;
    let credentials = options.credentialStore;
    if (!credentials) {
      try {
        credentials = createGoogleCalendarCredentialStore({
          mode: this.mode,
          platform: options.platform,
          localAppData: options.localAppData ?? environment.LOCALAPPDATA,
        });
      } catch (error) {
        startupFailure = storageFailure(
          error instanceof Error
            ? error.message
            : "Secure Calendar storage is unavailable.",
        );
        credentials = createGoogleCalendarCredentialStore({ mode: "fixture" });
      }
    }
    this.credentials = credentials;

    if (this.mode === "live" && !startupFailure) {
      const config = resolveGoogleCalendarOAuthConfig(environment);
      if (config.ok) this.oauthConfig = config.config;
      else startupFailure = configurationFailure(config.message);
    }
    this.startupFailure = startupFailure;

    this.service = new GoogleCalendarService(
      this.mode === "fixture"
        ? createFixtureCalendarSource()
        : { sync: (now) => this.syncLive(now) },
    );
  }

  async authorizationStatus(): Promise<CalendarAuthorizationStatus> {
    if (this.startupFailure?.code === "storage_unavailable") {
      return "storage_unavailable";
    }
    if (this.startupFailure) return "configuration_required";

    try {
      return (await this.credentials.load()) ? "connected" : "disconnected";
    } catch {
      return "storage_unavailable";
    }
  }

  async read(
    now: Date,
    options: { force?: boolean } = {},
  ): Promise<GoogleCalendarGatewayState> {
    const authorization = await this.authorizationStatus();
    if (authorization !== "connected") {
      return {
        status: authorization,
        authorization,
        mode: this.mode,
        ...(this.startupFailure ? { failure: this.startupFailure } : {}),
      };
    }

    const result = await this.service.read(now, options);
    return this.stateFromRead(result);
  }

  /** Returns authorization and in-memory context without provider I/O. */
  async peek(now: Date): Promise<GoogleCalendarGatewayState> {
    const authorization = await this.authorizationStatus();
    if (authorization !== "connected") {
      return {
        status: authorization,
        authorization,
        mode: this.mode,
        ...(this.startupFailure ? { failure: this.startupFailure } : {}),
      };
    }

    const result = this.service.peek(now);
    return result
      ? this.stateFromRead(result)
      : { status: "connected", authorization, mode: this.mode };
  }

  async beginAuthorization(
    now = new Date(),
  ): Promise<GoogleCalendarAuthorizationResult> {
    if (this.startupFailure) {
      throw new Error(this.startupFailure.message);
    }

    if (this.mode === "fixture") {
      const generation = ++this.credentialGeneration;
      await this.generationBoundCredentials(generation).save({
        version: 1,
        refreshToken: FIXTURE_REFRESH_TOKEN,
        grantedScopes: [
          "https://www.googleapis.com/auth/calendar.events.owned.readonly",
        ],
        connectedAt: now.toISOString(),
      });
      this.accessToken = {
        accessToken: FIXTURE_ACCESS_TOKEN,
        tokenType: "Bearer",
        expiresAt: new Date(now.getTime() + 60 * 60 * 1_000).toISOString(),
        grantedScopes: [
          "https://www.googleapis.com/auth/calendar.events.owned.readonly",
        ],
      };
      this.service.clear();
      return {
        kind: "fixture",
        state: await this.read(now, { force: true }),
      };
    }

    if (!this.oauthConfig) {
      throw new Error("Google Calendar OAuth is not configured.");
    }
    return {
      kind: "redirect",
      authorization: beginGoogleCalendarAuthorization(
        this.oauthConfig,
        this.sessions,
      ),
      redirectUri: this.oauthConfig.redirectUri,
    };
  }

  async completeAuthorization(input: {
    code: string;
    state: string | undefined;
    cookieBinding: string | undefined;
  }): Promise<GoogleCalendarGatewayState> {
    if (this.mode !== "live" || !this.oauthConfig || this.startupFailure) {
      throw new Error("Live Google Calendar OAuth is not configured.");
    }
    const generation = ++this.credentialGeneration;
    this.accessToken = await completeGoogleCalendarAuthorization(
      input,
      this.oauthConfig,
      this.sessions,
      this.generationBoundCredentials(generation),
      { fetch: this.fetchImpl as GoogleOAuthFetch | undefined },
    );
    this.service.clear();
    return this.read(new Date(), { force: true });
  }

  cancelAuthorization(
    state: string | undefined,
    cookieBinding: string | undefined,
  ): void {
    this.sessions.consume(state, cookieBinding);
  }

  async disconnect(): Promise<GoogleCalendarDisconnectResult> {
    this.credentialGeneration += 1;
    this.accessToken = undefined;
    this.accessTokenInFlight = undefined;
    this.service.clear();
    this.sessions.clear();

    if (this.mode === "fixture") {
      await this.credentials.delete();
      return { localCredentialsDeleted: true, providerRevoked: true };
    }

    return disconnectGoogleCalendar(this.credentials, {
      fetch: this.fetchImpl as GoogleOAuthFetch | undefined,
    });
  }

  resetForTests(): void {
    this.credentialGeneration += 1;
    this.accessToken = undefined;
    this.accessTokenInFlight = undefined;
    this.service.clear();
    this.sessions.clear();
  }

  private stateFromRead(
    result: CalendarReadResult,
  ): GoogleCalendarGatewayState {
    if (result.status === "fresh") {
      return {
        status: "fresh",
        authorization: "connected",
        mode: this.mode,
        batch: result.batch,
        nextSyncEligibleAt: result.nextSyncEligibleAt,
        fromCache: result.fromCache,
      };
    }
    if (result.status === "stale") {
      return {
        status: "stale",
        authorization: "connected",
        mode: this.mode,
        batch: result.batch,
        failure: result.failure,
        nextSyncEligibleAt: result.nextSyncEligibleAt,
        fromCache: result.fromCache,
      };
    }
    return {
      status: result.status,
      authorization:
        result.status === "reauthorization_required"
          ? "reauthorization_required"
          : "connected",
      mode: this.mode,
      failure: result.failure,
      nextSyncEligibleAt: result.nextSyncEligibleAt,
    };
  }

  private async syncLive(now: Date): Promise<CalendarSyncOutcome> {
    try {
      const token = await this.getAccessToken(now);
      const firstAttempt = await syncGoogleCalendar(
        { now, accessToken: token.accessToken },
        { fetchImpl: this.fetchImpl },
      );
      if (
        firstAttempt.ok ||
        firstAttempt.failure.code !== "authentication_required"
      ) {
        return firstAttempt;
      }

      // A provider 401 can precede the nominal expiry. Discard the rejected
      // access token, refresh once, and retry once without creating a loop.
      this.accessToken = undefined;
      const refreshed = await this.getAccessToken(now);
      const retry = await syncGoogleCalendar(
        { now, accessToken: refreshed.accessToken },
        { fetchImpl: this.fetchImpl },
      );
      if (!retry.ok && retry.failure.code === "authentication_required") {
        this.accessToken = undefined;
      }
      return retry;
    } catch (error) {
      return { ok: false, failure: oauthFailure(error) };
    }
  }

  private async getAccessToken(now: Date): Promise<GoogleCalendarAccessToken> {
    if (
      this.accessToken &&
      Date.parse(this.accessToken.expiresAt) >
        now.getTime() + ACCESS_TOKEN_SKEW_MS
    ) {
      return this.accessToken;
    }
    if (this.accessTokenInFlight) return this.accessTokenInFlight;
    if (!this.oauthConfig) {
      throw new GoogleCalendarOAuthError(
        "not_connected",
        "Google Calendar is not configured.",
      );
    }

    const generation = this.credentialGeneration;
    const pending = refreshGoogleCalendarAccessToken(
      this.oauthConfig,
      this.generationBoundCredentials(generation),
      { fetch: this.fetchImpl as GoogleOAuthFetch | undefined },
    )
      .then((token) => {
        if (generation !== this.credentialGeneration) {
          throw new GoogleCalendarOAuthError(
            "not_connected",
            "Google Calendar was disconnected during authorization.",
          );
        }
        this.accessToken = token;
        return token;
      })
      .finally(() => {
        if (this.accessTokenInFlight === pending) {
          this.accessTokenInFlight = undefined;
        }
      });
    this.accessTokenInFlight = pending;
    return pending;
  }

  private generationBoundCredentials(
    generation: number,
  ): GoogleCalendarCredentialStore {
    const assertCurrent = () => {
      if (generation !== this.credentialGeneration) {
        throw new GoogleCalendarOAuthError(
          "not_connected",
          "Google Calendar authorization is no longer current.",
        );
      }
    };

    return {
      load: async () => {
        assertCurrent();
        const credential = await this.credentials.load();
        assertCurrent();
        return credential;
      },
      save: async (credential) => {
        assertCurrent();
        await this.credentials.save(credential);
        if (generation !== this.credentialGeneration) {
          await this.credentials.delete();
          assertCurrent();
        }
      },
      delete: async () => {
        assertCurrent();
        await this.credentials.delete();
      },
    };
  }
}

export function createGoogleCalendarGateway(
  options: GoogleCalendarGatewayOptions = {},
): GoogleCalendarGateway {
  return new GoogleCalendarGateway(options);
}
