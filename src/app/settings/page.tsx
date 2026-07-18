import type { Metadata } from "next";
import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main id="main-content" className="admin-shell">
      <p className="admin-kicker">Local preferences</p>
      <h1 className="admin-title">Orbit should fit around you.</h1>
      <p className="admin-intro">
        These settings remain in this browser. Production accounts, retention,
        voice services, and synchronization are intentionally absent.
      </p>
      <SettingsClient />
    </main>
  );
}
