import type {
  ConnectorFailure,
  ConnectorSyncRequest,
  ConnectorSyncResult,
  HourlyWeatherPoint,
  SourceRecord,
  WeatherReading,
} from "@/domain/orbit/connectors";

import {
  OPEN_METEO_FORECAST_ENDPOINT,
  WEATHER_CONNECTOR_ID,
  WEATHER_FRESHNESS_WINDOW_MS,
  WEATHER_LATITUDE,
  WEATHER_LOCATION_LABEL,
  WEATHER_LONGITUDE,
  WEATHER_REQUEST_TIMEOUT_MS,
} from "./config";

export type WeatherFetch = typeof globalThis.fetch;

export interface OpenMeteoSyncOptions {
  fetchImpl?: WeatherFetch;
  timeoutMs?: number;
}

type JsonRecord = Record<string, unknown>;

interface ValidatedOpenMeteoResponse {
  observedAt: string;
  weatherCode: number;
  temperatureF: number;
  apparentTemperatureF: number;
  relativeHumidityPercent: number;
  precipitationInches: number;
  windSpeedMph: number;
  windGustMph: number;
  isDay: boolean;
  hourly: HourlyWeatherPoint[];
}

const MAX_OBSERVATION_AGE_MS = 30 * 60 * 1_000;
const MAX_CLOCK_SKEW_MS = 30 * 60 * 1_000;
const MAX_FORECAST_HORIZON_MS = 24 * 60 * 60 * 1_000;
const MAX_RESPONSE_BYTES = 128 * 1_024;
const COORDINATE_TOLERANCE_DEGREES = 1;
const OPEN_METEO_PROVENANCE = {
  sourceLabel: "Open-Meteo forecast",
  attribution: {
    label: "Weather data by Open-Meteo.com",
    url: "https://open-meteo.com/",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    transformed: true,
  },
} as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return isFiniteNumber(value) && value >= minimum && value <= maximum;
}

function isWeatherCode(value: unknown): value is number {
  return numberInRange(value, 0, 99) && Number.isInteger(value);
}

function normalizeUtcDateTime(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/u.test(
      value,
    )
  ) {
    return null;
  }

  const candidate = /(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ? value : `${value}Z`;
  const timestamp = Date.parse(candidate);

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function validateHourly(value: unknown): HourlyWeatherPoint[] | null {
  if (!isRecord(value)) {
    return null;
  }

  const times = value.time;
  const temperatures = value.temperature_2m;
  const precipitationProbabilities = value.precipitation_probability;
  const weatherCodes = value.weather_code;

  if (
    !Array.isArray(times) ||
    !Array.isArray(temperatures) ||
    !Array.isArray(precipitationProbabilities) ||
    !Array.isArray(weatherCodes) ||
    times.length === 0 ||
    times.length > 48 ||
    temperatures.length !== times.length ||
    precipitationProbabilities.length !== times.length ||
    weatherCodes.length !== times.length
  ) {
    return null;
  }

  const points: HourlyWeatherPoint[] = [];

  for (let index = 0; index < times.length; index += 1) {
    const at = normalizeUtcDateTime(times[index]);
    const temperatureF = temperatures[index];
    const precipitationProbabilityPercent = precipitationProbabilities[index];
    const weatherCode = weatherCodes[index];

    if (
      at === null ||
      !numberInRange(temperatureF, -150, 180) ||
      !numberInRange(precipitationProbabilityPercent, 0, 100) ||
      !isWeatherCode(weatherCode)
    ) {
      return null;
    }

    points.push({
      at,
      temperatureF,
      precipitationProbabilityPercent,
      weatherCode,
    });
  }

  return points;
}

function validateOpenMeteoResponse(
  value: unknown,
): ValidatedOpenMeteoResponse | null {
  if (
    !isRecord(value) ||
    !isRecord(value.current) ||
    !isRecord(value.current_units) ||
    !isRecord(value.hourly_units)
  ) {
    return null;
  }

  const current = value.current;
  const currentUnits = value.current_units;
  const hourlyUnits = value.hourly_units;
  const observedAt = normalizeUtcDateTime(current.time);
  const hourly = validateHourly(value.hourly);

  if (
    !numberInRange(value.latitude, -90, 90) ||
    !numberInRange(value.longitude, -180, 180) ||
    Math.abs(value.latitude - WEATHER_LATITUDE) >
      COORDINATE_TOLERANCE_DEGREES ||
    Math.abs(value.longitude - WEATHER_LONGITUDE) >
      COORDINATE_TOLERANCE_DEGREES ||
    value.utc_offset_seconds !== 0 ||
    (value.timezone !== "GMT" && value.timezone !== "UTC") ||
    currentUnits.temperature_2m !== "°F" ||
    currentUnits.apparent_temperature !== "°F" ||
    currentUnits.relative_humidity_2m !== "%" ||
    currentUnits.precipitation !== "inch" ||
    currentUnits.weather_code !== "wmo code" ||
    currentUnits.wind_speed_10m !== "mp/h" ||
    currentUnits.wind_gusts_10m !== "mp/h" ||
    hourlyUnits.temperature_2m !== "°F" ||
    hourlyUnits.precipitation_probability !== "%" ||
    hourlyUnits.weather_code !== "wmo code" ||
    observedAt === null ||
    hourly === null ||
    !numberInRange(current.temperature_2m, -150, 180) ||
    !numberInRange(current.apparent_temperature, -180, 200) ||
    !numberInRange(current.relative_humidity_2m, 0, 100) ||
    !numberInRange(current.precipitation, 0, 100) ||
    !isWeatherCode(current.weather_code) ||
    !numberInRange(current.wind_speed_10m, 0, 300) ||
    !numberInRange(current.wind_gusts_10m, 0, 400) ||
    (current.is_day !== 0 && current.is_day !== 1)
  ) {
    return null;
  }

  return {
    observedAt,
    weatherCode: current.weather_code,
    temperatureF: current.temperature_2m,
    apparentTemperatureF: current.apparent_temperature,
    relativeHumidityPercent: current.relative_humidity_2m,
    precipitationInches: current.precipitation,
    windSpeedMph: current.wind_speed_10m,
    windGustMph: current.wind_gusts_10m,
    isDay: current.is_day === 1,
    hourly,
  };
}

function timestampsArePlausible(
  response: ValidatedOpenMeteoResponse,
  now: Date,
): boolean {
  const nowMs = now.getTime();
  const observedAtMs = Date.parse(response.observedAt);
  if (
    observedAtMs <= nowMs - MAX_OBSERVATION_AGE_MS ||
    observedAtMs > nowMs + MAX_CLOCK_SKEW_MS
  ) {
    return false;
  }

  let previousAt = Number.NEGATIVE_INFINITY;
  let futurePointCount = 0;
  const currentUtcHourStart = new Date(nowMs);
  currentUtcHourStart.setUTCMinutes(0, 0, 0);

  for (const point of response.hourly) {
    const at = Date.parse(point.at);
    if (
      at <= previousAt ||
      at < currentUtcHourStart.getTime() ||
      at > nowMs + MAX_FORECAST_HORIZON_MS
    ) {
      return false;
    }
    if (at >= nowMs) futurePointCount += 1;
    previousAt = at;
  }

  return futurePointCount > 0;
}

export function mapWmoWeatherCode(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code === 51 || code === 53 || code === 55) return "Drizzle";
  if (code === 56 || code === 57) return "Freezing drizzle";
  if (code === 61) return "Light rain";
  if (code === 63) return "Moderate rain";
  if (code === 65) return "Heavy rain";
  if (code === 66 || code === 67) return "Freezing rain";
  if (code === 71 || code === 73 || code === 75) return "Snowfall";
  if (code === 77) return "Snow grains";
  if (code === 80 || code === 81 || code === 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm with hail";
  return "Unrecognized conditions";
}

export function buildOpenMeteoForecastUrl(): URL {
  const url = new URL(OPEN_METEO_FORECAST_ENDPOINT);
  url.searchParams.set("latitude", String(WEATHER_LATITUDE));
  url.searchParams.set("longitude", String(WEATHER_LONGITUDE));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m",
      "is_day",
    ].join(","),
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation_probability,weather_code",
  );
  url.searchParams.set("forecast_hours", "12");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", "UTC");
  return url;
}

function failureResult(
  failure: ConnectorFailure,
): ConnectorSyncResult<WeatherReading> {
  return {
    ok: false,
    mode: "live",
    health: "unavailable",
    records: [],
    failure,
  };
}

function retryAfterSeconds(response: Response, now: Date): number | undefined {
  const value = response.headers.get("retry-after");

  if (value === null) return undefined;

  if (/^\d+$/u.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
  }

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return undefined;
  return Math.max(0, Math.ceil((retryAt - now.getTime()) / 1_000));
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && /^\d+$/u.test(declaredLength)) {
    const parsedLength = Number(declaredLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength > MAX_RESPONSE_BYTES
    ) {
      throw new Error("Provider response exceeds the allowed size.");
    }
  }

  if (!response.body) {
    throw new Error("Provider response has no body.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Provider response exceeds the allowed size.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(bytes));
}

function isTimeoutError(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  if (!isRecord(error)) return false;
  return error.name === "AbortError" || error.name === "TimeoutError";
}

function createSourceRecord(
  reading: WeatherReading,
  retrievedAt: Date,
): SourceRecord<WeatherReading> {
  const retrievedFreshnessDeadline =
    retrievedAt.getTime() + WEATHER_FRESHNESS_WINDOW_MS;
  const observationFreshnessDeadline =
    Date.parse(reading.observedAt) + MAX_OBSERVATION_AGE_MS;

  return {
    id: `weather.open-meteo.${Date.parse(reading.observedAt)}`,
    connectorId: WEATHER_CONNECTOR_ID,
    schemaVersion: "1",
    externalReference: `open-meteo:forecast:${reading.observedAt}`,
    provenance: OPEN_METEO_PROVENANCE,
    observedAt: reading.observedAt,
    retrievedAt: retrievedAt.toISOString(),
    staleAfter: new Date(
      Math.min(retrievedFreshnessDeadline, observationFreshnessDeadline),
    ).toISOString(),
    payload: reading,
  };
}

export async function syncOpenMeteoWeather(
  request: ConnectorSyncRequest,
  options: OpenMeteoSyncOptions = {},
): Promise<ConnectorSyncResult<WeatherReading>> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs =
    options.timeoutMs !== undefined &&
    Number.isFinite(options.timeoutMs) &&
    options.timeoutMs > 0
      ? options.timeoutMs
      : WEATHER_REQUEST_TIMEOUT_MS;
  const signal = AbortSignal.timeout(timeoutMs);
  let response: Response;

  try {
    response = await fetchImpl(buildOpenMeteoForecastUrl(), {
      method: "GET",
      headers: { accept: "application/json" },
      signal,
      redirect: "error",
    });
  } catch (error) {
    if (isTimeoutError(error, signal)) {
      return failureResult({
        code: "timeout",
        message: "Weather did not respond before the request timed out.",
        retryable: true,
      });
    }

    return failureResult({
      code: "provider_unavailable",
      message: "Weather is temporarily unavailable.",
      retryable: true,
    });
  }

  if (response.status === 429) {
    const retryAfter = retryAfterSeconds(response, request.now);
    return failureResult({
      code: "rate_limited",
      message: "Weather is temporarily rate limited.",
      retryable: true,
      ...(retryAfter === undefined ? {} : { retryAfterSeconds: retryAfter }),
    });
  }

  if (!response.ok) {
    const retryAfter = retryAfterSeconds(response, request.now);
    return failureResult({
      code: "provider_unavailable",
      message: "Weather is temporarily unavailable.",
      retryable: response.status >= 500,
      ...(retryAfter === undefined ? {} : { retryAfterSeconds: retryAfter }),
    });
  }

  let body: unknown;
  try {
    body = await readBoundedJson(response);
  } catch (error) {
    if (isTimeoutError(error, signal)) {
      return failureResult({
        code: "timeout",
        message: "Weather did not respond before the request timed out.",
        retryable: true,
      });
    }

    return failureResult({
      code: "invalid_response",
      message: "Weather returned a response Orbit could not validate.",
      retryable: false,
    });
  }

  const validated = validateOpenMeteoResponse(body);
  if (validated === null || !timestampsArePlausible(validated, request.now)) {
    return failureResult({
      code: "invalid_response",
      message: "Weather returned a response Orbit could not validate.",
      retryable: false,
    });
  }

  const reading: WeatherReading = {
    locationLabel: WEATHER_LOCATION_LABEL,
    observedAt: validated.observedAt,
    condition: mapWmoWeatherCode(validated.weatherCode),
    weatherCode: validated.weatherCode,
    temperatureF: validated.temperatureF,
    apparentTemperatureF: validated.apparentTemperatureF,
    relativeHumidityPercent: validated.relativeHumidityPercent,
    precipitationInches: validated.precipitationInches,
    windSpeedMph: validated.windSpeedMph,
    windGustMph: validated.windGustMph,
    isDay: validated.isDay,
    modeled: true,
    hourly: validated.hourly,
  };
  const record = createSourceRecord(reading, request.now);

  return {
    ok: true,
    mode: "live",
    health: "connected",
    records: [record],
    cursor: {
      connectorId: WEATHER_CONNECTOR_ID,
      syncedThrough: record.retrievedAt,
    },
  };
}
