import {
  GOOGLE_CALENDAR_READONLY_SCOPE,
  GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT,
  GOOGLE_OAUTH_REVOKE_ENDPOINT,
  GOOGLE_OAUTH_TOKEN_ENDPOINT,
  type GoogleCalendarOAuthConfig,
} from "./config";
import type {
  GoogleCalendarCredential,
  GoogleCalendarCredentialStore,
} from "./credential-store";
import type {
  GoogleCalendarOAuthSessionStart,
  GoogleCalendarOAuthSessionStore,
} from "./oauth-session";

export const GOOGLE_OAUTH_REQUEST_TIMEOUT_MS = 10_000;
const MAX_OAUTH_RESPONSE_CHARACTERS = 64 * 1_024;

export type GoogleOAuthFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export class GoogleCalendarOAuthError extends Error {
  constructor(
    public readonly code:
      | "invalid_request"
      | "network_error"
      | "provider_rejected"
      | "invalid_response"
      | "insufficient_scope"
      | "reauthorization_required"
      | "not_connected",
    message: string,
    public readonly httpStatus?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GoogleCalendarOAuthError";
  }
}

export interface GoogleCalendarAuthorizationStart extends GoogleCalendarOAuthSessionStart {
  authorizationUrl: string;
}

export interface GoogleCalendarAccessToken {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  grantedScopes: string[];
}

interface GoogleCalendarInitialAccessToken extends GoogleCalendarAccessToken {
  refreshToken: string;
}

export interface GoogleCalendarOAuthDependencies {
  fetch?: GoogleOAuthFetch;
  now?: () => number;
  timeoutMs?: number;
}

interface TokenEndpointResponse {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  scope?: unknown;
  token_type?: unknown;
}

async function readBoundedOAuthText(response: Response): Promise<string> {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const contentLength = Number(lengthHeader);
    if (
      !Number.isFinite(contentLength) ||
      contentLength < 0 ||
      contentLength > MAX_OAUTH_RESPONSE_CHARACTERS
    ) {
      throw new GoogleCalendarOAuthError(
        "invalid_response",
        "Google returned an oversized OAuth response.",
      );
    }
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > MAX_OAUTH_RESPONSE_CHARACTERS) {
      await reader.cancel();
      throw new GoogleCalendarOAuthError(
        "invalid_response",
        "Google returned an oversized OAuth response.",
      );
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function requireAuthorizationCode(code: string): string {
  const normalized = code.trim();
  if (!normalized || normalized.length > 8_192) {
    throw new GoogleCalendarOAuthError(
      "invalid_request",
      "Google Calendar returned an invalid authorization code.",
    );
  }
  return normalized;
}

function parseScopes(value: unknown, fallback?: string[]): string[] {
  const scopes =
    typeof value === "string" && value.trim()
      ? value.trim().split(/\s+/)
      : fallback;

  if (
    !scopes ||
    scopes.length !== 1 ||
    scopes[0] !== GOOGLE_CALENDAR_READONLY_SCOPE
  ) {
    throw new GoogleCalendarOAuthError(
      "insufficient_scope",
      "Google Calendar did not grant only the required read-only scope.",
    );
  }

  return [GOOGLE_CALENDAR_READONLY_SCOPE];
}

function parseTokenResponse(
  value: unknown,
  now: number,
  requireRefreshToken: true,
  fallbackScopes?: string[],
): GoogleCalendarInitialAccessToken;
function parseTokenResponse(
  value: unknown,
  now: number,
  requireRefreshToken: false,
  fallbackScopes?: string[],
): GoogleCalendarAccessToken & { refreshToken?: string };
function parseTokenResponse(
  value: unknown,
  now: number,
  requireRefreshToken: boolean,
  fallbackScopes?: string[],
): GoogleCalendarAccessToken & { refreshToken?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GoogleCalendarOAuthError(
      "invalid_response",
      "Google returned an invalid OAuth response.",
    );
  }

  const candidate = value as TokenEndpointResponse;
  const accessToken = candidate.access_token;
  const refreshToken = candidate.refresh_token;
  const expiresIn = candidate.expires_in;

  if (
    typeof accessToken !== "string" ||
    accessToken.length === 0 ||
    accessToken.length > 16_384 ||
    candidate.token_type !== "Bearer" ||
    typeof expiresIn !== "number" ||
    !Number.isInteger(expiresIn) ||
    expiresIn <= 0 ||
    expiresIn > 24 * 60 * 60 ||
    (refreshToken !== undefined &&
      (typeof refreshToken !== "string" ||
        refreshToken.length === 0 ||
        refreshToken.length > 16_384)) ||
    (requireRefreshToken && typeof refreshToken !== "string")
  ) {
    throw new GoogleCalendarOAuthError(
      "invalid_response",
      "Google returned incomplete OAuth credentials.",
    );
  }

  const parsed: GoogleCalendarAccessToken & { refreshToken?: string } = {
    accessToken,
    tokenType: "Bearer",
    expiresAt: new Date(now + expiresIn * 1_000).toISOString(),
    grantedScopes: parseScopes(candidate.scope, fallbackScopes),
  };
  if (typeof refreshToken === "string") parsed.refreshToken = refreshToken;
  return parsed;
}

async function requestOAuthJson(
  endpoint: string,
  body: URLSearchParams,
  dependencies: GoogleCalendarOAuthDependencies,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? GOOGLE_OAUTH_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await (dependencies.fetch ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    const responseText = await readBoundedOAuthText(response);
    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      if (!response.ok) {
        throw new GoogleCalendarOAuthError(
          "provider_rejected",
          "Google rejected the Calendar authorization request.",
          response.status,
        );
      }
      throw new GoogleCalendarOAuthError(
        "invalid_response",
        "Google returned an unreadable OAuth response.",
        response.status,
        { cause: error },
      );
    }

    if (!response.ok) {
      if (
        parsedResponse &&
        typeof parsedResponse === "object" &&
        "error" in parsedResponse &&
        parsedResponse.error === "invalid_grant"
      ) {
        throw new GoogleCalendarOAuthError(
          "reauthorization_required",
          "Google Calendar authorization is no longer valid. Connect it again.",
          response.status,
        );
      }
      throw new GoogleCalendarOAuthError(
        "provider_rejected",
        "Google rejected the Calendar authorization request.",
        response.status,
      );
    }

    return parsedResponse;
  } catch (error) {
    if (error instanceof GoogleCalendarOAuthError) throw error;
    throw new GoogleCalendarOAuthError(
      "network_error",
      "Google Calendar authorization could not reach Google.",
      undefined,
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function buildGoogleCalendarAuthorizationUrl(
  config: GoogleCalendarOAuthConfig,
  session: Pick<GoogleCalendarOAuthSessionStart, "state" | "codeChallenge">,
): string {
  const url = new URL(GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT);
  url.search = new URLSearchParams({
    access_type: "offline",
    client_id: config.clientId,
    code_challenge: session.codeChallenge,
    code_challenge_method: "S256",
    include_granted_scopes: "false",
    prompt: "consent",
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_READONLY_SCOPE,
    state: session.state,
  }).toString();
  return url.toString();
}

export function beginGoogleCalendarAuthorization(
  config: GoogleCalendarOAuthConfig,
  sessions: GoogleCalendarOAuthSessionStore,
): GoogleCalendarAuthorizationStart {
  const session = sessions.create();
  return {
    ...session,
    authorizationUrl: buildGoogleCalendarAuthorizationUrl(config, session),
  };
}

async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string,
  config: GoogleCalendarOAuthConfig,
  dependencies: GoogleCalendarOAuthDependencies,
): Promise<GoogleCalendarInitialAccessToken> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    code: requireAuthorizationCode(code),
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });

  const response = await requestOAuthJson(
    GOOGLE_OAUTH_TOKEN_ENDPOINT,
    body,
    dependencies,
  );
  return parseTokenResponse(response, (dependencies.now ?? Date.now)(), true);
}

export interface CompleteGoogleCalendarAuthorizationInput {
  code: string;
  state: string | undefined;
  cookieBinding: string | undefined;
}

/** Consumes one PKCE transaction, exchanges on the server, then saves only the refresh credential. */
export async function completeGoogleCalendarAuthorization(
  input: CompleteGoogleCalendarAuthorizationInput,
  config: GoogleCalendarOAuthConfig,
  sessions: GoogleCalendarOAuthSessionStore,
  credentials: GoogleCalendarCredentialStore,
  dependencies: GoogleCalendarOAuthDependencies = {},
): Promise<GoogleCalendarAccessToken> {
  const code = requireAuthorizationCode(input.code);
  const { codeVerifier } = sessions.consume(input.state, input.cookieBinding);
  const token = await exchangeAuthorizationCode(
    code,
    codeVerifier,
    config,
    dependencies,
  );
  const now = (dependencies.now ?? Date.now)();

  await credentials.save({
    version: 1,
    refreshToken: token.refreshToken,
    grantedScopes: token.grantedScopes,
    connectedAt: new Date(now).toISOString(),
  });

  return {
    accessToken: token.accessToken,
    tokenType: token.tokenType,
    expiresAt: token.expiresAt,
    grantedScopes: token.grantedScopes,
  };
}

export async function refreshGoogleCalendarAccessToken(
  config: GoogleCalendarOAuthConfig,
  credentials: GoogleCalendarCredentialStore,
  dependencies: GoogleCalendarOAuthDependencies = {},
): Promise<GoogleCalendarAccessToken> {
  const credential = await credentials.load();
  if (!credential) {
    throw new GoogleCalendarOAuthError(
      "not_connected",
      "Google Calendar is not connected.",
    );
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: "refresh_token",
    refresh_token: credential.refreshToken,
  });

  let response: unknown;
  try {
    response = await requestOAuthJson(
      GOOGLE_OAUTH_TOKEN_ENDPOINT,
      body,
      dependencies,
    );
  } catch (error) {
    if (
      error instanceof GoogleCalendarOAuthError &&
      error.code === "reauthorization_required"
    ) {
      await credentials.delete();
    }
    throw error;
  }
  const token = parseTokenResponse(
    response,
    (dependencies.now ?? Date.now)(),
    false,
    credential.grantedScopes,
  );

  if (token.refreshToken && token.refreshToken !== credential.refreshToken) {
    await credentials.save({
      ...credential,
      refreshToken: token.refreshToken,
    });
  }

  return {
    accessToken: token.accessToken,
    tokenType: token.tokenType,
    expiresAt: token.expiresAt,
    grantedScopes: token.grantedScopes,
  };
}

async function revokeGoogleRefreshToken(
  refreshToken: string,
  dependencies: GoogleCalendarOAuthDependencies,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? GOOGLE_OAUTH_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await (dependencies.fetch ?? fetch)(
      GOOGLE_OAUTH_REVOKE_ENDPOINT,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token: refreshToken }).toString(),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      },
    );
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export interface GoogleCalendarDisconnectResult {
  localCredentialsDeleted: true;
  providerRevoked: boolean;
}

/** Local deletion is guaranteed even if Google's best-effort revocation is unavailable. */
export async function disconnectGoogleCalendar(
  credentials: GoogleCalendarCredentialStore,
  dependencies: GoogleCalendarOAuthDependencies = {},
): Promise<GoogleCalendarDisconnectResult> {
  let credential: GoogleCalendarCredential | null;
  try {
    credential = await credentials.load();
  } catch {
    await credentials.delete();
    return { localCredentialsDeleted: true, providerRevoked: false };
  }
  await credentials.delete();
  const providerRevoked = credential
    ? await revokeGoogleRefreshToken(credential.refreshToken, dependencies)
    : false;

  return { localCredentialsDeleted: true, providerRevoked };
}
