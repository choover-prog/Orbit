import type { NextRequest } from "next/server";
import { getConnectorRegistry } from "@/server/connectors/registry";
import {
  clearNestCookie,
  nestRedirect,
} from "@/server/connectors/google-nest/http";
import { GOOGLE_NEST_OAUTH_COOKIE } from "@/server/connectors/google-nest/oauth-session";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  let notice: "connected" | "denied" | "invalid_callback" | "failed" = "failed";
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.pathname !== "/api/connectors/google-nest/callback"
  )
    notice = "invalid_callback";
  else if (url.searchParams.has("error"))
    notice =
      url.searchParams.get("error") === "access_denied" ? "denied" : "failed";
  else {
    try {
      const state = await getConnectorRegistry().nest.completeAuthorization({
        code: url.searchParams.get("code") ?? "",
        state: url.searchParams.get("state") ?? undefined,
        cookieBinding: request.cookies.get(GOOGLE_NEST_OAUTH_COOKIE)?.value,
      });
      notice = state.status === "fresh" ? "connected" : "failed";
    } catch {
      notice = "failed";
    }
  }
  const response = nestRedirect(request, notice);
  clearNestCookie(response);
  return response;
}
