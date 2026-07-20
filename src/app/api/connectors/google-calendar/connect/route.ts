import { NextResponse } from "next/server";
import {
  GOOGLE_CALENDAR_OAUTH_COOKIE_NAME,
  googleCalendarOAuthCookieOptions,
} from "@/server/connectors/google-calendar";
import { calendarConnectionsRedirect } from "@/server/connectors/google-calendar/http";
import { getConnectorRegistry } from "@/server/connectors/registry";
import {
  forbiddenMutationResponse,
  localMutationRejectionReason,
} from "@/server/http/same-origin";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const rejection = localMutationRejectionReason(request);
  if (rejection) return forbiddenMutationResponse(rejection);

  try {
    const result = await getConnectorRegistry().calendar.beginAuthorization();
    if (result.kind === "fixture") {
      return calendarConnectionsRedirect(
        request,
        result.state.status === "fresh" ? "connected" : "failed",
      );
    }

    const response = NextResponse.redirect(
      result.authorization.authorizationUrl,
      303,
    );
    response.cookies.set(
      GOOGLE_CALENDAR_OAUTH_COOKIE_NAME,
      result.authorization.cookieBinding,
      googleCalendarOAuthCookieOptions(result.redirectUri),
    );
    response.headers.set("cache-control", "no-store");
    response.headers.set("referrer-policy", "no-referrer");
    return response;
  } catch {
    return calendarConnectionsRedirect(request, "failed");
  }
}
