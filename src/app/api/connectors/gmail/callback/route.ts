import type { NextRequest } from "next/server";
import {
  GMAIL_OAUTH_COOKIE_NAME,
  GmailOAuthSessionError,
} from "@/server/connectors/gmail/oauth-session";
import {
  clearGmailOAuthCookie,
  gmailConnectionsRedirect,
  type GmailRouteNotice,
} from "@/server/connectors/gmail/http";
import { getConnectorRegistry } from "@/server/connectors/registry";

export const dynamic = "force-dynamic";

interface GmailCallbackGateway {
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
    url.pathname === "/api/connectors/gmail/callback"
  );
}

function sessionFailureNotice(error: unknown): GmailRouteNotice {
  return error instanceof GmailOAuthSessionError &&
    error.code === "expired_session"
    ? "expired"
    : "invalid_callback";
}

function reportGmailCallbackFailure(error: unknown): void {
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

  console.error("Gmail OAuth callback failed.", {
    category:
      error instanceof Error &&
      [
        "GmailOAuthError",
        "GmailCredentialStoreError",
        "GmailOAuthSessionError",
      ].includes(error.name)
        ? error.name
        : "UnexpectedError",
    ...(safeCode ? { code: safeCode } : {}),
    ...(safeHttpStatus ? { httpStatus: safeHttpStatus } : {}),
  });
}

export async function handleGmailCallback(
  request: NextRequest,
  gateway: GmailCallbackGateway,
): Promise<Response> {
  const url = new URL(request.url);
  let notice: GmailRouteNotice = "failed";
  const cookieBinding = request.cookies.get(GMAIL_OAUTH_COOKIE_NAME)?.value;
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
      reportGmailCallbackFailure(error);
      notice =
        error instanceof GmailOAuthSessionError
          ? sessionFailureNotice(error)
          : "failed";
    }
  }

  const response = gmailConnectionsRedirect(request, notice);
  clearGmailOAuthCookie(response);
  return response;
}

export async function GET(request: NextRequest): Promise<Response> {
  return handleGmailCallback(request, getConnectorRegistry().gmail);
}
