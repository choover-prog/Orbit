export const GOOGLE_CALENDAR_CONNECTOR_ID = "calendar.google";

export const GOOGLE_CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.owned.readonly";

export const GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_OAUTH_TOKEN_ENDPOINT =
  "https://oauth2.googleapis.com/token";
export const GOOGLE_OAUTH_REVOKE_ENDPOINT =
  "https://oauth2.googleapis.com/revoke";

export const GOOGLE_CALENDAR_DEFAULT_REDIRECT_URI = "http://127.0.0.1:3000";

export interface GoogleCalendarOAuthConfig {
  clientId: string;
  redirectUri: string;
}

export type GoogleCalendarOAuthConfigResolution =
  | { ok: true; config: GoogleCalendarOAuthConfig }
  | { ok: false; message: string };

export interface GoogleCalendarOAuthEnvironment {
  ORBIT_GOOGLE_CALENDAR_CLIENT_ID?: string;
  ORBIT_GOOGLE_CALENDAR_REDIRECT_URI?: string;
}

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isLocalLoopbackRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.port.length > 0 &&
      Number(url.port) >= 1 &&
      Number(url.port) <= 65_535 &&
      url.pathname === "/" &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.search.length === 0 &&
      url.hash.length === 0
    );
  } catch {
    return false;
  }
}

/**
 * Resolve Orbit's publisher-provisioned public Desktop OAuth identity without
 * shipping it to browser code. The redirect is deliberately restricted to an
 * explicit loopback address; hostnames and externally routable callbacks fail
 * closed. Desktop clients are public clients, so Orbit never accepts or sends
 * a client secret.
 */
export function resolveGoogleCalendarOAuthConfig(
  environment: GoogleCalendarOAuthEnvironment = process.env as GoogleCalendarOAuthEnvironment,
): GoogleCalendarOAuthConfigResolution {
  const clientId = nonEmpty(environment.ORBIT_GOOGLE_CALENDAR_CLIENT_ID);
  const redirectUri =
    nonEmpty(environment.ORBIT_GOOGLE_CALENDAR_REDIRECT_URI) ??
    GOOGLE_CALENDAR_DEFAULT_REDIRECT_URI;

  if (!clientId || clientId.length > 2_048) {
    return {
      ok: false,
      message:
        "Google Calendar is unavailable because this Orbit build has not been provisioned for Google sign-in.",
    };
  }

  if (!isLocalLoopbackRedirect(redirectUri)) {
    return {
      ok: false,
      message:
        "Google Calendar OAuth must use an explicit local loopback redirect with a port.",
    };
  }

  return {
    ok: true,
    config: { clientId, redirectUri },
  };
}
