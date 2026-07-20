import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/device-atlas", () => {
  it("returns the fictional, non-executing atlas snapshot", async () => {
    const response = GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.mode).toBe("fixture");
    expect(body.privacy.autonomousControl).toBe(false);
    expect(body.automationDrafts[0].state).toBe("simulated");
  });
});
