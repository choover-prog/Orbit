import type {
  ConnectorFailure,
  ConnectorMode,
  EmailAuthorizationStatus,
  EmailContextStatus,
} from "@/domain/orbit/connectors";

import { syncGmail } from "./client";
import {
  GMAIL_READONLY_SCOPE,
  resolveGmailOAuthConfig,
  type GmailOAuthConfig,
  type GmailOAuthEnvironment,
} from "./config";
import {
  createGmailCredentialStore,
  GmailCredentialStoreError,
  type GmailCredentialStore,
} from "./credential-store";
import { createFixtureGmailSource } from "./fixture";
import {
  beginGmailAuthorization,
  completeGmailAuthorization,
  disconnectGmail,
  GmailOAuthError,
  refreshGmailAccessToken,
  type GmailAccessToken,
  type GmailAuthorizationStart,
  type GmailOAuthFetch,
} from "./oauth";
import {
  getGmailOAuthSessionStore,
  type GmailOAuthSessionStore,
} from "./oauth-session";
import { GmailService, type GmailReadResult } from "./service";
import type { GmailSyncBatch, GmailSyncOutcome } from "./types";

const ACCESS_TOKEN_SKEW_MS = 60 * 1_000;
const FIXTURE_REFRESH_TOKEN = "fixture-refresh-token-not-a-credential";
const FIXTURE_ACCESS_TOKEN = "fixture-access-token-not-a-credential";

export interface GmailGatewayEnvironment extends GmailOAuthEnvironment {
  ORBIT_GOOGLE_GMAIL_MODE?: string;
  LOCALAPPDATA?: string;
}

export interface GmailGatewayOptions {
  environment?: GmailGatewayEnvironment;
  mode?: string;
  credentialStore?: GmailCredentialStore;
  sessions?: GmailOAuthSessionStore;
  fetchImpl?: typeof globalThis.fetch;
  platform?: NodeJS.Platform;
  localAppData?: string;
}

export interface GmailGatewayState {
  status: EmailContextStatus;
  authorization: EmailAuthorizationStatus;
  mode: ConnectorMode;
  batch?: GmailSyncBatch;
  failure?: ConnectorFailure;
  nextSyncEligibleAt?: string;
  fromCache?: boolean;
}

export type GmailAuthorizationResult =
  | { kind: "fixture"; state: GmailGatewayState }
  | {
      kind: "redirect";
      authorization: GmailAuthorizationStart;
      redirectUri: string;
    };

export type GmailDisconnectResult = Awaited<ReturnType<typeof disconnectGmail>>;

function configurationFailure(message: string): ConnectorFailure {
  return { code: "configuration_required", message, retryable: false };
}

function storageFailure(message: string): ConnectorFailure {
  return { code: "storage_unavailable", message, retryable: false };
}

function oauthFailure(error: unknown): ConnectorFailure {
  if (error instanceof GmailCredentialStoreError) {
    return storageFailure(error.message);
  }

  if (error instanceof GmailOAuthError) {
    switch (error.code) {
      case "not_connected":
      case "reauthorization_required":
        return {
          code: "authentication_required",
          message: "Gmail must be connected again.",
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
          message: "Gmail authorization is temporarily unavailable.",
          retryable: true,
        };
      case "provider_rejected":
        return {
          code: "provider_unavailable",
          message: "Google rejected the Gmail credential request.",
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
    message: "Gmail is temporarily unavailable.",
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
      "ORBIT_GOOGLE_GMAIL_MODE must be fixture or live.",
    ),
  };
}

export class GmailGateway {
  readonly mode: ConnectorMode;

  private readonly credentials: GmailCredentialStore;
  private readonly sessions: GmailOAuthSessionStore;
  private readonly oauthConfig?: GmailOAuthConfig;
  private readonly fetchImpl?: typeof globalThis.fetch;
  private readonly service: GmailService;
  private readonly startupFailure?: ConnectorFailure;
  private accessToken?: GmailAccessToken;
  private accessTokenInFlight?: Promise<GmailAccessToken>;
  private credentialGeneration = 0;

  constructor(options: GmailGatewayOptions = {}) {
    const environment =
      options.environment ?? (process.env as GmailGatewayEnvironment);
    const modeResult = resolveMode(
      options.mode ?? environment.ORBIT_GOOGLE_GMAIL_MODE,
    );
    this.mode = modeResult.mode;
    this.fetchImpl = options.fetchImpl;
    this.sessions = options.sessions ?? getGmailOAuthSessionStore();

    let startupFailure = modeResult.failure;
    let credentials = options.credentialStore;
    if (!credentials) {
      try {
        credentials = createGmailCredentialStore({
          mode: this.mode,
          platform: options.platform,
          localAppData: options.localAppData ?? environment.LOCALAPPDATA,
        });
      } catch (error) {
        startupFailure = storageFailure(
          error instanceof Error
            ? error.message
            : "Secure Gmail storage is unavailable.",
        );
        credentials = createGmailCredentialStore({ mode: "fixture" });
      }
    }
    this.credentials = credentials;

    if (this.mode === "live" && !startupFailure) {
      const config = resolveGmailOAuthConfig(environment);
      if (config.ok) this.oauthConfig = config.config;
      else startupFailure = configurationFailure(config.message);
    }
    this.startupFailure = startupFailure;

    this.service = new GmailService(
      this.mode === "fixture"
        ? createFixtureGmailSource()
        : { sync: (now) => this.syncLive(now) },
    );
  }

  async authorizationStatus(): Promise<EmailAuthorizationStatus> {
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
  ): Promise<GmailGatewayState> {
    const authorization = await this.authorizationStatus();
    if (authorization !== "connected") {
      return {
        status: authorization,
        authorization,
        mode: this.mode,
        ...(this.startupFailure ? { failure: this.startupFailure } : {}),
      };
    }

    return this.stateFromRead(await this.service.read(now, options));
  }

  /** Returns authorization and in-memory context without provider I/O. */
  async peek(now: Date): Promise<GmailGatewayState> {
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
  ): Promise<GmailAuthorizationResult> {
    if (this.startupFailure) throw new Error(this.startupFailure.message);

    if (this.mode === "fixture") {
      const generation = ++this.credentialGeneration;
      await this.generationBoundCredentials(generation).save({
        version: 1,
        refreshToken: FIXTURE_REFRESH_TOKEN,
        grantedScopes: [GMAIL_READONLY_SCOPE],
        connectedAt: now.toISOString(),
      });
      this.accessToken = {
        accessToken: FIXTURE_ACCESS_TOKEN,
        tokenType: "Bearer",
        expiresAt: new Date(now.getTime() + 60 * 60 * 1_000).toISOString(),
        grantedScopes: [GMAIL_READONLY_SCOPE],
      };
      this.service.clear();
      return {
        kind: "fixture",
        state: await this.read(now, { force: true }),
      };
    }

    if (!this.oauthConfig) throw new Error("Gmail OAuth is not configured.");
    return {
      kind: "redirect",
      authorization: beginGmailAuthorization(this.oauthConfig, this.sessions),
      redirectUri: this.oauthConfig.redirectUri,
    };
  }

  async completeAuthorization(input: {
    code: string;
    state: string | undefined;
    cookieBinding: string | undefined;
  }): Promise<GmailGatewayState> {
    if (this.mode !== "live" || !this.oauthConfig || this.startupFailure) {
      throw new Error("Live Gmail OAuth is not configured.");
    }
    const generation = ++this.credentialGeneration;
    this.accessToken = await completeGmailAuthorization(
      input,
      this.oauthConfig,
      this.sessions,
      this.generationBoundCredentials(generation),
      { fetch: this.fetchImpl as GmailOAuthFetch | undefined },
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

  async disconnect(): Promise<GmailDisconnectResult> {
    this.credentialGeneration += 1;
    this.accessToken = undefined;
    this.accessTokenInFlight = undefined;
    this.service.clear();
    this.sessions.clear();

    if (this.mode === "fixture") {
      await this.credentials.delete();
      return { localCredentialsDeleted: true, providerRevoked: true };
    }

    return disconnectGmail(this.credentials, {
      fetch: this.fetchImpl as GmailOAuthFetch | undefined,
    });
  }

  resetForTests(): void {
    this.credentialGeneration += 1;
    this.accessToken = undefined;
    this.accessTokenInFlight = undefined;
    this.service.clear();
    this.sessions.clear();
  }

  private stateFromRead(result: GmailReadResult): GmailGatewayState {
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

  private async syncLive(now: Date): Promise<GmailSyncOutcome> {
    try {
      const token = await this.getAccessToken(now);
      const firstAttempt = await syncGmail(
        { now, accessToken: token.accessToken },
        { fetchImpl: this.fetchImpl },
      );
      if (
        firstAttempt.ok ||
        firstAttempt.failure.code !== "authentication_required"
      ) {
        return firstAttempt;
      }

      this.accessToken = undefined;
      const refreshed = await this.getAccessToken(now);
      const retry = await syncGmail(
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

  private async getAccessToken(now: Date): Promise<GmailAccessToken> {
    if (
      this.accessToken &&
      Date.parse(this.accessToken.expiresAt) >
        now.getTime() + ACCESS_TOKEN_SKEW_MS
    ) {
      return this.accessToken;
    }
    if (this.accessTokenInFlight) return this.accessTokenInFlight;
    if (!this.oauthConfig) {
      throw new GmailOAuthError("not_connected", "Gmail is not configured.");
    }

    const generation = this.credentialGeneration;
    const pending = refreshGmailAccessToken(
      this.oauthConfig,
      this.generationBoundCredentials(generation),
      { fetch: this.fetchImpl as GmailOAuthFetch | undefined },
    )
      .then((token) => {
        if (generation !== this.credentialGeneration) {
          throw new GmailOAuthError(
            "not_connected",
            "Gmail was disconnected during authorization.",
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

  private generationBoundCredentials(generation: number): GmailCredentialStore {
    const assertCurrent = () => {
      if (generation !== this.credentialGeneration) {
        throw new GmailOAuthError(
          "not_connected",
          "Gmail authorization is no longer current.",
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

export function createGmailGateway(
  options: GmailGatewayOptions = {},
): GmailGateway {
  return new GmailGateway(options);
}
