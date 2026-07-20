import type {
  HomeContextPayload,
  SourceRecord,
} from "@/domain/orbit/connectors";
import { GOOGLE_NEST_CONNECTOR_ID } from "./config";
import type { GoogleNestSyncSource } from "./types";

export interface GoogleNestFixtureState {
  mode: "heat" | "cool" | "heat_cool" | "off";
  heatCelsius: number;
  coolCelsius: number;
  fanTimerMode: "on" | "off";
}

export function createGoogleNestFixtureState(): GoogleNestFixtureState {
  return {
    mode: "heat",
    heatCelsius: 20,
    coolCelsius: 23,
    fanTimerMode: "off",
  };
}

export function applyGoogleNestFixtureCommand(
  state: GoogleNestFixtureState,
  command: string,
  params: Record<string, unknown>,
): void {
  if (command.endsWith("ThermostatMode.SetMode")) {
    const modes = {
      HEAT: "heat",
      COOL: "cool",
      HEATCOOL: "heat_cool",
      OFF: "off",
    } as const;
    state.mode = modes[String(params.mode) as keyof typeof modes] ?? state.mode;
  } else if (
    command.endsWith("SetHeat") &&
    typeof params.heatCelsius === "number"
  ) {
    state.heatCelsius = params.heatCelsius;
  } else if (
    command.endsWith("SetCool") &&
    typeof params.coolCelsius === "number"
  ) {
    state.coolCelsius = params.coolCelsius;
  } else if (command.endsWith("SetRange")) {
    if (typeof params.heatCelsius === "number")
      state.heatCelsius = params.heatCelsius;
    if (typeof params.coolCelsius === "number")
      state.coolCelsius = params.coolCelsius;
  } else if (command.endsWith("Fan.SetTimer")) {
    state.fanTimerMode = params.timerMode === "ON" ? "on" : "off";
  }
}

export function createGoogleNestFixtureSource(
  state = createGoogleNestFixtureState(),
): GoogleNestSyncSource {
  return {
    async sync(now) {
      const retrievedAt = now.toISOString();
      const staleAfter = new Date(now.getTime() + 5 * 60_000).toISOString();
      const payload: HomeContextPayload = {
        structures: [{ id: "nest-structure-home", displayName: "Home" }],
        rooms: [
          {
            id: "nest-room-hall",
            structureId: "nest-structure-home",
            displayName: "Hall",
          },
        ],
        devices: [
          {
            id: "nest-device-thermostat",
            displayName: "Hall thermostat",
            category: "thermostat",
            structureId: "nest-structure-home",
            roomId: "nest-room-hall",
            supported: true,
            capabilities: [
              {
                kind: "thermostat.set_mode",
                modes: ["heat", "cool", "heat_cool", "off"],
              },
              {
                kind: "thermostat.set_temperature",
                modes: ["heat", "cool", "heat_cool"],
              },
              { kind: "fan.set_timer", maximumSeconds: 43_200 },
            ],
            observations: [
              {
                kind: "connectivity",
                observedAt: retrievedAt,
                value: { status: "online" },
              },
              {
                kind: "temperature",
                observedAt: retrievedAt,
                value: { celsius: 7 },
              },
              {
                kind: "humidity",
                observedAt: retrievedAt,
                value: { percent: 41 },
              },
              {
                kind: "hvac",
                observedAt: retrievedAt,
                value: { status: "heating" },
              },
              {
                kind: "thermostat_mode",
                observedAt: retrievedAt,
                value: { mode: state.mode },
              },
              {
                kind: "thermostat_setpoint",
                observedAt: retrievedAt,
                value: {
                  heatCelsius: state.heatCelsius,
                  coolCelsius: state.coolCelsius,
                },
              },
              {
                kind: "fan",
                observedAt: retrievedAt,
                value: { timerMode: state.fanTimerMode },
              },
            ],
          },
          {
            id: "nest-device-camera",
            displayName: "Front door camera",
            category: "doorbell",
            structureId: "nest-structure-home",
            roomId: "nest-room-hall",
            supported: true,
            capabilities: [
              { kind: "camera.live_stream", protocols: ["webrtc"] },
            ],
            observations: [
              {
                kind: "connectivity",
                observedAt: retrievedAt,
                value: { status: "online" },
              },
              {
                kind: "camera_live_stream",
                observedAt: retrievedAt,
                value: {
                  protocols: ["webrtc"],
                  maxWidth: 1280,
                  maxHeight: 720,
                },
              },
            ],
          },
          {
            id: "nest-device-unsupported",
            displayName: "Kitchen speaker",
            category: "unsupported",
            structureId: "nest-structure-home",
            supported: false,
            capabilities: [],
            observations: [],
          },
        ],
        permissions: [
          {
            id: "home.structure.read",
            access: "read",
            granted: true,
            explanation: "Read the selected home's structure and room names.",
          },
          {
            id: "home.device.read",
            access: "read",
            granted: true,
            explanation:
              "Read a small allowlist of selected Nest device traits.",
          },
          {
            id: "home.camera.stream",
            access: "read",
            granted: true,
            explanation:
              "Open a temporary camera stream only after an explicit request.",
          },
          {
            id: "home.device.control",
            access: "write",
            granted: true,
            explanation:
              "Control an allowlisted thermostat or fan only after approval.",
          },
        ],
      };
      const record: SourceRecord<HomeContextPayload> = {
        id: "home.google-nest.fixture",
        connectorId: GOOGLE_NEST_CONNECTOR_ID,
        schemaVersion: "1",
        externalReference: "fixture:google-nest-home",
        provenance: { sourceLabel: "Fictional Google Nest fixture" },
        observedAt: retrievedAt,
        retrievedAt,
        staleAfter,
        payload,
      };
      return {
        ok: true,
        batch: {
          connectorId: GOOGLE_NEST_CONNECTOR_ID,
          records: [record],
          retrievedAt,
          staleAfter,
          completeness: "complete",
          deviceReferences: {
            "nest-device-thermostat": "fixture/thermostat",
            "nest-device-camera": "fixture/camera",
            "nest-device-unsupported": "fixture/unsupported",
          },
        },
      };
    },
  };
}
