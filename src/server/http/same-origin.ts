import { isTrustedOrbitLoopbackHost } from "./loopback-host";

const LOOPBACK_HOST = "127.0.0.1";

/**
 * Calendar lifecycle mutations are local-only and must originate from the
 * exact Orbit loopback origin that received the request.
 */
export function isTrustedLocalMutation(request: Request): boolean {
  return localMutationRejectionReason(request) === null;
}

export function localMutationRejectionReason(request: Request): string | null {
  let requestUrl: URL;
  let originUrl: URL;

  try {
    requestUrl = new URL(request.url);
    if (
      requestUrl.hostname !== LOOPBACK_HOST &&
      requestUrl.hostname !== "localhost"
    ) {
      return "request_host";
    }
    if (request.headers.get("sec-fetch-site") !== "same-origin") {
      return "fetch_site";
    }
    const origin = request.headers.get("origin");
    if (!origin) return "missing_origin";
    originUrl = new URL(origin);
    if (!isTrustedOrbitLoopbackHost(originUrl.host)) return "origin_host";
  } catch {
    return "invalid_url";
  }

  if (requestUrl.protocol !== "http:") return "request_protocol";
  if (originUrl.protocol !== "http:") return "origin_protocol";
  if (originUrl.hostname !== LOOPBACK_HOST) return "origin_hostname";
  if (originUrl.username !== "" || originUrl.password !== "") {
    return "origin_credentials";
  }
  return null;
}

export function forbiddenMutationResponse(reason = "local_origin"): Response {
  return Response.json(
    { error: "local_origin_required" },
    {
      status: 403,
      headers: {
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
        "x-orbit-local-rejection": reason,
      },
    },
  );
}
