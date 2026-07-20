import type { ConnectorMode, OrbitSnapshot } from "@/domain/orbit/connectors";
import { buildWeatherContextArtifacts } from "@/domain/orbit/weather-attention";
import { buildCalendarContextArtifacts } from "@/domain/orbit/calendar-attention";
import { buildCalendarEmailContextArtifacts } from "@/domain/orbit/calendar-email-attention";
import { buildHomeContextArtifacts } from "@/domain/orbit/home-attention";
import {
  createClientFixtureSnapshot,
  travelAttentionBundle,
} from "@/mocks/orbit-snapshot";
import type { ConnectionStatus } from "@/domain/orbit/types";
import type { GoogleCalendarGatewayState } from "@/server/connectors/google-calendar";
import type { GmailGatewayState } from "@/server/connectors/gmail";
import type { GoogleNestGatewayState } from "@/server/connectors/google-nest";
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

function gmailConnection(state: GmailGatewayState): ConnectionStatus {
  const health: ConnectionStatus["health"] =
    state.status === "fresh"
      ? "connected"
      : state.status === "storage_unavailable"
        ? "configuration_required"
        : state.status;
  const batch = state.batch;
  let statusDetail =
    "Orbit reads a bounded set of recent unread Inbox subjects and snippets. It cannot change or send email.";

  if (state.mode === "fixture") {
    statusDetail =
      "Fictional local OAuth and Gmail data; no Google request or durable credential.";
  }
  if (state.failure) statusDetail = state.failure.message;
  if (batch && batch.completeness !== "complete") {
    statusDetail =
      "The bounded read was incomplete, so Orbit suppressed cross-source email attention.";
  }

  return {
    id: "connection_google_gmail",
    displayName: "Gmail",
    category: "email",
    mode: state.mode,
    health,
    capabilities: [
      {
        id: "google_gmail_unread_inbox_read",
        label: "Read bounded unread Inbox subjects and snippets",
        access: "read",
      },
    ],
    lastSyncLabel: batch
      ? `${batch.records.length} validated messages in a bounded read`
      : state.authorization === "connected"
        ? "No validated read available"
        : "No personal Gmail connected",
    ...(batch ? { lastSyncedAt: batch.retrievedAt } : {}),
    statusDetail,
  };
}

function nestConnection(state: GoogleNestGatewayState): ConnectionStatus {
  const batch = state.batch;
  const payload = batch?.records[0]?.payload;
  return {
    id: "connection_google_nest",
    displayName: "Google Home / Nest",
    category: "home",
    mode: state.mode,
    health:
      state.status === "fresh"
        ? "connected"
        : state.status === "storage_unavailable"
          ? "configuration_required"
          : state.status,
    capabilities: [
      {
        id: "google_nest_context",
        label: "Read selected structures and device traits",
        access: "read",
      },
      {
        id: "google_nest_stream",
        label: "Open temporary camera video when requested",
        access: "read",
      },
      {
        id: "google_nest_control",
        label: "Control supported devices after approval",
        access: "write",
      },
    ],
    lastSyncLabel: payload
      ? `${payload.devices.length} validated devices in a bounded read`
      : state.authorization === "connected"
        ? "No validated read available"
        : "No Google Nest home connected",
    ...(batch ? { lastSyncedAt: batch.retrievedAt } : {}),
    statusDetail:
      state.failure?.message ??
      (state.mode === "fixture"
        ? "Fictional Nest devices, camera preview, and command execution."
        : "Device Access is user-selected; video is temporary and commands require approval."),
  };
}

export async function buildOrbitSnapshot(
  options: BuildOrbitSnapshotOptions = {},
): Promise<OrbitSnapshot> {
  const now = options.now ?? new Date();
  const registry = options.registry ?? getConnectorRegistry();
  const base = createClientFixtureSnapshot();
  const [weatherRead, calendarRead, gmailRead, nestRead] = await Promise.all([
    registry.weather.read(now),
    registry.calendar.peek(now),
    registry.gmail.peek(now),
    registry.nest.peek(now),
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
  const calendarEmailArtifacts =
    calendarRead.batch && gmailRead.batch
      ? buildCalendarEmailContextArtifacts(
          calendarRead.batch.records,
          gmailRead.batch.records,
          now,
          {
            calendarComplete: calendarRead.batch.completeness === "complete",
            calendarFresh: calendarRead.status === "fresh",
            emailComplete: gmailRead.batch.completeness === "complete",
            emailFresh: gmailRead.status === "fresh",
          },
        )
      : undefined;
  const calendarEmailAttention = calendarEmailArtifacts?.attention;
  const homeArtifacts = nestRead.batch
    ? buildHomeContextArtifacts(nestRead.batch.records, now, {
        complete: nestRead.batch.completeness === "complete",
        fresh: nestRead.status === "fresh",
      })
    : undefined;
  const homeAttention = homeArtifacts?.attention;
  const attention = [
    travelAttentionBundle,
    ...(weatherAttention ? [weatherAttention] : []),
    ...(calendarAttention ? [calendarAttention] : []),
    ...(calendarEmailAttention ? [calendarEmailAttention] : []),
    ...(homeAttention ? [homeAttention] : []),
  ];
  const selectedAttentionId =
    options.contextPreference === "weather"
      ? (weatherAttention?.id ?? null)
      : options.contextPreference === "calendar"
        ? (calendarAttention?.id ?? null)
        : options.contextPreference === "email"
          ? (calendarEmailAttention?.id ?? null)
          : options.contextPreference === "home"
            ? (homeAttention?.id ?? null)
            : travelAttentionBundle.id;
  const failure = "failure" in weatherRead ? weatherRead.failure : undefined;
  const weatherStatus = weatherRead.status;

  return {
    ...base,
    generatedAt: now.toISOString(),
    requestedContext:
      options.contextPreference === "weather" ||
      options.contextPreference === "calendar" ||
      options.contextPreference === "email" ||
      options.contextPreference === "home"
        ? options.contextPreference
        : null,
    selectedAttentionId,
    attention,
    contextRecords: [
      ...base.contextRecords,
      ...(artifacts ? [artifacts.contextRecord] : []),
      ...(calendarArtifacts ? calendarArtifacts.contextRecords : []),
      ...(calendarEmailArtifacts ? calendarEmailArtifacts.contextRecords : []),
      ...(homeAttention ? homeAttention.contextRecords : []),
    ],
    evidence: [
      ...base.evidence,
      ...(artifacts ? [artifacts.evidence] : []),
      ...(calendarArtifacts ? calendarArtifacts.evidence : []),
      ...(calendarEmailArtifacts ? calendarEmailArtifacts.evidence : []),
      ...(homeAttention ? homeAttention.evidence : []),
    ],
    sourceRecords: [
      ...(hasRecord ? [weatherRead.record] : []),
      ...(calendarRead.batch ? calendarRead.batch.records : []),
      ...(gmailRead.batch ? gmailRead.batch.records : []),
      ...(nestRead.batch ? nestRead.batch.records : []),
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
      gmailConnection(gmailRead),
      nestConnection(nestRead),
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
    email: {
      status: gmailRead.status,
      authorization: gmailRead.authorization,
      mode: gmailRead.mode,
      records: gmailRead.batch?.records ?? [],
      complete: gmailRead.batch?.completeness === "complete",
      messageCount: gmailRead.batch?.records.length ?? 0,
      ...(gmailRead.batch
        ? {
            windowStart: gmailRead.batch.window.startsAt,
            windowEnd: gmailRead.batch.window.endsAt,
            lastSyncedAt: gmailRead.batch.retrievedAt,
          }
        : {}),
      ...(gmailRead.nextSyncEligibleAt
        ? { nextSyncEligibleAt: gmailRead.nextSyncEligibleAt }
        : {}),
      ...(calendarEmailAttention ? { attention: calendarEmailAttention } : {}),
      ...(gmailRead.failure ? { failure: gmailRead.failure } : {}),
    },
    home: {
      status: nestRead.status,
      authorization: nestRead.authorization,
      mode: nestRead.mode,
      records: nestRead.batch?.records ?? [],
      complete: nestRead.batch?.completeness === "complete",
      structureCount:
        nestRead.batch?.records[0]?.payload.structures.length ?? 0,
      roomCount: nestRead.batch?.records[0]?.payload.rooms.length ?? 0,
      deviceCount: nestRead.batch?.records[0]?.payload.devices.length ?? 0,
      supportedDeviceCount:
        nestRead.batch?.records[0]?.payload.devices.filter(
          (device) => device.supported,
        ).length ?? 0,
      unsupportedDeviceCount:
        nestRead.batch?.records[0]?.payload.devices.filter(
          (device) => !device.supported,
        ).length ?? 0,
      audit: nestRead.audit,
      ...(nestRead.batch ? { lastSyncedAt: nestRead.batch.retrievedAt } : {}),
      ...(nestRead.nextSyncEligibleAt
        ? { nextSyncEligibleAt: nestRead.nextSyncEligibleAt }
        : {}),
      ...(homeAttention ? { attention: homeAttention } : {}),
      ...(nestRead.failure ? { failure: nestRead.failure } : {}),
    },
  };
}
