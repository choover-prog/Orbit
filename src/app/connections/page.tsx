import type { Metadata } from "next";
import {
  CalendarConnectionPanel,
  type CalendarConnectionNotice,
} from "@/features/connections/CalendarConnectionPanel";
import { buildOrbitSnapshot } from "@/server/context/buildOrbitSnapshot";

export const metadata: Metadata = { title: "Connections" };
export const dynamic = "force-dynamic";

interface ConnectionsPageProps {
  searchParams: Promise<{ calendar?: string }>;
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

export default async function ConnectionsPage({
  searchParams,
}: ConnectionsPageProps) {
  const { calendar } = await searchParams;
  const snapshot = await buildOrbitSnapshot();

  return (
    <main id="main-content" className="admin-shell">
      <p className="admin-kicker">Connection boundaries</p>
      <h1 className="admin-title">Access should be understandable.</h1>
      <p className="admin-intro">
        Every source begins with a narrow purpose. Google Calendar is a local,
        read-only personal connection; the demo calendar, email, and home data
        remain fictional. Weather may use a public read-only forecast.
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
      <div className="admin-list">
        {snapshot.connections
          .filter(
            (connection) => connection.id !== "connection_google_calendar",
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
