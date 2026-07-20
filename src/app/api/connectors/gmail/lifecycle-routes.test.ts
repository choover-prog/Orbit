import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import * as callbackRoute from "./callback/route";
import { GET as callback, handleGmailCallback } from "./callback/route";
import * as connectRoute from "./connect/route";
import { POST as connect } from "./connect/route";
import * as disconnectRoute from "./disconnect/route";
import { POST as disconnect } from "./disconnect/route";
import * as syncRoute from "./sync/route";
import { POST as sync } from "./sync/route";
import { gmailOAuthCallbackContinuation } from "@/server/connectors/gmail/http";

function mutation(path: string, origin = "http://127.0.0.1:3000") {
  return new Request(`http://127.0.0.1:3000${path}`, {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin,
      "sec-fetch-site":
        origin === "http://127.0.0.1:3000" ? "same-origin" : "cross-site",
    },
  });
}

describe("Gmail lifecycle routes", () => {
  it("forwards only bounded Desktop-loopback callback values from the root", () => {
    expect(
      gmailOAuthCallbackContinuation({
        code: "sensitive-code",
        state: "state-value",
      }),
    ).toBe(
      "/api/connectors/gmail/callback?state=state-value&code=sensitive-code",
    );
    expect(
      gmailOAuthCallbackContinuation({
        error: "access_denied",
        state: "state-value",
      }),
    ).toBe(
      "/api/connectors/gmail/callback?state=state-value&error=access_denied",
    );
    expect(gmailOAuthCallbackContinuation({ state: "attention" })).toBeNull();
    expect(
      gmailOAuthCallbackContinuation({
        code: ["one", "two"],
        state: "state-value",
      }),
    ).toBe(
      "/api/connectors/gmail/callback?state=state-value&error=provider_error",
    );
  });

  it("rejects cross-origin lifecycle mutations before connector access", async () => {
    for (const handler of [connect, sync, disconnect]) {
      const response = await handler(
        mutation("/api/connectors/gmail/test", "https://attacker.example"),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "local_origin_required" });
    }
  });

  it("rejects a callback delivered to a non-loopback origin", async () => {
    const response = await callback(
      new NextRequest(
        "https://attacker.example/api/connectors/gmail/callback?code=secret&state=state",
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/connections?gmail=invalid_callback",
    );
    expect(response.headers.get("set-cookie")).not.toContain("secret");
  });

  it("completes a valid callback server-side and strips sensitive values", async () => {
    const completeAuthorization = vi.fn(async () => ({ status: "fresh" }));
    const response = await handleGmailCallback(
      new NextRequest(
        "http://127.0.0.1:3000/api/connectors/gmail/callback?code=fake-sensitive-code&state=fake-state",
        {
          headers: {
            cookie: "orbit_google_gmail_oauth=fake-cookie-binding",
          },
        },
      ),
      {
        cancelAuthorization: vi.fn(),
        completeAuthorization,
      },
    );

    expect(completeAuthorization).toHaveBeenCalledWith({
      code: "fake-sensitive-code",
      state: "fake-state",
      cookieBinding: "fake-cookie-binding",
    });
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/connections?gmail=connected",
    );
    expect(response.headers.get("location")).not.toContain(
      "fake-sensitive-code",
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("does not claim the first read completed when authorization sync fails", async () => {
    const response = await handleGmailCallback(
      new NextRequest(
        "http://127.0.0.1:3000/api/connectors/gmail/callback?code=fake-code&state=fake-state",
        {
          headers: {
            cookie: "orbit_google_gmail_oauth=fake-cookie-binding",
          },
        },
      ),
      {
        cancelAuthorization: vi.fn(),
        completeAuthorization: vi.fn(async () => ({ status: "unavailable" })),
      },
    );

    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/connections?gmail=failed",
    );
  });

  it("handles a denied callback without completing authorization", async () => {
    const cancelAuthorization = vi.fn();
    const completeAuthorization = vi.fn(async () => ({ status: "fresh" }));
    const response = await handleGmailCallback(
      new NextRequest(
        "http://127.0.0.1:3000/api/connectors/gmail/callback?error=access_denied&state=fake-state",
        {
          headers: {
            cookie: "orbit_google_gmail_oauth=fake-cookie-binding",
          },
        },
      ),
      { cancelAuthorization, completeAuthorization },
    );

    expect(cancelAuthorization).toHaveBeenCalledWith(
      "fake-state",
      "fake-cookie-binding",
    );
    expect(completeAuthorization).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/connections?gmail=denied",
    );
  });

  it("exposes no GET mutation for connect, sync, or disconnect", () => {
    expect("GET" in connectRoute).toBe(false);
    expect("GET" in syncRoute).toBe(false);
    expect("GET" in disconnectRoute).toBe(false);
    expect("POST" in callbackRoute).toBe(false);
  });
});
