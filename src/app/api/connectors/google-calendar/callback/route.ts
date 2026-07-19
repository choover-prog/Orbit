import type { NextRequest } from "next/server";
import {
  GoogleCalendarCredentialStoreError,
  GoogleCalendarOAuthError,
  GOOGLE_CALENDAR_OAUTH_COOKIE_NAME,
  GoogleCalendarOAuthSessionError,
} from "@/server/connectors/google-calendar";
import {
  calendarConnectionsRedirect,
  clearCalendarOAuthCookie,
  type CalendarRouteNotice,
} from "@/server/connectors/google-calendar/http";
import { getConnectorRegistry } from "@/server/connectors/registry";

export const dynamic = "force-dynamic";

interface CalendarCallbackGateway {
  cancelAuthorization(
    state: string | undefined,
    cookieBinding: string | undefined,
  ): void;
  completeAuthorization(input: {
    code: string;
    state: string | undefined;
    cookieBinding: string | undefined;
  }): Promise<{ status: string }>;
}

function isExactLocalCallback(url: URL): boolean {
  return (
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
    url.port.length > 0 &&
    url.pathname === "/api/connectors/google-calendar/callback"
  );
}

function sessionFailureNotice(error: unknown): CalendarRouteNotice {
  return error instanceof GoogleCalendarOAuthSessionError &&
    error.code === "expired_session"
    ? "expired"
    : "invalid_callback";
}

function reportCalendarCallbackFailure(error: unknown): void {
  if (
    error instanceof GoogleCalendarOAuthError ||
    error instanceof GoogleCalendarCredentialStoreError ||
    error instanceof GoogleCalendarOAuthSessionError
  ) {
    console.error("Google Calendar OAuth callback failed.", {
      category: error.name,
      code: error.code,
      ...(error instanceof GoogleCalendarOAuthError && error.httpStatus
        ? { httpStatus: error.httpStatus }
        : {}),
    });
    return;
  }

  const candidate =
    error && typeof error === "object"
      ? (error as { code?: unknown; httpStatus?: unknown })
      : undefined;
  const safeCode =
    typeof candidate?.code === "string" && /^[a-z_]{1,64}$/.test(candidate.code)
      ? candidate.code
      : undefined;
  const safeHttpStatus =
    typeof candidate?.httpStatus === "number" &&
    Number.isInteger(candidate.httpStatus) &&
    candidate.httpStatus >= 400 &&
    candidate.httpStatus <= 599
      ? candidate.httpStatus
      : undefined;

  console.error("Google Calendar OAuth callback failed.", {
    category:
      error instanceof Error &&
      [
        "GoogleCalendarOAuthError",
        "GoogleCalendarCredentialStoreError",
        "GoogleCalendarOAuthSessionError",
      ].includes(error.name)
        ? error.name
        : "UnexpectedError",
    ...(safeCode ? { code: safeCode } : {}),
    ...(safeHttpStatus ? { httpStatus: safeHttpStatus } : {}),
  });
}

export async function handleGoogleCalendarCallback(
  request: NextRequest,
  gateway: CalendarCallbackGateway,
): Promise<Response> {
  const url = new URL(request.url);
  let notice: CalendarRouteNotice = "failed";
  const cookieBinding = request.cookies.get(
    GOOGLE_CALENDAR_OAUTH_COOKIE_NAME,
  )?.value;
  const state = url.searchParams.get("state") ?? undefined;

  if (!isExactLocalCallback(url)) {
    notice = "invalid_callback";
  } else if (url.searchParams.has("error")) {
    try {
      gateway.cancelAuthorization(state, cookieBinding);
      notice =
        url.searchParams.get("error") === "access_denied" ? "denied" : "failed";
    } catch (error) {
      notice = sessionFailureNotice(error);
    }
  } else {
    const code = url.searchParams.get("code") ?? "";
    try {
      const completed = await gateway.completeAuthorization({
        code,
        state,
        cookieBinding,
      });
      notice = completed.status === "fresh" ? "connected" : "failed";
    } catch (error) {
      reportCalendarCallbackFailure(error);
      notice = sessionFailureNotice(error);
      if (!(error instanceof GoogleCalendarOAuthSessionError))
        notice = "failed";
    }
  }

  const response = calendarConnectionsRedirect(request, notice);
  clearCalendarOAuthCookie(response);
  return response;
}

export async function GET(request: NextRequest): Promise<Response> {
  return handleGoogleCalendarCallback(request, getConnectorRegistry().calendar);
}
