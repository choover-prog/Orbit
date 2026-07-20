import { describe, expect, it, vi } from "vitest";
import { executeGoogleNestCommand, syncGoogleNest } from "./client";

const projectId = "project-123";
const structure = `enterprises/${projectId}/structures/home`;
const room = `${structure}/rooms/hall`;

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Google Nest client", () => {
  it("uses bounded GET-only discovery and normalizes an allowlisted capability set", async () => {
    const fetchImpl = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        expect(init?.method).toBe("GET");
        if (url.pathname.endsWith("/structures"))
          return json({
            structures: [
              {
                name: structure,
                traits: {
                  "sdm.structures.traits.Info": { customName: "Home" },
                },
              },
            ],
          });
        if (url.pathname.endsWith("/rooms"))
          return json({
            rooms: [
              {
                name: room,
                traits: {
                  "sdm.structures.traits.RoomInfo": { customName: "Hall" },
                },
              },
            ],
          });
        if (url.pathname.endsWith("/devices"))
          return json({
            devices: [
              {
                name: `enterprises/${projectId}/devices/thermostat`,
                type: "sdm.devices.types.THERMOSTAT",
                parentRelations: [{ parent: room, displayName: "Hall" }],
                traits: {
                  "sdm.devices.traits.Info": { customName: "Hall thermostat" },
                  "sdm.devices.traits.Connectivity": { status: "ONLINE" },
                  "sdm.devices.traits.Temperature": {
                    ambientTemperatureCelsius: 7,
                  },
                  "sdm.devices.traits.ThermostatMode": {
                    mode: "HEAT",
                    availableModes: ["HEAT", "OFF"],
                  },
                  "sdm.devices.traits.ThermostatTemperatureSetpoint": {
                    heatCelsius: 20,
                  },
                  "untrusted.command": { execute: true },
                },
              },
            ],
          });
        throw new Error(`unexpected ${url}`);
      },
    );
    const result = await syncGoogleNest(
      {
        now: new Date("2026-07-19T12:00:00Z"),
        accessToken: "token",
        projectId,
      },
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.completeness).toBe("complete");
    expect(result.batch.records[0].payload).toMatchObject({
      structures: [{ displayName: "Home" }],
      rooms: [{ displayName: "Hall" }],
      devices: [{ displayName: "Hall thermostat", supported: true }],
    });
    expect(JSON.stringify(result.batch.records)).not.toContain(
      "untrusted.command",
    );
    expect(JSON.stringify(result.batch.records)).not.toContain(
      "enterprises/project-123/devices/thermostat",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("sends only an allowlisted command to an exact device resource", async () => {
    const fetchImpl = vi.fn(async (_input, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        command: "sdm.devices.commands.ThermostatMode.SetMode",
        params: { mode: "HEAT" },
      });
      return json({});
    });
    const result = await executeGoogleNestCommand(
      {
        accessToken: "token",
        projectId,
        deviceReference: `enterprises/${projectId}/devices/thermostat`,
        command: "sdm.devices.commands.ThermostatMode.SetMode",
        params: { mode: "HEAT" },
      },
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(result).toEqual({ ok: true, results: {} });
  });
});
