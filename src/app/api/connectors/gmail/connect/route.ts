import { NextResponse } from "next/server";
import {
  GMAIL_OAUTH_COOKIE_NAME,
  gmailOAuthCookieOptions,
} from "@/server/connectors/gmail/oauth-session";
import { gmailConnectionsRedirect } from "@/server/connectors/gmail/http";
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
    const result = await getConnectorRegistry().gmail.beginAuthorization();
    if (result.kind === "fixture") {
      return gmailConnectionsRedirect(
        request,
        result.state.status === "fresh" ? "connected" : "failed",
      );
    }

    const response = NextResponse.redirect(
      result.authorization.authorizationUrl,
      303,
    );
    response.cookies.set(
      GMAIL_OAUTH_COOKIE_NAME,
      result.authorization.cookieBinding,
      gmailOAuthCookieOptions(result.redirectUri),
    );
    response.headers.set("cache-control", "no-store");
    response.headers.set("referrer-policy", "no-referrer");
    return response;
  } catch {
    return gmailConnectionsRedirect(request, "failed");
  }
}
