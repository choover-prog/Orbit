import { NextResponse } from "next/server";
import { GOOGLE_NEST_OAUTH_COOKIE } from "./oauth-session";

export type GoogleNestNotice =
  | "connected"
  | "disconnected"
  | "synced"
  | "current"
  | "denied"
  | "invalid_callback"
  | "failed"
  | "local_only";

export function nestRedirect(
  request: Request,
  notice: GoogleNestNotice,
): NextResponse {
  const source = new URL(request.url);
  const destination = new URL(
    "/connections",
    `http://127.0.0.1:${source.port || "3000"}`,
  );
  destination.searchParams.set("nest", notice);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}

export function clearNestCookie(response: NextResponse): void {
  response.cookies.set(GOOGLE_NEST_OAUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0,
  });
}

export function nestOAuthContinuation(input: {
  code?: string | string[];
  error?: string | string[];
  state?: string | string[];
}): string | null {
  if (input.code === undefined && input.error === undefined) return null;
  const url = new URL(
    "/api/connectors/google-nest/callback",
    "http://127.0.0.1",
  );
  if (typeof input.state === "string" && input.state.length <= 256)
    url.searchParams.set("state", input.state);
  if (
    typeof input.code === "string" &&
    input.code.length <= 8192 &&
    input.error === undefined
  )
    url.searchParams.set("code", input.code);
  else
    url.searchParams.set(
      "error",
      input.error === "access_denied" ? "access_denied" : "provider_error",
    );
  return `${url.pathname}${url.search}`;
}
