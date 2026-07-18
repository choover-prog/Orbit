"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ActionAuditRecord } from "@/domain/orbit/types";
import { useLocalStorageValue } from "@/lib/useLocalStorageValue";
import { createMockCalendarAdapter } from "@/mocks/calendar-adapter";

const STORAGE_KEY = "orbit.mock.audit-record";

export function HistoryClient() {
  const [record, setRecord] = useLocalStorageValue<ActionAuditRecord | null>(
    STORAGE_KEY,
    null,
  );
  const [message, setMessage] = useState("");
  const adapter = useMemo(() => createMockCalendarAdapter(), []);

  const undo = async () => {
    if (!record) return;
    try {
      const next = await adapter.undo(record);
      setRecord(next);
      setMessage("Undo was verified in the mock calendar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Undo failed.");
    }
  };

  if (!record) {
    return (
      <div className="admin-list">
        <div className="admin-row">
          <h2>No actions yet</h2>
          <p>
            Complete the fictional scheduling flow to see approval, execution,
            verification, and undo history.
          </p>
          <Link className="button-primary" href="/">
            Run the demo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-list">
      <p role="status" aria-live="polite">
        {message}
      </p>
      <div className="admin-row">
        <h2>{record.proposal.summary}</h2>
        <p>
          {record.verification.status === "verified"
            ? record.verification.observed
            : "Verification did not match the approved result."}
        </p>
        <span
          className="status-text"
          data-status={
            record.verification.status === "verified"
              ? "connected"
              : "attention"
          }
        >
          {record.verification.status}
        </span>
      </div>
      {record.events.map((event) => (
        <div className="admin-row" key={event.id}>
          <h2>{event.eventType.replaceAll("_", " ")}</h2>
          <p>{event.summary}</p>
          <time dateTime={event.occurredAt}>
            {new Date(event.occurredAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
        </div>
      ))}
      <div className="admin-row">
        <h2>Recovery</h2>
        <p>{record.undo.summary}</p>
        {record.undo.status === "available" ? (
          <button className="button-primary" onClick={undo}>
            Undo
          </button>
        ) : (
          <span className="status-text">{record.undo.status}</span>
        )}
      </div>
    </div>
  );
}
