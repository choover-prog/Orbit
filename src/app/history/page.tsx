import type { Metadata } from "next";
import { HistoryClient } from "./HistoryClient";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <main id="main-content" className="admin-shell">
      <p className="admin-kicker">Audit and recovery</p>
      <h1 className="admin-title">What Orbit did—and whether it worked.</h1>
      <p className="admin-intro">
        This local demonstration records only fictional action state in your
        browser. Transport acceptance and verified provider state remain
        separate.
      </p>
      <HistoryClient />
    </main>
  );
}
