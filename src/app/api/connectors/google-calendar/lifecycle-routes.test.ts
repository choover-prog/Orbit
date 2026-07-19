import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as callbackRoute from "./callback/route";
import {
  GET as callback,
  handleGoogleCalendarCallback,
} from "./callback/route";
import * as connectRoute from "./connect/route";
import { POST as connect } from "./connect/route";
import * as disconnectRoute from "./disconnect/route";
import { POST as disconnect } from "./disconnect/route";
import * as syncRoute from "./sync/route";
import { POST as sync } from "./sync/route";
import { calendarOAuthCallbackContinuation } from "@/server/connectors/google-calendar/http";
import {
  getConnectorRegistry,
  resetConnectorRegistryForTests,
} from "@/server/connectors/registry";

const originalMode = process.env.ORBIT_GOOGLE_CALENDAR_MODE;

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

beforeEach(() => {
  process.env.ORBIT_GOOGLE_CALENDAR_MODE = "fixture";
  resetConnectorRegistryForTests();
});

afterEach(() => {
  resetConnectorRegistryForTests();
  if (originalMode === undefined) delete process.env.ORBIT_GOOGLE_CALENDAR_MODE;
  else process.env.ORBIT_GOOGLE_CALENDAR_MODE = originalMode;
});

describe("Google Calendar lifecycle routes", () => {
  it("forwards only bounded Desktop-loopback callback values from the root", () => {
    expect(
      calendarOAuthCallbackContinuation({
        code: "sensitive-code",
        state: "state-value",
      }),
    ).toBe(
      "/api/connectors/google-calendar/callback?state=state-value&code=sensitive-code",
    );
    expect(
      calendarOAuthCallbackContinuation({
        error: "access_denied",
        state: "state-value",
      }),
    ).toBe(
      "/api/connectors/google-calendar/callback?state=state-value&error=access_denied",
    );
    expect(
      calendarOAuthCallbackContinuation({ state: "attention" }),
    ).toBeNull();
    expect(
      calendarOAuthCallbackContinuation({
        code: ["one", "two"],
        state: "state-value",
      }),
    ).toBe(
      "/api/connectors/google-calendar/callback?state=state-value&error=provider_error",
    );
  });

  it("connects, synchronizes, and disconnects through offline fixture mode", async () => {
    const connectResponse = await connect(
      mutation("/api/connectors/google-calendar/connect"),
    );
    expect(connectResponse.status).toBe(303);
    expect(connectResponse.headers.get("location")).toMatch(
      /\/connections\?calendar=connected$/u,
    );

    const connected = await getConnectorRegistry().calendar.read(new Date());
    expect(connected).toMatchObject({
      status: "fresh",
      authorization: "connected",
      mode: "fixture",
    });
    expect(connected.batch?.records).toHaveLength(3);

    const syncResponse = await sync(
      mutation("/api/connectors/google-calendar/sync"),
    );
    expect(syncResponse.headers.get("location")).toMatch(
      /\/connections\?calendar=current$/u,
    );

    const disconnectResponse = await disconnect(
      mutation("/api/connectors/google-calendar/disconnect"),
    );
    expect(disconnectResponse.headers.get("location")).toMatch(
      /\/connections\?calendar=disconnected$/u,
    );
    await expect(
      getConnectorRegistry().calendar.authorizationStatus(),
    ).resolves.toBe("disconnected");
  });

  it("rejects cross-origin lifecycle mutations", async () => {
    for (const handler of [connect, sync, disconnect]) {
      const response = await handler(
        mutation(
          "/api/connectors/google-calendar/test",
          "https://attacker.example",
        ),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "local_origin_required" });
    }
  });

  it("rejects a callback delivered to a non-loopback origin", async () => {
    const response = await callback(
      new NextRequest(
        "https://attacker.example/api/connectors/google-calendar/callback?code=secret&state=state",
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/connections?calendar=invalid_callback",
    );
    expect(response.headers.get("set-cookie")).not.toContain("secret");
  });

  it("completes a valid callback server-side and strips sensitive query values", async () => {
    const completeAuthorization = vi.fn(async () => ({ status: "fresh" }));
    const response = await handleGoogleCalendarCallback(
      new NextRequest(
        "http://127.0.0.1:3000/api/connectors/google-calendar/callback?code=fake-sensitive-code&state=fake-state",
        {
          headers: {
            cookie: "orbit_google_calendar_oauth=fake-cookie-binding",
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
      "http://127.0.0.1:3000/connections?calendar=connected",
    );
    expect(response.headers.get("location")).not.toContain(
      "fake-sensitive-code",
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("does not claim the first read completed when authorization sync fails", async () => {
    const response = await handleGoogleCalendarCallback(
      new NextRequest(
        "http://127.0.0.1:3000/api/connectors/google-calendar/callback?code=fake-code&state=fake-state",
        {
          headers: {
            cookie: "orbit_google_calendar_oauth=fake-cookie-binding",
          },
        },
      ),
      {
        cancelAuthorization: vi.fn(),
        completeAuthorization: vi.fn(async () => ({ status: "unavailable" })),
      },
    );

    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/connections?calendar=failed",
    );
  });

  it("exposes no GET mutation for connect, sync, or disconnect", () => {
    expect("GET" in connectRoute).toBe(false);
    expect("GET" in syncRoute).toBe(false);
    expect("GET" in disconnectRoute).toBe(false);
    expect("POST" in callbackRoute).toBe(false);
  });
});
