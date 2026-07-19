import type { ConnectorMode, OrbitSnapshot } from "@/domain/orbit/connectors";
import { buildWeatherContextArtifacts } from "@/domain/orbit/weather-attention";
import { buildCalendarContextArtifacts } from "@/domain/orbit/calendar-attention";
import {
  createClientFixtureSnapshot,
  travelAttentionBundle,
} from "@/mocks/orbit-snapshot";
import type { ConnectionStatus } from "@/domain/orbit/types";
import type { GoogleCalendarGatewayState } from "@/server/connectors/google-calendar";
import {
  getConnectorRegistry,
  type OrbitConnectorRegistry,
} from "@/server/connectors/registry";

export interface BuildOrbitSnapshotOptions {
  now?: Date;
  contextPreference?: string;
  registry?: OrbitConnectorRegistry;
}

function weatherConnection(
  base: ConnectionStatus,
  mode: ConnectorMode,
  status: OrbitSnapshot["weather"]["status"],
  retrievedAt?: string,
  failureMessage?: string,
): ConnectionStatus {
  const health: ConnectionStatus["health"] =
    status === "fresh" ? "connected" : status;

  let statusDetail =
    mode === "live"
      ? "Read-only public forecast for a fixed, coarse test location."
      : "Deterministic fictional forecast; no network request.";

  if (status === "stale") {
    statusDetail =
      "The last valid forecast is stale and cannot create an attention item.";
  } else if (failureMessage) {
    statusDetail = failureMessage;
  }

  return {
    ...base,
    mode,
    health,
    lastSyncLabel: retrievedAt
      ? `${mode === "live" ? "Live" : "Fixture"} read completed`
      : "No validated forecast available",
    ...(retrievedAt ? { lastSyncedAt: retrievedAt } : {}),
    statusDetail,
  };
}

function calendarConnection(
  state: GoogleCalendarGatewayState,
): ConnectionStatus {
  const health: ConnectionStatus["health"] =
    state.status === "fresh"
      ? "connected"
      : state.status === "storage_unavailable"
        ? "configuration_required"
        : state.status;
  const batch = state.batch;
  let statusDetail =
    "Orbit reads only minimal event timing from the owned primary calendar. It cannot change events.";

  if (state.mode === "fixture") {
    statusDetail =
      "Fictional local OAuth and Calendar data; no Google request or durable credential.";
  }
  if (state.failure) statusDetail = state.failure.message;
  if (batch?.completeness === "page_cap") {
    statusDetail =
      "The bounded read reached its page cap, so Orbit suppressed Calendar attention.";
  }

  return {
    id: "connection_google_calendar",
    displayName: "Google Calendar",
    category: "calendar",
    mode: state.mode,
    health,
    capabilities: [
      {
        id: "google_calendar_owned_events_read",
        label: "Read owned primary-calendar event titles and times",
        access: "read",
      },
    ],
    lastSyncLabel: batch
      ? `${batch.records.length} validated events in a bounded read`
      : state.authorization === "connected"
        ? "No validated read available"
        : "No personal calendar connected",
    ...(batch ? { lastSyncedAt: batch.retrievedAt } : {}),
    statusDetail,
  };
}

export async function buildOrbitSnapshot(
  options: BuildOrbitSnapshotOptions = {},
): Promise<OrbitSnapshot> {
  const now = options.now ?? new Date();
  const registry = options.registry ?? getConnectorRegistry();
  const base = createClientFixtureSnapshot();
  const [weatherRead, calendarRead] = await Promise.all([
    registry.weather.read(now),
    registry.calendar.peek(now),
  ]);
  const weatherBaseConnection = base.connections.find(
    (connection) => connection.id === "connection_weather",
  );

  if (!weatherBaseConnection) {
    throw new Error("Orbit's weather connection fixture is missing.");
  }

  const hasRecord =
    weatherRead.status === "fresh" || weatherRead.status === "stale";
  const artifacts = hasRecord
    ? buildWeatherContextArtifacts(weatherRead.record, now)
    : undefined;
  const weatherAttention = artifacts?.attention;
  const calendarArtifacts = calendarRead.batch
    ? buildCalendarContextArtifacts(calendarRead.batch.records, now, {
        complete: calendarRead.batch.completeness === "complete",
        fresh: calendarRead.status === "fresh",
      })
    : undefined;
  const calendarAttention = calendarArtifacts?.attention;
  const attention = [
    travelAttentionBundle,
    ...(weatherAttention ? [weatherAttention] : []),
    ...(calendarAttention ? [calendarAttention] : []),
  ];
  const selectedAttentionId =
    options.contextPreference === "weather"
      ? (weatherAttention?.id ?? null)
      : options.contextPreference === "calendar"
        ? (calendarAttention?.id ?? null)
        : travelAttentionBundle.id;
  const failure = "failure" in weatherRead ? weatherRead.failure : undefined;
  const weatherStatus = weatherRead.status;

  return {
    ...base,
    generatedAt: now.toISOString(),
    requestedContext:
      options.contextPreference === "weather" ||
      options.contextPreference === "calendar"
        ? options.contextPreference
        : null,
    selectedAttentionId,
    attention,
    contextRecords: [
      ...base.contextRecords,
      ...(artifacts ? [artifacts.contextRecord] : []),
      ...(calendarArtifacts ? calendarArtifacts.contextRecords : []),
    ],
    evidence: [
      ...base.evidence,
      ...(artifacts ? [artifacts.evidence] : []),
      ...(calendarArtifacts ? calendarArtifacts.evidence : []),
    ],
    sourceRecords: [
      ...(hasRecord ? [weatherRead.record] : []),
      ...(calendarRead.batch ? calendarRead.batch.records : []),
    ],
    connections: [
      ...base.connections.map((connection) =>
        connection.id === weatherBaseConnection.id
          ? weatherConnection(
              weatherBaseConnection,
              weatherRead.mode,
              weatherStatus,
              hasRecord ? weatherRead.record.retrievedAt : undefined,
              failure?.message,
            )
          : connection,
      ),
      calendarConnection(calendarRead),
    ],
    weather: {
      status: weatherStatus,
      mode: weatherRead.mode,
      ...(hasRecord ? { reading: weatherRead.record.payload } : {}),
      ...(weatherAttention ? { attention: weatherAttention } : {}),
      ...(failure ? { failure } : {}),
    },
    calendar: {
      status: calendarRead.status,
      authorization: calendarRead.authorization,
      mode: calendarRead.mode,
      records: calendarRead.batch?.records ?? [],
      complete: calendarRead.batch?.completeness === "complete",
      eventCount: calendarRead.batch?.records.length ?? 0,
      ...(calendarRead.batch
        ? {
            windowStart: calendarRead.batch.window.startsAt,
            windowEnd: calendarRead.batch.window.endsAt,
            lastSyncedAt: calendarRead.batch.retrievedAt,
          }
        : {}),
      ...(calendarRead.nextSyncEligibleAt
        ? { nextSyncEligibleAt: calendarRead.nextSyncEligibleAt }
        : {}),
      ...(calendarAttention ? { attention: calendarAttention } : {}),
      ...(calendarRead.failure ? { failure: calendarRead.failure } : {}),
    },
  };
}
