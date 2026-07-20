export const GOOGLE_NEST_CONNECTOR_ID = "home.google-nest";
export const GOOGLE_NEST_SCOPE = "https://www.googleapis.com/auth/sdm.service";
export const GOOGLE_NEST_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_NEST_REVOKE_ENDPOINT =
  "https://oauth2.googleapis.com/revoke";
export const GOOGLE_NEST_PCM_ORIGIN = "https://nestservices.google.com";
export const GOOGLE_NEST_API_ORIGIN =
  "https://smartdevicemanagement.googleapis.com";
export const GOOGLE_NEST_DEFAULT_REDIRECT_URI = "http://127.0.0.1:3000";

export interface GoogleNestOAuthConfig {
  clientId: string;
  clientSecret: string;
  projectId: string;
  redirectUri: string;
}

export interface GoogleNestEnvironment {
  ORBIT_GOOGLE_NEST_CLIENT_ID?: string;
  ORBIT_GOOGLE_NEST_CLIENT_SECRET?: string;
  ORBIT_GOOGLE_NEST_PROJECT_ID?: string;
  ORBIT_GOOGLE_NEST_REDIRECT_URI?: string;
}

export type GoogleNestConfigResolution =
  { ok: true; config: GoogleNestOAuthConfig } | { ok: false; message: string };

function value(input: string | undefined): string | undefined {
  const trimmed = input?.trim();
  return trimmed || undefined;
}

function localRedirect(input: string): boolean {
  try {
    const url = new URL(input);
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      Number(url.port) >= 1 &&
      Number(url.port) <= 65_535 &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function resolveGoogleNestConfig(
  environment: GoogleNestEnvironment = process.env as GoogleNestEnvironment,
): GoogleNestConfigResolution {
  const clientId = value(environment.ORBIT_GOOGLE_NEST_CLIENT_ID);
  const clientSecret = value(environment.ORBIT_GOOGLE_NEST_CLIENT_SECRET);
  const projectId = value(environment.ORBIT_GOOGLE_NEST_PROJECT_ID);
  const redirectUri =
    value(environment.ORBIT_GOOGLE_NEST_REDIRECT_URI) ??
    GOOGLE_NEST_DEFAULT_REDIRECT_URI;
  if (!clientId || !clientSecret || !projectId) {
    return {
      ok: false,
      message:
        "Google Nest is unavailable because this Orbit build has not been provisioned for Device Access.",
    };
  }
  if (
    clientId.length > 2_048 ||
    clientSecret.length > 2_048 ||
    !/^[A-Za-z0-9-]{1,128}$/u.test(projectId)
  ) {
    return {
      ok: false,
      message: "Google Nest publisher configuration is invalid.",
    };
  }
  if (!localRedirect(redirectUri)) {
    return {
      ok: false,
      message:
        "Google Nest OAuth must use an explicit local loopback redirect with a port.",
    };
  }
  return {
    ok: true,
    config: { clientId, clientSecret, projectId, redirectUri },
  };
}

export function googleNestAuthorizationUrl(
  config: GoogleNestOAuthConfig,
  input: { state: string; codeChallenge: string },
): string {
  const url = new URL(
    `/partnerconnections/${encodeURIComponent(config.projectId)}/auth`,
    GOOGLE_NEST_PCM_ORIGIN,
  );
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_NEST_SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
