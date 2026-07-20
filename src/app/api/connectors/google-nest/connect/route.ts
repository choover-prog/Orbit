import { NextResponse } from "next/server";
import { getConnectorRegistry } from "@/server/connectors/registry";
import { nestRedirect } from "@/server/connectors/google-nest/http";
import {
  GOOGLE_NEST_OAUTH_COOKIE,
  googleNestCookieOptions,
} from "@/server/connectors/google-nest/oauth-session";
import {
  forbiddenMutationResponse,
  localMutationRejectionReason,
} from "@/server/http/same-origin";

export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  const rejection = localMutationRejectionReason(request);
  if (rejection) return forbiddenMutationResponse(rejection);
  try {
    const result = await getConnectorRegistry().nest.beginAuthorization();
    if (result.kind === "fixture")
      return nestRedirect(
        request,
        result.state.status === "fresh" ? "connected" : "failed",
      );
    const response = NextResponse.redirect(
      result.authorization.authorizationUrl,
      303,
    );
    response.cookies.set(
      GOOGLE_NEST_OAUTH_COOKIE,
      result.authorization.cookieBinding,
      googleNestCookieOptions(result.redirectUri),
    );
    response.headers.set("cache-control", "no-store");
    response.headers.set("referrer-policy", "no-referrer");
    return response;
  } catch {
    return nestRedirect(request, "failed");
  }
}
