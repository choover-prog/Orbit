export const GMAIL_CONNECTOR_ID = "email.google";

export const GMAIL_READONLY_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly";

export const GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_OAUTH_TOKEN_ENDPOINT =
  "https://oauth2.googleapis.com/token";
export const GOOGLE_OAUTH_REVOKE_ENDPOINT =
  "https://oauth2.googleapis.com/revoke";

export const GMAIL_DEFAULT_REDIRECT_URI = "http://127.0.0.1:3000";

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GmailOAuthEnvironment {
  ORBIT_GOOGLE_GMAIL_CLIENT_ID?: string;
  ORBIT_GOOGLE_GMAIL_CLIENT_SECRET?: string;
  ORBIT_GOOGLE_GMAIL_REDIRECT_URI?: string;
}

export type GmailOAuthConfigResolution =
  { ok: true; config: GmailOAuthConfig } | { ok: false; message: string };

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
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

/** Resolve publisher-provisioned Gmail OAuth metadata on the server only. */
export function resolveGmailOAuthConfig(
  environment: GmailOAuthEnvironment = process.env as GmailOAuthEnvironment,
): GmailOAuthConfigResolution {
  const clientId = nonEmpty(environment.ORBIT_GOOGLE_GMAIL_CLIENT_ID);
  const clientSecret = nonEmpty(environment.ORBIT_GOOGLE_GMAIL_CLIENT_SECRET);
  const redirectUri =
    nonEmpty(environment.ORBIT_GOOGLE_GMAIL_REDIRECT_URI) ??
    GMAIL_DEFAULT_REDIRECT_URI;

  if (
    !clientId ||
    clientId.length > 2_048 ||
    !clientSecret ||
    clientSecret.length > 2_048
  ) {
    return {
      ok: false,
      message:
        "Gmail is unavailable because this Orbit build has not been provisioned for Google sign-in.",
    };
  }

  if (!isLocalLoopbackRedirect(redirectUri)) {
    return {
      ok: false,
      message:
        "Gmail OAuth must use an explicit local loopback redirect with a port.",
    };
  }

  return {
    ok: true,
    config: { clientId, clientSecret, redirectUri },
  };
}
