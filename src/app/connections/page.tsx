import type { Metadata } from "next";
import { connections } from "@/mocks/fixtures";

export const metadata: Metadata = { title: "Connections" };

export default function ConnectionsPage() {
  return (
    <main id="main-content" className="admin-shell">
      <p className="admin-kicker">Mocked connections</p>
      <h1 className="admin-title">Access should be understandable.</h1>
      <p className="admin-intro">
        These fictional providers demonstrate capability-level permissions. No
        account is connected and no credential is stored.
      </p>
      <div className="admin-list">
        {connections.map((connection) => (
          <article className="admin-row" key={connection.id}>
            <h2>{connection.displayName}</h2>
            <div>
              {connection.capabilities.map((capability) => (
                <p key={capability.id}>
                  {capability.label} · {capability.access}
                </p>
              ))}
              <p>{connection.lastSyncLabel}</p>
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
