import { NextResponse } from "next/server";
import { isTrustedOrbitLoopbackHost } from "@/server/http/loopback-host";
import { GOOGLE_CALENDAR_OAUTH_COOKIE_NAME } from "./oauth-session";

export type CalendarRouteNotice =
  | "connected"
  | "disconnected"
  | "synced"
  | "current"
  | "denied"
  | "expired"
  | "invalid_callback"
  | "failed"
  | "local_only";

export interface CalendarOAuthCallbackSearchParams {
  code?: string | string[];
  error?: string | string[];
  state?: string | string[];
}

function singleQueryValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

/**
 * A Desktop OAuth client returns to the documented root loopback URI. Forward
 * only the bounded protocol values to Orbit's internal callback handler; all
 * other provider query values are discarded.
 */
export function calendarOAuthCallbackContinuation(
  searchParams: CalendarOAuthCallbackSearchParams,
): string | null {
  const hasCallbackSignal =
    searchParams.code !== undefined || searchParams.error !== undefined;
  if (!hasCallbackSignal) return null;

  const destination = new URL(
    "/api/connectors/google-calendar/callback",
    "http://127.0.0.1",
  );
  const state = singleQueryValue(searchParams.state);
  const code = singleQueryValue(searchParams.code);
  const error = singleQueryValue(searchParams.error);

  if (state && state.length <= 256) {
    destination.searchParams.set("state", state);
  }

  if (code && !error && code.length <= 8_192) {
    destination.searchParams.set("code", code);
  } else {
    destination.searchParams.set(
      "error",
      error === "access_denied" ? "access_denied" : "provider_error",
    );
  }

  return `${destination.pathname}${destination.search}`;
}

export function calendarConnectionsRedirect(
  request: Request,
  notice: CalendarRouteNotice,
): NextResponse {
  const requestUrl = new URL(request.url);
  const postOrigin =
    request.method === "POST"
      ? trustedLoopbackOrigin(request.headers.get("origin"))
      : undefined;
  const requestOrigin =
    requestUrl.protocol === "http:" &&
    (requestUrl.hostname === "127.0.0.1" ||
      requestUrl.hostname === "localhost") &&
    isTrustedOrbitLoopbackHost(`127.0.0.1:${requestUrl.port}`)
      ? `http://127.0.0.1:${requestUrl.port}`
      : undefined;
  const safeOrigin = postOrigin ?? requestOrigin ?? "http://127.0.0.1:3000";
  const destination = new URL("/connections", safeOrigin);
  destination.searchParams.set("calendar", notice);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}

function trustedLoopbackOrigin(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      isTrustedOrbitLoopbackHost(url.host)
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}

export function clearCalendarOAuthCookie(response: NextResponse): void {
  response.cookies.set(GOOGLE_CALENDAR_OAUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0,
  });
}
