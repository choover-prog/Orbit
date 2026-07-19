import type { ConnectorMode, OrbitSnapshot } from "@/domain/orbit/connectors";
import { buildWeatherContextArtifacts } from "@/domain/orbit/weather-attention";
import {
  createClientFixtureSnapshot,
  travelAttentionBundle,
} from "@/mocks/orbit-snapshot";
import type { ConnectionStatus } from "@/domain/orbit/types";
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

export async function buildOrbitSnapshot(
  options: BuildOrbitSnapshotOptions = {},
): Promise<OrbitSnapshot> {
  const now = options.now ?? new Date();
  const registry = options.registry ?? getConnectorRegistry();
  const base = createClientFixtureSnapshot();
  const weatherRead = await registry.weather.read(now);
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
  const attention = [
    travelAttentionBundle,
    ...(weatherAttention ? [weatherAttention] : []),
  ];
  const selectedAttentionId =
    options.contextPreference === "weather"
      ? (weatherAttention?.id ?? null)
      : travelAttentionBundle.id;
  const failure = "failure" in weatherRead ? weatherRead.failure : undefined;
  const weatherStatus = weatherRead.status;

  return {
    ...base,
    generatedAt: now.toISOString(),
    selectedAttentionId,
    attention,
    contextRecords: [
      ...base.contextRecords,
      ...(artifacts ? [artifacts.contextRecord] : []),
    ],
    evidence: [...base.evidence, ...(artifacts ? [artifacts.evidence] : [])],
    sourceRecords: hasRecord ? [weatherRead.record] : [],
    connections: base.connections.map((connection) =>
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
    weather: {
      status: weatherStatus,
      mode: weatherRead.mode,
      ...(hasRecord ? { reading: weatherRead.record.payload } : {}),
      ...(weatherAttention ? { attention: weatherAttention } : {}),
      ...(failure ? { failure } : {}),
    },
  };
}
