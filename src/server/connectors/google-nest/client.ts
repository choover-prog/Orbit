import { createHash } from "node:crypto";
import type {
  HomeContextPayload,
  HomeDevice,
  HomeDeviceCapability,
  HomeRoom,
  HomeStructure,
  HomeTraitObservation,
  SourceRecord,
} from "@/domain/orbit/connectors";
import { GOOGLE_NEST_API_ORIGIN, GOOGLE_NEST_CONNECTOR_ID } from "./config";
import type {
  GoogleNestFailure,
  GoogleNestSyncBatch,
  GoogleNestSyncOutcome,
} from "./types";

export const GOOGLE_NEST_REQUEST_TIMEOUT_MS = 10_000;
export const GOOGLE_NEST_MAX_RESPONSE_BYTES = 256 * 1_024;
export const GOOGLE_NEST_MAX_STRUCTURES = 4;
export const GOOGLE_NEST_MAX_ROOMS = 32;
export const GOOGLE_NEST_MAX_DEVICES = 32;
export const GOOGLE_NEST_CACHE_MS = 5 * 60_000;

const RESOURCE = /^[A-Za-z0-9/_-]{1,1024}$/u;
type Json = Record<string, unknown>;

class ResponseLimitError extends Error {}

function object(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback: string, max = 256): string {
  if (typeof value !== "string" || value.length > max) return fallback;
  return (
    value
      .normalize("NFKC")
      .replace(
        /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu,
        " ",
      )
      .replace(/\s+/gu, " ")
      .trim() || fallback
  );
}

function hash(kind: string, raw: string): string {
  return createHash("sha256")
    .update(`orbit:home.google-nest:${kind}:${raw}`, "utf8")
    .digest("hex")
    .slice(0, 24);
}

function trait(traits: unknown, name: string): Json | undefined {
  if (!object(traits)) return undefined;
  const candidate = traits[name];
  return object(candidate) ? candidate : undefined;
}

function customName(
  traits: unknown,
  kind: "structure" | "room" | "device",
  fallback: string,
): string {
  const name =
    kind === "structure"
      ? "sdm.structures.traits.Info"
      : kind === "room"
        ? "sdm.structures.traits.RoomInfo"
        : "sdm.devices.traits.Info";
  return text(trait(traits, name)?.customName, fallback);
}

async function bounded(response: Response): Promise<string> {
  const header = Number(response.headers.get("content-length"));
  if (Number.isFinite(header) && header > GOOGLE_NEST_MAX_RESPONSE_BYTES) {
    throw new ResponseLimitError();
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > GOOGLE_NEST_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ResponseLimitError();
    }
    output += decoder.decode(value, { stream: true });
  }
  return output + decoder.decode();
}

function providerFailure(response: Response): GoogleNestFailure {
  if (response.status === 401) {
    return {
      code: "authentication_required",
      message: "Google Nest authorization expired or was revoked.",
      retryable: false,
    };
  }
  if (response.status === 403) {
    return {
      code: "insufficient_scope",
      message:
        "Google Nest did not grant the required Device Access permission.",
      retryable: false,
    };
  }
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after"));
    return {
      code: "rate_limited",
      message: "Google Nest temporarily limited synchronization.",
      retryable: true,
      ...(Number.isFinite(seconds) && seconds >= 0
        ? { retryAfterSeconds: Math.min(Math.ceil(seconds), 3600) }
        : {}),
    };
  }
  return {
    code: "provider_unavailable",
    message: "Google Nest is temporarily unavailable.",
    retryable: response.status >= 500,
  };
}

async function getJson(
  path: string,
  token: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<
  { ok: true; value: unknown } | { ok: false; failure: GoogleNestFailure }
> {
  const url = new URL(path, GOOGLE_NEST_API_ORIGIN);
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { accept: "application/json", authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "error",
    signal,
  });
  const body = await bounded(response);
  if (!response.ok) return { ok: false, failure: providerFailure(response) };
  if (
    !(response.headers.get("content-type") ?? "").includes("application/json")
  ) {
    return {
      ok: false,
      failure: {
        code: "invalid_response",
        message: "Google Nest returned a non-JSON response.",
        retryable: false,
      },
    };
  }
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return {
      ok: false,
      failure: {
        code: "invalid_response",
        message: "Google Nest returned malformed JSON.",
        retryable: false,
      },
    };
  }
}

function parseNamedList(
  value: unknown,
  key: "structures" | "rooms",
): Json[] | null {
  if (!object(value)) return null;
  const list = value[key] ?? [];
  if (!Array.isArray(list) || list.some((item) => !object(item))) return null;
  return list as Json[];
}

function parseStructures(
  raw: Json[],
): { items: HomeStructure[]; rawNames: string[] } | null {
  const items: HomeStructure[] = [];
  const rawNames: string[] = [];
  for (const value of raw.slice(0, GOOGLE_NEST_MAX_STRUCTURES)) {
    if (
      typeof value.name !== "string" ||
      !RESOURCE.test(value.name) ||
      rawNames.includes(value.name)
    )
      return null;
    rawNames.push(value.name);
    items.push({
      id: `nest-structure-${hash("structure", value.name)}`,
      displayName: customName(value.traits, "structure", "Home"),
    });
  }
  return { items, rawNames };
}

function parseRooms(
  raw: Json[],
  structureRaw: string,
  structureId: string,
): { items: HomeRoom[]; rawNames: string[] } | null {
  const items: HomeRoom[] = [];
  const rawNames: string[] = [];
  for (const value of raw) {
    if (
      typeof value.name !== "string" ||
      !RESOURCE.test(value.name) ||
      !value.name.startsWith(`${structureRaw}/rooms/`) ||
      rawNames.includes(value.name)
    )
      return null;
    rawNames.push(value.name);
    items.push({
      id: `nest-room-${hash("room", value.name)}`,
      structureId,
      displayName: customName(value.traits, "room", "Room"),
    });
  }
  return { items, rawNames };
}

function category(type: unknown): HomeDevice["category"] {
  if (type === "sdm.devices.types.THERMOSTAT") return "thermostat";
  if (type === "sdm.devices.types.CAMERA") return "camera";
  if (type === "sdm.devices.types.DOORBELL") return "doorbell";
  if (type === "sdm.devices.types.DISPLAY") return "display";
  return "unsupported";
}

function observations(
  traits: unknown,
  now: string,
): HomeTraitObservation[] | null {
  if (!object(traits)) return [];
  const result: HomeTraitObservation[] = [];
  const connectivity = trait(traits, "sdm.devices.traits.Connectivity")?.status;
  if (connectivity !== undefined) {
    if (typeof connectivity !== "string") return null;
    result.push({
      kind: "connectivity",
      observedAt: now,
      value: {
        status:
          connectivity === "ONLINE"
            ? "online"
            : connectivity === "OFFLINE"
              ? "offline"
              : "unknown",
      },
    });
  }
  const temperature = trait(
    traits,
    "sdm.devices.traits.Temperature",
  )?.ambientTemperatureCelsius;
  if (temperature !== undefined) {
    if (
      typeof temperature !== "number" ||
      !Number.isFinite(temperature) ||
      temperature < -100 ||
      temperature > 100
    )
      return null;
    result.push({
      kind: "temperature",
      observedAt: now,
      value: { celsius: temperature },
    });
  }
  const humidity = trait(
    traits,
    "sdm.devices.traits.Humidity",
  )?.ambientHumidityPercent;
  if (humidity !== undefined) {
    if (
      typeof humidity !== "number" ||
      !Number.isFinite(humidity) ||
      humidity < 0 ||
      humidity > 100
    )
      return null;
    result.push({
      kind: "humidity",
      observedAt: now,
      value: { percent: humidity },
    });
  }
  const hvac = trait(traits, "sdm.devices.traits.ThermostatHvac")?.status;
  if (hvac !== undefined) {
    if (typeof hvac !== "string") return null;
    result.push({
      kind: "hvac",
      observedAt: now,
      value: {
        status:
          hvac === "HEATING"
            ? "heating"
            : hvac === "COOLING"
              ? "cooling"
              : hvac === "OFF"
                ? "off"
                : "unknown",
      },
    });
  }
  const mode = trait(traits, "sdm.devices.traits.ThermostatMode")?.mode;
  if (mode !== undefined) {
    if (typeof mode !== "string") return null;
    result.push({
      kind: "thermostat_mode",
      observedAt: now,
      value: {
        mode:
          mode === "HEAT"
            ? "heat"
            : mode === "COOL"
              ? "cool"
              : mode === "HEATCOOL"
                ? "heat_cool"
                : mode === "OFF"
                  ? "off"
                  : "unknown",
      },
    });
  }
  const setpoint = trait(
    traits,
    "sdm.devices.traits.ThermostatTemperatureSetpoint",
  );
  if (setpoint) {
    const heat = setpoint.heatCelsius;
    const cool = setpoint.coolCelsius;
    if (
      (heat !== undefined &&
        (typeof heat !== "number" || !Number.isFinite(heat))) ||
      (cool !== undefined &&
        (typeof cool !== "number" || !Number.isFinite(cool)))
    )
      return null;
    result.push({
      kind: "thermostat_setpoint",
      observedAt: now,
      value: {
        ...(typeof heat === "number" ? { heatCelsius: heat } : {}),
        ...(typeof cool === "number" ? { coolCelsius: cool } : {}),
      },
    });
  }
  const fan = trait(traits, "sdm.devices.traits.Fan");
  if (fan) {
    const timerMode = fan.timerMode;
    const timerTimeout = fan.timerTimeout;
    if (
      typeof timerMode !== "string" ||
      (timerTimeout !== undefined &&
        (typeof timerTimeout !== "string" ||
          !Number.isFinite(Date.parse(timerTimeout))))
    )
      return null;
    result.push({
      kind: "fan",
      observedAt: now,
      value: {
        timerMode:
          timerMode === "ON" ? "on" : timerMode === "OFF" ? "off" : "unknown",
        ...(typeof timerTimeout === "string"
          ? { timerTimeout: new Date(timerTimeout).toISOString() }
          : {}),
      },
    });
  }
  const stream = trait(traits, "sdm.devices.traits.CameraLiveStream");
  if (stream) {
    const rawProtocols = stream.supportedProtocols;
    if (
      !Array.isArray(rawProtocols) ||
      rawProtocols.some((item) => typeof item !== "string")
    )
      return null;
    const protocols = rawProtocols.flatMap((item) =>
      item === "WEB_RTC"
        ? ["webrtc" as const]
        : item === "RTSP"
          ? ["rtsp" as const]
          : [],
    );
    const resolution = object(stream.maxVideoResolution)
      ? stream.maxVideoResolution
      : undefined;
    result.push({
      kind: "camera_live_stream",
      observedAt: now,
      value: {
        protocols,
        ...(typeof resolution?.width === "number"
          ? { maxWidth: resolution.width }
          : {}),
        ...(typeof resolution?.height === "number"
          ? { maxHeight: resolution.height }
          : {}),
      },
    });
  }
  return result;
}

function capabilities(traits: unknown): HomeDeviceCapability[] | null {
  if (!object(traits)) return [];
  const result: HomeDeviceCapability[] = [];
  const modes = trait(
    traits,
    "sdm.devices.traits.ThermostatMode",
  )?.availableModes;
  if (modes !== undefined) {
    if (!Array.isArray(modes) || modes.some((mode) => typeof mode !== "string"))
      return null;
    const normalized = modes.flatMap((mode) =>
      mode === "HEAT"
        ? ["heat" as const]
        : mode === "COOL"
          ? ["cool" as const]
          : mode === "HEATCOOL"
            ? ["heat_cool" as const]
            : mode === "OFF"
              ? ["off" as const]
              : [],
    );
    if (normalized.length)
      result.push({ kind: "thermostat.set_mode", modes: normalized });
  }
  if (trait(traits, "sdm.devices.traits.ThermostatTemperatureSetpoint")) {
    result.push({
      kind: "thermostat.set_temperature",
      modes: ["heat", "cool", "heat_cool"],
    });
  }
  if (trait(traits, "sdm.devices.traits.Fan"))
    result.push({ kind: "fan.set_timer", maximumSeconds: 43_200 });
  const stream = trait(
    traits,
    "sdm.devices.traits.CameraLiveStream",
  )?.supportedProtocols;
  if (stream !== undefined) {
    if (
      !Array.isArray(stream) ||
      stream.some((item) => typeof item !== "string")
    )
      return null;
    const protocols = stream.flatMap((item) =>
      item === "WEB_RTC"
        ? ["webrtc" as const]
        : item === "RTSP"
          ? ["rtsp" as const]
          : [],
    );
    if (protocols.length)
      result.push({ kind: "camera.live_stream", protocols });
  }
  return result;
}

function parseDevices(
  value: unknown,
  structureMap: Map<string, string>,
  roomMap: Map<string, string>,
  now: string,
): {
  devices: HomeDevice[];
  capped: boolean;
  references: Record<string, string>;
} | null {
  if (!object(value)) return null;
  const raw = value.devices ?? [];
  if (!Array.isArray(raw) || raw.some((item) => !object(item))) return null;
  const devices: HomeDevice[] = [];
  const seen = new Set<string>();
  const references: Record<string, string> = {};
  for (const item of (raw as Json[]).slice(0, GOOGLE_NEST_MAX_DEVICES)) {
    if (
      typeof item.name !== "string" ||
      !RESOURCE.test(item.name) ||
      seen.has(item.name)
    )
      return null;
    seen.add(item.name);
    const deviceCategory = category(item.type);
    const normalizedObservations = observations(item.traits, now);
    const normalizedCapabilities = capabilities(item.traits);
    if (!normalizedObservations || !normalizedCapabilities) return null;
    const parents = Array.isArray(item.parentRelations)
      ? item.parentRelations
      : [];
    const parent = parents.find(
      (candidate) => object(candidate) && typeof candidate.parent === "string",
    ) as Json | undefined;
    const rawParent =
      typeof parent?.parent === "string" ? parent.parent : undefined;
    const structureRaw = rawParent?.includes("/rooms/")
      ? rawParent.split("/rooms/")[0]
      : rawParent;
    const id = `nest-device-${hash("device", item.name)}`;
    references[id] = item.name;
    devices.push({
      id,
      displayName: customName(
        item.traits,
        "device",
        text(parent?.displayName, "Nest device"),
      ),
      category: deviceCategory,
      ...(structureRaw && structureMap.has(structureRaw)
        ? { structureId: structureMap.get(structureRaw) }
        : {}),
      ...(rawParent && roomMap.has(rawParent)
        ? { roomId: roomMap.get(rawParent) }
        : {}),
      supported: deviceCategory !== "unsupported",
      capabilities: normalizedCapabilities,
      observations: normalizedObservations,
    });
  }
  return { devices, capped: raw.length > GOOGLE_NEST_MAX_DEVICES, references };
}

export async function syncGoogleNest(
  request: { now: Date; accessToken: string; projectId: string },
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<GoogleNestSyncOutcome> {
  if (
    !Number.isFinite(request.now.getTime()) ||
    !/^[A-Za-z0-9-]{1,128}$/u.test(request.projectId)
  ) {
    return {
      ok: false,
      failure: {
        code: "invalid_response",
        message: "Google Nest synchronization configuration is invalid.",
        retryable: false,
      },
    };
  }
  const token = request.accessToken.trim();
  if (!token || token.length > 16_384) {
    return {
      ok: false,
      failure: {
        code: "authentication_required",
        message: "Google Nest authorization is required.",
        retryable: false,
      },
    };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const signal = AbortSignal.timeout(
    options.timeoutMs ?? GOOGLE_NEST_REQUEST_TIMEOUT_MS,
  );
  const base = `/v1/enterprises/${encodeURIComponent(request.projectId)}`;
  try {
    const [structureResponse, deviceResponse] = await Promise.all([
      getJson(`${base}/structures`, token, fetchImpl, signal),
      getJson(`${base}/devices`, token, fetchImpl, signal),
    ]);
    if (!structureResponse.ok) return structureResponse;
    if (!deviceResponse.ok) return deviceResponse;
    const structureList = parseNamedList(structureResponse.value, "structures");
    if (!structureList)
      return {
        ok: false,
        failure: {
          code: "invalid_response",
          message: "Google Nest returned invalid structures.",
          retryable: false,
        },
      };
    const structures = parseStructures(structureList);
    if (!structures)
      return {
        ok: false,
        failure: {
          code: "invalid_response",
          message: "Google Nest returned invalid structure data.",
          retryable: false,
        },
      };
    const structureMap = new Map(
      structures.rawNames.map((raw, index) => [
        raw,
        structures.items[index].id,
      ]),
    );
    const rooms: HomeRoom[] = [];
    const roomMap = new Map<string, string>();
    let roomCapped = false;
    for (const rawStructure of structures.rawNames) {
      const response = await getJson(
        `/${rawStructure}/rooms`.replace(/^\//u, "/v1/"),
        token,
        fetchImpl,
        signal,
      );
      if (!response.ok) return response;
      const list = parseNamedList(response.value, "rooms");
      if (!list)
        return {
          ok: false,
          failure: {
            code: "invalid_response",
            message: "Google Nest returned invalid rooms.",
            retryable: false,
          },
        };
      const remaining = GOOGLE_NEST_MAX_ROOMS - rooms.length;
      if (list.length > remaining) roomCapped = true;
      const parsed = parseRooms(
        list.slice(0, Math.max(0, remaining)),
        rawStructure,
        structureMap.get(rawStructure)!,
      );
      if (!parsed)
        return {
          ok: false,
          failure: {
            code: "invalid_response",
            message: "Google Nest returned invalid room data.",
            retryable: false,
          },
        };
      parsed.items.forEach((room, index) =>
        roomMap.set(parsed.rawNames[index], room.id),
      );
      rooms.push(...parsed.items);
    }
    const parsedDevices = parseDevices(
      deviceResponse.value,
      structureMap,
      roomMap,
      request.now.toISOString(),
    );
    if (!parsedDevices)
      return {
        ok: false,
        failure: {
          code: "invalid_response",
          message: "Google Nest returned invalid device data.",
          retryable: false,
        },
      };
    const payload: HomeContextPayload = {
      structures: structures.items,
      rooms,
      devices: parsedDevices.devices,
      permissions: [
        {
          id: "home.structure.read",
          access: "read",
          granted: true,
          explanation:
            "Read the structures and rooms selected in Google Partner Connections Manager.",
        },
        {
          id: "home.device.read",
          access: "read",
          granted: true,
          explanation:
            "Read a small allowlist of traits from selected supported Nest devices.",
        },
        {
          id: "home.camera.stream",
          access: "read",
          granted: parsedDevices.devices.some((device) =>
            device.capabilities.some(
              (capability) => capability.kind === "camera.live_stream",
            ),
          ),
          explanation:
            "Open a temporary stream from a selected compatible camera only when requested.",
        },
        {
          id: "home.device.control",
          access: "write",
          granted: parsedDevices.devices.some((device) =>
            device.capabilities.some((capability) =>
              [
                "thermostat.set_mode",
                "thermostat.set_temperature",
                "fan.set_timer",
              ].includes(capability.kind),
            ),
          ),
          explanation:
            "Control selected allowlisted thermostat and fan capabilities only after approval.",
        },
      ],
    };
    const retrievedAt = request.now.toISOString();
    const staleAfter = new Date(
      request.now.getTime() + GOOGLE_NEST_CACHE_MS,
    ).toISOString();
    const record: SourceRecord<HomeContextPayload> = {
      id: `home.google-nest.${hash("batch", request.projectId)}`,
      connectorId: GOOGLE_NEST_CONNECTOR_ID,
      schemaVersion: "1",
      externalReference: `sha256:${hash("enterprise", request.projectId)}`,
      provenance: { sourceLabel: "Google Nest Device Access" },
      observedAt: retrievedAt,
      retrievedAt,
      staleAfter,
      payload,
    };
    const completeness: GoogleNestSyncBatch["completeness"] =
      structureList.length > GOOGLE_NEST_MAX_STRUCTURES
        ? "structure_cap"
        : roomCapped
          ? "room_cap"
          : parsedDevices.capped
            ? "device_cap"
            : "complete";
    return {
      ok: true,
      batch: {
        connectorId: GOOGLE_NEST_CONNECTOR_ID,
        records: [record],
        retrievedAt,
        staleAfter,
        completeness,
        deviceReferences: parsedDevices.references,
      },
    };
  } catch (error) {
    if (error instanceof ResponseLimitError) {
      return {
        ok: false,
        failure: {
          code: "invalid_response",
          message: "Google Nest returned an oversized response.",
          retryable: false,
        },
      };
    }
    const name =
      object(error) && typeof error.name === "string" ? error.name : "";
    const timeout = name === "AbortError" || name === "TimeoutError";
    return {
      ok: false,
      failure: {
        code: timeout ? "timeout" : "provider_unavailable",
        message: timeout
          ? "Google Nest synchronization timed out."
          : "Google Nest could not be reached.",
        retryable: true,
      },
    };
  }
}

export type GoogleNestCommandName =
  | "sdm.devices.commands.ThermostatMode.SetMode"
  | "sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat"
  | "sdm.devices.commands.ThermostatTemperatureSetpoint.SetCool"
  | "sdm.devices.commands.ThermostatTemperatureSetpoint.SetRange"
  | "sdm.devices.commands.Fan.SetTimer"
  | "sdm.devices.commands.CameraLiveStream.GenerateWebRtcStream"
  | "sdm.devices.commands.CameraLiveStream.ExtendWebRtcStream"
  | "sdm.devices.commands.CameraLiveStream.StopWebRtcStream";

export async function executeGoogleNestCommand(
  request: {
    accessToken: string;
    projectId: string;
    deviceReference: string;
    command: GoogleNestCommandName;
    params: Record<string, unknown>;
  },
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<
  | { ok: true; results: Record<string, unknown> }
  | { ok: false; failure: GoogleNestFailure }
> {
  const prefix = `enterprises/${request.projectId}/devices/`;
  if (
    !/^[A-Za-z0-9-]{1,128}$/u.test(request.projectId) ||
    !RESOURCE.test(request.deviceReference) ||
    !request.deviceReference.startsWith(prefix) ||
    !request.accessToken.trim()
  ) {
    return {
      ok: false,
      failure: {
        code: "invalid_response",
        message: "The Google Nest command target is invalid.",
        retryable: false,
      },
    };
  }
  const response = await (options.fetchImpl ?? fetch)(
    new URL(
      `/v1/${request.deviceReference}:executeCommand`,
      GOOGLE_NEST_API_ORIGIN,
    ),
    {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${request.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        command: request.command,
        params: request.params,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(
        options.timeoutMs ?? GOOGLE_NEST_REQUEST_TIMEOUT_MS,
      ),
    },
  ).catch(() => undefined);
  if (!response)
    return {
      ok: false,
      failure: {
        code: "provider_unavailable",
        message: "Google Nest could not be reached.",
        retryable: true,
      },
    };
  let raw: string;
  try {
    raw = await bounded(response);
  } catch {
    return {
      ok: false,
      failure: {
        code: "invalid_response",
        message: "Google Nest returned an oversized command response.",
        retryable: false,
      },
    };
  }
  if (!response.ok) return { ok: false, failure: providerFailure(response) };
  if (!raw) return { ok: true, results: {} };
  try {
    const parsed = JSON.parse(raw);
    if (
      !object(parsed) ||
      (parsed.results !== undefined && !object(parsed.results))
    )
      throw new Error();
    return {
      ok: true,
      results: (parsed.results as Record<string, unknown> | undefined) ?? {},
    };
  } catch {
    return {
      ok: false,
      failure: {
        code: "invalid_response",
        message: "Google Nest returned invalid command data.",
        retryable: false,
      },
    };
  }
}
