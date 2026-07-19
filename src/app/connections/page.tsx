import type { Metadata } from "next";
import { buildOrbitSnapshot } from "@/server/context/buildOrbitSnapshot";

export const metadata: Metadata = { title: "Connections" };
export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const snapshot = await buildOrbitSnapshot();

  return (
    <main id="main-content" className="admin-shell">
      <p className="admin-kicker">Connection boundaries</p>
      <h1 className="admin-title">Access should be understandable.</h1>
      <p className="admin-intro">
        Calendar, email, and home remain fictional fixtures. Weather may use a
        public, read-only forecast at one fixed test location when live mode is
        enabled. No personal account or credential is stored.
      </p>
      <div className="admin-list">
        {snapshot.connections.map((connection) => (
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
