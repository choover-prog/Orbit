import { afterEach, describe, expect, it } from "vitest";
import * as snapshotRoute from "./route";
import { GET } from "./route";

const originalMode = process.env.ORBIT_WEATHER_MODE;

afterEach(() => {
  if (originalMode === undefined) delete process.env.ORBIT_WEATHER_MODE;
  else process.env.ORBIT_WEATHER_MODE = originalMode;
});

describe("GET /api/orbit/snapshot", () => {
  it("returns a no-store, normalized fixture snapshot", async () => {
    process.env.ORBIT_WEATHER_MODE = "fixture";
    const response = await GET(
      new Request("http://localhost/api/orbit/snapshot?context=weather"),
    );
    const body = (await response.json()) as OrbitSnapshotResponse;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.schemaVersion).toBe("1");
    expect(body.weather).toMatchObject({ status: "fresh", mode: "fixture" });
    expect(body.selectedAttentionId).toMatch(/^bundle_weather/u);
    expect(JSON.stringify(body)).not.toMatch(
      /current_units|hourly_units|utc_offset_seconds|latitude|longitude/u,
    );
  });

  it("exposes no write handler", () => {
    expect("POST" in snapshotRoute).toBe(false);
    expect("PUT" in snapshotRoute).toBe(false);
    expect("PATCH" in snapshotRoute).toBe(false);
    expect("DELETE" in snapshotRoute).toBe(false);
  });
});

interface OrbitSnapshotResponse {
  schemaVersion: string;
  selectedAttentionId: string | null;
  weather: { status: string; mode: string };
}
