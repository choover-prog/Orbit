import { describe, expect, it } from "vitest";
import * as approve from "./actions/approve/route";
import * as plan from "./actions/plan/route";
import * as connect from "./connect/route";
import * as disconnect from "./disconnect/route";
import * as start from "./streams/start/route";
import * as stop from "./streams/stop/route";
import * as sync from "./sync/route";
import { nestOAuthContinuation } from "@/server/connectors/google-nest/http";

function crossSite(path: string) {
  return new Request(`http://127.0.0.1:3000${path}`, {
    method: "POST",
    headers: {
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site",
      "content-type": "application/json",
    },
    body: "{}",
  });
}

describe("Google Nest route boundary", () => {
  it("forwards bounded root callback values without choosing authority from the query", () => {
    expect(nestOAuthContinuation({ code: "code", state: "state" })).toBe(
      "/api/connectors/google-nest/callback?state=state&code=code",
    );
    expect(nestOAuthContinuation({ state: "state" })).toBeNull();
  });

  it("rejects cross-site lifecycle, stream, and command requests", async () => {
    for (const [path, handler] of [
      ["/connect", connect.POST],
      ["/sync", sync.POST],
      ["/disconnect", disconnect.POST],
      ["/actions/plan", plan.POST],
      ["/actions/approve", approve.POST],
      ["/streams/start", start.POST],
      ["/streams/stop", stop.POST],
    ] as const) {
      const response = await handler(
        crossSite(`/api/connectors/google-nest${path}`),
      );
      expect(response.status).toBe(403);
    }
  });

  it("exposes no GET mutation endpoints", () => {
    for (const route of [approve, plan, connect, disconnect, start, stop, sync])
      expect("GET" in route).toBe(false);
  });
});
