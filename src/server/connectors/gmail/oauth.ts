import {
  GMAIL_READONLY_SCOPE,
  GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT,
  GOOGLE_OAUTH_REVOKE_ENDPOINT,
  GOOGLE_OAUTH_TOKEN_ENDPOINT,
  type GmailOAuthConfig,
} from "./config";
import type { GmailCredential, GmailCredentialStore } from "./credential-store";
import type {
  GmailOAuthSessionStart,
  GmailOAuthSessionStore,
} from "./oauth-session";

export const GMAIL_OAUTH_REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 64 * 1_024;
export type GmailOAuthFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export class GmailOAuthError extends Error {
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
    this.name = "GmailOAuthError";
  }
}
export interface GmailAccessToken {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  grantedScopes: string[];
}
interface InitialToken extends GmailAccessToken {
  refreshToken: string;
}
export interface GmailOAuthDependencies {
  fetch?: GmailOAuthFetch;
  now?: () => number;
  timeoutMs?: number;
}
export interface GmailAuthorizationStart extends GmailOAuthSessionStart {
  authorizationUrl: string;
}

function scopes(value: unknown, fallback?: string[]): string[] {
  const result =
    typeof value === "string" && value.trim()
      ? value.trim().split(/\s+/)
      : fallback;
  if (!result || result.length !== 1 || result[0] !== GMAIL_READONLY_SCOPE)
    throw new GmailOAuthError(
      "insufficient_scope",
      "Gmail did not grant only the required read-only scope.",
    );
  return [GMAIL_READONLY_SCOPE];
}
function code(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 8192)
    throw new GmailOAuthError(
      "invalid_request",
      "Gmail returned an invalid authorization code.",
    );
  return normalized;
}
function token(
  value: unknown,
  now: number,
  requireRefresh: boolean,
  fallback?: string[],
): InitialToken | (GmailAccessToken & { refreshToken?: string }) {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const access = candidate?.access_token,
    refresh = candidate?.refresh_token,
    expires = candidate?.expires_in;
  if (
    typeof access !== "string" ||
    !access ||
    access.length > 16384 ||
    candidate?.token_type !== "Bearer" ||
    typeof expires !== "number" ||
    !Number.isInteger(expires) ||
    expires <= 0 ||
    expires > 86400 ||
    (refresh !== undefined &&
      (typeof refresh !== "string" || !refresh || refresh.length > 16384)) ||
    (requireRefresh && typeof refresh !== "string")
  )
    throw new GmailOAuthError(
      "invalid_response",
      "Gmail returned incomplete OAuth credentials.",
    );
  const result: GmailAccessToken & { refreshToken?: string } = {
    accessToken: access,
    tokenType: "Bearer",
    expiresAt: new Date(now + expires * 1000).toISOString(),
    grantedScopes: scopes(candidate?.scope, fallback),
  };
  if (typeof refresh === "string") result.refreshToken = refresh;
  return result;
}
async function bounded(response: Response): Promise<string> {
  const length = response.headers.get("content-length");
  if (
    length !== null &&
    (!Number.isFinite(Number(length)) ||
      Number(length) < 0 ||
      Number(length) > MAX_RESPONSE_BYTES)
  )
    throw new GmailOAuthError(
      "invalid_response",
      "Gmail returned an oversized OAuth response.",
    );
  if (!response.body) return "";
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let bytes = 0,
    text = "";
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new GmailOAuthError(
        "invalid_response",
        "Gmail returned an oversized OAuth response.",
      );
    }
    text += decoder.decode(part.value, { stream: true });
  }
  return text + decoder.decode();
}
function safeReason(value: unknown): string {
  const text = typeof value === "string" ? value.toLowerCase() : "";
  return (
    [
      "client_secret",
      "code_verifier",
      "redirect_uri",
      "client_id",
      "grant_type",
    ].find((reason) => text.includes(reason)) ?? "unclassified"
  );
}
async function request(
  endpoint: string,
  body: URLSearchParams,
  dependencies: GmailOAuthDependencies,
): Promise<unknown> {
  const controller = new AbortController(),
    timeout = setTimeout(
      () => controller.abort(),
      dependencies.timeoutMs ?? GMAIL_OAUTH_REQUEST_TIMEOUT_MS,
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(await bounded(response));
    } catch (error) {
      throw new GmailOAuthError(
        response.ok ? "invalid_response" : "provider_rejected",
        response.ok
          ? "Gmail returned an unreadable OAuth response."
          : "Google rejected the Gmail credential request.",
        response.status,
        { cause: error },
      );
    }
    if (!response.ok) {
      const object =
        parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : undefined;
      const providerError =
        typeof object?.error === "string" && /^[a-z_]{1,64}$/.test(object.error)
          ? object.error
          : "unclassified";
      console.error("Gmail OAuth token request was rejected.", {
        providerError,
        providerReason: safeReason(object?.error_description),
        httpStatus: response.status,
      });
      throw new GmailOAuthError(
        object?.error === "invalid_grant"
          ? "reauthorization_required"
          : "provider_rejected",
        object?.error === "invalid_grant"
          ? "Gmail authorization is no longer valid. Connect it again."
          : "Google rejected the Gmail credential request.",
        response.status,
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof GmailOAuthError) throw error;
    throw new GmailOAuthError(
      "network_error",
      "Gmail authorization could not reach Google.",
      undefined,
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}
export function buildGmailAuthorizationUrl(
  config: GmailOAuthConfig,
  session: Pick<GmailOAuthSessionStart, "state" | "codeChallenge">,
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
    scope: GMAIL_READONLY_SCOPE,
    state: session.state,
  }).toString();
  return url.toString();
}
export function beginGmailAuthorization(
  config: GmailOAuthConfig,
  sessions: GmailOAuthSessionStore,
): GmailAuthorizationStart {
  const session = sessions.create();
  return {
    ...session,
    authorizationUrl: buildGmailAuthorizationUrl(config, session),
  };
}
export async function completeGmailAuthorization(
  input: {
    code: string;
    state: string | undefined;
    cookieBinding: string | undefined;
  },
  config: GmailOAuthConfig,
  sessions: GmailOAuthSessionStore,
  credentials: GmailCredentialStore,
  dependencies: GmailOAuthDependencies = {},
): Promise<GmailAccessToken> {
  const verifier = sessions.consume(
    input.state,
    input.cookieBinding,
  ).codeVerifier;
  const parsed = token(
    await request(
      GOOGLE_OAUTH_TOKEN_ENDPOINT,
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code(input.code),
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
      }),
      dependencies,
    ),
    (dependencies.now ?? Date.now)(),
    true,
  ) as InitialToken;
  await credentials.save({
    version: 1,
    refreshToken: parsed.refreshToken,
    grantedScopes: parsed.grantedScopes,
    connectedAt: new Date((dependencies.now ?? Date.now)()).toISOString(),
  });
  return {
    accessToken: parsed.accessToken,
    tokenType: parsed.tokenType,
    expiresAt: parsed.expiresAt,
    grantedScopes: parsed.grantedScopes,
  };
}
export async function refreshGmailAccessToken(
  config: GmailOAuthConfig,
  credentials: GmailCredentialStore,
  dependencies: GmailOAuthDependencies = {},
): Promise<GmailAccessToken> {
  const credential = await credentials.load();
  if (!credential)
    throw new GmailOAuthError("not_connected", "Gmail is not connected.");
  try {
    const parsed = token(
      await request(
        GOOGLE_OAUTH_TOKEN_ENDPOINT,
        new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: "refresh_token",
          refresh_token: credential.refreshToken,
        }),
        dependencies,
      ),
      (dependencies.now ?? Date.now)(),
      false,
      credential.grantedScopes,
    );
    if (parsed.refreshToken && parsed.refreshToken !== credential.refreshToken)
      await credentials.save({
        ...credential,
        refreshToken: parsed.refreshToken,
      });
    return {
      accessToken: parsed.accessToken,
      tokenType: parsed.tokenType,
      expiresAt: parsed.expiresAt,
      grantedScopes: parsed.grantedScopes,
    };
  } catch (error) {
    if (
      error instanceof GmailOAuthError &&
      error.code === "reauthorization_required"
    )
      await credentials.delete();
    throw error;
  }
}
export async function disconnectGmail(
  credentials: GmailCredentialStore,
  dependencies: GmailOAuthDependencies = {},
): Promise<{ localCredentialsDeleted: true; providerRevoked: boolean }> {
  let credential: GmailCredential | null;
  try {
    credential = await credentials.load();
  } catch {
    await credentials.delete();
    return { localCredentialsDeleted: true, providerRevoked: false };
  }
  await credentials.delete();
  if (!credential)
    return { localCredentialsDeleted: true, providerRevoked: false };
  const controller = new AbortController(),
    timeout = setTimeout(
      () => controller.abort(),
      dependencies.timeoutMs ?? GMAIL_OAUTH_REQUEST_TIMEOUT_MS,
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
        body: new URLSearchParams({
          token: credential.refreshToken,
        }).toString(),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      },
    );
    return { localCredentialsDeleted: true, providerRevoked: response.ok };
  } catch {
    return { localCredentialsDeleted: true, providerRevoked: false };
  } finally {
    clearTimeout(timeout);
  }
}
