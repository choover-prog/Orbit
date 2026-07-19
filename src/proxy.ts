import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isTrustedOrbitLoopbackHost } from "@/server/http/loopback-host";

export { isTrustedOrbitLoopbackHost } from "@/server/http/loopback-host";

/**
 * Orbit has no multi-user authentication in this local-only stage. The raw
 * Host header is therefore a security boundary: accepting a DNS name would
 * let a rebinding origin read the local app with the user's browser.
 */
export function proxy(request: NextRequest): NextResponse {
  const loopbackHost = request.headers.get("host");
  if (!isTrustedOrbitLoopbackHost(loopbackHost)) {
    return new NextResponse(
      "Orbit is available only on its local loopback address.",
      {
        status: 403,
        headers: {
          "cache-control": "no-store",
          "content-type": "text/plain; charset=utf-8",
          "referrer-policy": "no-referrer",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }

  const response = NextResponse.next();
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "same-origin");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
