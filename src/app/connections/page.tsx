import type { Metadata } from "next";
import {
  CalendarConnectionPanel,
  type CalendarConnectionNotice,
} from "@/features/connections/CalendarConnectionPanel";
import {
  GmailConnectionPanel,
  type GmailConnectionNotice,
} from "@/features/connections/GmailConnectionPanel";
import { buildOrbitSnapshot } from "@/server/context/buildOrbitSnapshot";
import {
  GoogleNestConnectionPanel,
  type GoogleNestNotice,
} from "@/features/connections/GoogleNestConnectionPanel";
import { DeviceAtlasPanel } from "@/features/connections/DeviceAtlasPanel";
import { getDeviceAtlasFixture } from "@/server/device-atlas/fixture";

export const metadata: Metadata = { title: "Connections" };
export const dynamic = "force-dynamic";

interface ConnectionsPageProps {
  searchParams: Promise<{ calendar?: string; gmail?: string; nest?: string }>;
}

function parseNestNotice(
  value: string | undefined,
): GoogleNestNotice | undefined {
  return [
    "connected",
    "disconnected",
    "synced",
    "current",
    "denied",
    "invalid_callback",
    "failed",
    "local_only",
  ].find((notice) => notice === value) as GoogleNestNotice | undefined;
}

function parseCalendarNotice(
  value: string | undefined,
): CalendarConnectionNotice | undefined {
  const notices: CalendarConnectionNotice[] = [
    "connected",
    "disconnected",
    "synced",
    "current",
    "denied",
    "expired",
    "invalid_callback",
    "failed",
    "local_only",
  ];
  return notices.find((notice) => notice === value);
}

function parseGmailNotice(
  value: string | undefined,
): GmailConnectionNotice | undefined {
  const notices: GmailConnectionNotice[] = [
    "connected",
    "disconnected",
    "synced",
    "current",
    "denied",
    "expired",
    "invalid_callback",
    "failed",
    "local_only",
  ];
  return notices.find((notice) => notice === value);
}

export default async function ConnectionsPage({
  searchParams,
}: ConnectionsPageProps) {
  const { calendar, gmail, nest } = await searchParams;
  const snapshot = await buildOrbitSnapshot();

  return (
    <main id="main-content" className="admin-shell">
      <p className="admin-kicker">Connection boundaries</p>
      <h1 className="admin-title">Access should be understandable.</h1>
      <p className="admin-intro">
        Every source begins with a narrow purpose. Google Calendar and Gmail are
        isolated, local, read-only personal connections. Their fixture modes and
        the home data remain fictional. Weather may use a public read-only
        forecast.
      </p>
      <CalendarConnectionPanel
        connection={{
          status: snapshot.calendar.status,
          mode: snapshot.calendar.mode,
          eventCount: snapshot.calendar.eventCount,
          complete: snapshot.calendar.complete,
          lastSyncedAt: snapshot.calendar.lastSyncedAt,
          windowStart: snapshot.calendar.windowStart,
          windowEnd: snapshot.calendar.windowEnd,
          nextSyncEligibleAt: snapshot.calendar.nextSyncEligibleAt,
          canSync:
            !snapshot.calendar.nextSyncEligibleAt ||
            Date.parse(snapshot.calendar.nextSyncEligibleAt) <=
              Date.parse(snapshot.generatedAt),
          failureMessage: snapshot.calendar.failure?.message,
        }}
        notice={parseCalendarNotice(calendar)}
      />
      <GmailConnectionPanel
        connection={{
          status: snapshot.email.status,
          mode: snapshot.email.mode,
          messageCount: snapshot.email.messageCount,
          complete: snapshot.email.complete,
          lastSyncedAt: snapshot.email.lastSyncedAt,
          windowStart: snapshot.email.windowStart,
          windowEnd: snapshot.email.windowEnd,
          nextSyncEligibleAt: snapshot.email.nextSyncEligibleAt,
          canSync:
            !snapshot.email.nextSyncEligibleAt ||
            Date.parse(snapshot.email.nextSyncEligibleAt) <=
              Date.parse(snapshot.generatedAt),
          failureMessage: snapshot.email.failure?.message,
        }}
        notice={parseGmailNotice(gmail)}
      />
      <GoogleNestConnectionPanel
        snapshot={snapshot.home}
        notice={parseNestNotice(nest)}
      />
      <DeviceAtlasPanel snapshot={getDeviceAtlasFixture()} />
      <div className="admin-list">
        {snapshot.connections
          .filter(
            (connection) =>
              ![
                "connection_google_calendar",
                "connection_google_gmail",
                "connection_email",
                "connection_home",
                "connection_google_nest",
              ].includes(connection.id),
          )
          .map((connection) => (
            <article className="admin-row" key={connection.id}>
              <div>
                <h2>{connection.displayName}</h2>
                <p className="connection-mode">{connection.mode} mode</p>
              </div>
              <div>
                {connection.capabilities.map((capability) => (
                  <p key={capability.id}>
                    {capability.label} · {capability.access}
                  </p>
                ))}
                <p>{connection.lastSyncLabel}</p>
                {connection.statusDetail ? (
                  <p className="connection-detail">{connection.statusDetail}</p>
                ) : null}
              </div>
              <span className="status-text" data-status={connection.health}>
                {connection.health}
              </span>
            </article>
          ))}
      </div>
    </main>
  );
}
