import type { GoogleNestOAuthConfig } from "./config";
import {
  GOOGLE_NEST_REVOKE_ENDPOINT,
  GOOGLE_NEST_SCOPE,
  GOOGLE_NEST_TOKEN_ENDPOINT,
  googleNestAuthorizationUrl,
} from "./config";
import type { GoogleNestCredentialStore } from "./credential-store";
import type { GoogleNestOAuthSessionStore } from "./oauth-session";

const TIMEOUT_MS = 10_000;
const MAX_BODY = 64 * 1024;

export interface GoogleNestAccessToken {
  accessToken: string;
  expiresAt: string;
}

export class GoogleNestOAuthError extends Error {
  constructor(
    public readonly code:
      | "not_connected"
      | "reauthorization_required"
      | "insufficient_scope"
      | "provider_rejected"
      | "invalid_response"
      | "network_error",
    message: string,
  ) {
    super(message);
    this.name = "GoogleNestOAuthError";
  }
}

function body(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new GoogleNestOAuthError(
      "invalid_response",
      "Google returned an invalid OAuth response.",
    );
  return value as Record<string, unknown>;
}

async function tokenRequest(
  params: URLSearchParams,
  fetchImpl = fetch,
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(GOOGLE_NEST_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {
    throw new GoogleNestOAuthError(
      "network_error",
      "Google authorization could not be reached.",
    );
  });
  const text = await response.text();
  if (text.length > MAX_BODY)
    throw new GoogleNestOAuthError(
      "invalid_response",
      "Google returned an oversized OAuth response.",
    );
  let parsed: Record<string, unknown>;
  try {
    parsed = body(JSON.parse(text));
  } catch (error) {
    if (error instanceof GoogleNestOAuthError) throw error;
    throw new GoogleNestOAuthError(
      "invalid_response",
      "Google returned malformed OAuth data.",
    );
  }
  if (!response.ok) {
    const error = parsed.error;
    throw new GoogleNestOAuthError(
      error === "invalid_grant"
        ? "reauthorization_required"
        : "provider_rejected",
      "Google rejected the Google Nest credential request.",
    );
  }
  return parsed;
}

function parseToken(
  value: Record<string, unknown>,
  now: number,
  requireRefresh: boolean,
): GoogleNestAccessToken & { refreshToken?: string } {
  const scopes =
    typeof value.scope === "string" ? value.scope.split(/\s+/u) : [];
  if (!scopes.includes(GOOGLE_NEST_SCOPE))
    throw new GoogleNestOAuthError(
      "insufficient_scope",
      "Google Nest did not return the required authorization.",
    );
  if (
    typeof value.access_token !== "string" ||
    !value.access_token ||
    value.access_token.length > 16_384 ||
    typeof value.expires_in !== "number" ||
    !Number.isFinite(value.expires_in) ||
    value.expires_in < 60 ||
    (value.token_type !== undefined && value.token_type !== "Bearer") ||
    (requireRefresh &&
      (typeof value.refresh_token !== "string" || !value.refresh_token))
  )
    throw new GoogleNestOAuthError(
      "invalid_response",
      "Google Nest did not return the required authorization.",
    );
  return {
    accessToken: value.access_token,
    expiresAt: new Date(now + value.expires_in * 1000).toISOString(),
    ...(typeof value.refresh_token === "string"
      ? { refreshToken: value.refresh_token }
      : {}),
  };
}

export function beginGoogleNestAuthorization(
  config: GoogleNestOAuthConfig,
  sessions: GoogleNestOAuthSessionStore,
) {
  const session = sessions.create();
  return {
    authorizationUrl: googleNestAuthorizationUrl(config, session),
    cookieBinding: session.cookieBinding,
    state: session.state,
  };
}

export async function completeGoogleNestAuthorization(
  input: { code: string; state?: string; cookieBinding?: string },
  config: GoogleNestOAuthConfig,
  sessions: GoogleNestOAuthSessionStore,
  credentials: GoogleNestCredentialStore,
  fetchImpl?: typeof fetch,
): Promise<GoogleNestAccessToken> {
  if (!input.code || input.code.length > 4096)
    throw new GoogleNestOAuthError(
      "provider_rejected",
      "Google returned an invalid authorization code.",
    );
  const verifier = sessions.consume(input.state, input.cookieBinding);
  const parsed = parseToken(
    await tokenRequest(
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: input.code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
      }),
      fetchImpl,
    ),
    Date.now(),
    true,
  );
  await credentials.save({
    version: 1,
    refreshToken: parsed.refreshToken!,
    grantedScopes: [GOOGLE_NEST_SCOPE],
    connectedAt: new Date().toISOString(),
  });
  return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt };
}

export async function refreshGoogleNestAccessToken(
  config: GoogleNestOAuthConfig,
  credentials: GoogleNestCredentialStore,
  fetchImpl?: typeof fetch,
): Promise<GoogleNestAccessToken> {
  const credential = await credentials.load();
  if (!credential)
    throw new GoogleNestOAuthError(
      "not_connected",
      "Google Nest is not connected.",
    );
  try {
    return parseToken(
      await tokenRequest(
        new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: credential.refreshToken,
          grant_type: "refresh_token",
        }),
        fetchImpl,
      ),
      Date.now(),
      false,
    );
  } catch (error) {
    if (
      error instanceof GoogleNestOAuthError &&
      error.code === "reauthorization_required"
    )
      await credentials.delete();
    throw error;
  }
}

export async function disconnectGoogleNest(
  credentials: GoogleNestCredentialStore,
  fetchImpl = fetch,
): Promise<{ localCredentialsDeleted: true; providerRevoked: boolean }> {
  let credential = null;
  try {
    credential = await credentials.load();
  } catch {
    /* local deletion still wins */
  }
  await credentials.delete();
  if (!credential)
    return { localCredentialsDeleted: true, providerRevoked: false };
  try {
    const response = await fetchImpl(GOOGLE_NEST_REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: credential.refreshToken }).toString(),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { localCredentialsDeleted: true, providerRevoked: response.ok };
  } catch {
    return { localCredentialsDeleted: true, providerRevoked: false };
  }
}
