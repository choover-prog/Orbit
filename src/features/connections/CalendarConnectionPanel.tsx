"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CalendarContextStatus,
  ConnectorMode,
} from "@/domain/orbit/connectors";

export type CalendarConnectionNotice =
  | "connected"
  | "disconnected"
  | "synced"
  | "current"
  | "denied"
  | "expired"
  | "invalid_callback"
  | "failed"
  | "local_only";

export interface CalendarConnectionView {
  status: CalendarContextStatus;
  mode: ConnectorMode;
  eventCount: number;
  complete: boolean;
  lastSyncedAt?: string;
  windowStart?: string;
  windowEnd?: string;
  nextSyncEligibleAt?: string;
  canSync?: boolean;
  failureMessage?: string;
}

interface CalendarConnectionPanelProps {
  connection: CalendarConnectionView;
  notice?: CalendarConnectionNotice;
}

const liveNoticeCopy: Record<CalendarConnectionNotice, string> = {
  connected:
    "Google Calendar is connected and the first bounded read completed.",
  disconnected:
    "Google Calendar was disconnected. Local credentials and synchronized data were removed.",
  synced: "Google Calendar context was refreshed.",
  current:
    "Google Calendar context is already fresh; no provider request was needed.",
  denied: "Google Calendar access was not granted. Nothing was stored.",
  expired: "The connection attempt expired. Please start again.",
  invalid_callback:
    "Orbit rejected an invalid connection response. Nothing was stored.",
  failed:
    "Orbit could not finish the Calendar request. Review the status below and try again.",
  local_only:
    "Local access was removed. Google could not confirm remote revocation, so you may also remove Orbit in Google Account security settings.",
};

const fixtureNoticeCopy: Record<CalendarConnectionNotice, string> = {
  ...liveNoticeCopy,
  connected:
    "The fictional Calendar fixture is active and its first bounded read completed.",
  disconnected:
    "The fictional Calendar fixture was disconnected and its in-memory data was removed.",
  synced: "The fictional Calendar context was refreshed.",
  current:
    "The fictional Calendar context is already fresh; no simulated provider read was needed.",
};

function statusLabel(status: CalendarContextStatus) {
  const labels: Record<CalendarContextStatus, string> = {
    configuration_required: "Unavailable",
    disconnected: "Not connected",
    connected: "Connected",
    reauthorization_required: "Reconnect required",
    storage_unavailable: "Secure storage unavailable",
    syncing: "Refreshing",
    fresh: "Fresh",
    stale: "Stale",
    rate_limited: "Rate limited",
    unavailable: "Unavailable",
  };
  return labels[status];
}

function timeLabel(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isConnectedState(status: CalendarContextStatus) {
  return [
    "connected",
    "syncing",
    "fresh",
    "stale",
    "rate_limited",
    "unavailable",
  ].includes(status);
}

export function isCalendarNoticeConsistent(
  notice: CalendarConnectionNotice,
  status: CalendarContextStatus,
) {
  if (["connected", "synced", "current"].includes(notice)) {
    return status === "fresh";
  }

  if (["disconnected", "local_only", "denied"].includes(notice)) {
    return status === "disconnected";
  }

  return true;
}

function noticeSeverity(notice: CalendarConnectionNotice) {
  if (["connected", "disconnected", "synced", "current"].includes(notice)) {
    return "success";
  }
  if (["denied", "expired", "local_only"].includes(notice)) {
    return "warning";
  }
  return "error";
}

export function CalendarConnectionPanel({
  connection,
  notice,
}: CalendarConnectionPanelProps) {
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const disconnectTriggerRef = useRef<HTMLButtonElement>(null);
  const disconnectConfirmRef = useRef<HTMLButtonElement>(null);
  const connected = isConnectedState(connection.status);
  const canClearLocalData =
    connected ||
    connection.status === "storage_unavailable" ||
    connection.status === "reauthorization_required";
  const lastSync = timeLabel(connection.lastSyncedAt);
  const windowStart = timeLabel(connection.windowStart);
  const windowEnd = timeLabel(connection.windowEnd);
  const nextSync = timeLabel(connection.nextSyncEligibleAt);
  const visibleNotice =
    notice && isCalendarNoticeConsistent(notice, connection.status)
      ? notice
      : undefined;
  const isFixture = connection.mode === "fixture";
  const visibleNoticeSeverity = visibleNotice
    ? noticeSeverity(visibleNotice)
    : undefined;

  useEffect(() => {
    if (confirmingDisconnect) disconnectConfirmRef.current?.focus();
  }, [confirmingDisconnect]);

  const cancelDisconnect = () => {
    setConfirmingDisconnect(false);
    requestAnimationFrame(() => disconnectTriggerRef.current?.focus());
  };

  return (
    <article
      className="calendar-connection"
      aria-labelledby="google-calendar-title"
    >
      <header className="calendar-connection__header">
        <div>
          <p className="connection-mode">
            {isFixture
              ? "fixture mode · fictional demo"
              : "live mode · personal"}
          </p>
          <h2 id="google-calendar-title">
            {isFixture ? "Calendar demo" : "Google Calendar"}
          </h2>
        </div>
        <span className="status-text" data-status={connection.status}>
          {statusLabel(connection.status)}
        </span>
      </header>

      {visibleNotice ? (
        <p
          className="calendar-connection__notice"
          data-severity={visibleNoticeSeverity}
          role={visibleNoticeSeverity === "error" ? "alert" : "status"}
        >
          {(isFixture ? fixtureNoticeCopy : liveNoticeCopy)[visibleNotice]}
        </p>
      ) : null}

      <div id="calendar-consent" className="calendar-connection__consent">
        {isFixture ? (
          <p>
            This offline demo reads only fictional event titles, timing,
            availability, status, update time, and the fictional user&apos;s own
            response from yesterday through the next 14 days. It makes no Google
            request, stores no durable credential, and cannot create, change, or
            delete events on a real calendar.
          </p>
        ) : (
          <p>
            Orbit reads only event titles, timing, availability, status, update
            time, and your own response from your primary calendar, from
            yesterday through the next 14 days. It cannot create, change, or
            delete events.
          </p>
        )}
        <ul>
          <li>
            {isFixture
              ? "Read-only access to a fictional in-memory event set"
              : "Read-only access to events on the primary calendar you own"}
          </li>
          <li>Minimal normalized timing data, cached only by this local app</li>
          <li>
            {!isFixture
              ? "A refresh token encrypted for your Windows account"
              : "No provider request or durable credential in fixture mode"}
          </li>
          <li>
            No event descriptions, locations, attendee identities, or model
            calls
          </li>
        </ul>
      </div>

      {connection.failureMessage ? (
        <p
          className="calendar-connection__problem"
          role={
            connection.status === "rate_limited" ||
            connection.status === "stale"
              ? "status"
              : "alert"
          }
        >
          {connection.failureMessage}
        </p>
      ) : null}

      {connected ? (
        <dl className="calendar-connection__facts">
          <div>
            <dt>Authority</dt>
            <dd>Read only</dd>
          </div>
          <div>
            <dt>Validated events</dt>
            <dd>
              {connection.eventCount}
              {!connection.complete ? " · incomplete read" : ""}
            </dd>
          </div>
          {lastSync ? (
            <div>
              <dt>Last read</dt>
              <dd>
                <time dateTime={connection.lastSyncedAt}>{lastSync}</time>
              </dd>
            </div>
          ) : null}
          {windowStart && windowEnd ? (
            <div>
              <dt>Bounded window</dt>
              <dd>
                <time dateTime={connection.windowStart}>{windowStart}</time>
                {" to "}
                <time dateTime={connection.windowEnd}>{windowEnd}</time>
              </dd>
            </div>
          ) : null}
          {nextSync ? (
            <div>
              <dt>Next eligible refresh</dt>
              <dd>
                <time dateTime={connection.nextSyncEligibleAt}>{nextSync}</time>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="calendar-connection__actions">
        {connection.status === "configuration_required" ? (
          <p className="connection-detail">
            Google Calendar is not available in this Orbit build. Nothing is
            required from your Google account or this device.
          </p>
        ) : null}

        {connection.status === "storage_unavailable" ? (
          <p className="connection-detail">
            Live Calendar storage requires Windows DPAPI. Orbit will not fall
            back to a plaintext token file.
          </p>
        ) : null}

        {connection.status === "disconnected" ||
        connection.status === "reauthorization_required" ? (
          <form action="/api/connectors/google-calendar/connect" method="post">
            <button
              className="button-primary"
              type="submit"
              aria-describedby="calendar-consent"
            >
              {connection.status === "reauthorization_required"
                ? "Reconnect Google Calendar"
                : connection.mode === "fixture"
                  ? "Connect fictional Calendar fixture"
                  : "Connect Google Calendar"}
            </button>
          </form>
        ) : null}

        {connected ? (
          <>
            <form action="/api/connectors/google-calendar/sync" method="post">
              <button
                className="button-secondary"
                type="submit"
                disabled={
                  connection.status === "syncing" ||
                  connection.canSync === false
                }
              >
                {connection.status === "syncing"
                  ? "Refreshing…"
                  : connection.canSync === false
                    ? "Refresh available soon"
                    : "Refresh now"}
              </button>
            </form>
          </>
        ) : null}
        {canClearLocalData && !confirmingDisconnect ? (
          <button
            ref={disconnectTriggerRef}
            className="button-quiet"
            type="button"
            onClick={() => setConfirmingDisconnect(true)}
          >
            {connected ? "Disconnect" : "Clear local Calendar data"}
          </button>
        ) : null}
      </div>

      {confirmingDisconnect ? (
        <section
          className="calendar-connection__disconnect"
          aria-labelledby="disconnect-calendar-title"
        >
          <h3 id="disconnect-calendar-title">
            {isFixture
              ? "Disconnect the fictional Calendar demo?"
              : connected
                ? "Disconnect Google Calendar?"
                : "Clear local Calendar data?"}
          </h3>
          <p id="calendar-disconnect-detail">
            {isFixture
              ? "This removes only the fictional in-memory connection and event data. It makes no Google request and changes no real calendar."
              : "This removes local credentials and synchronized Calendar data. It does not change or delete anything in Google Calendar. Google may revoke every scope granted to this dedicated OAuth client."}
          </p>
          <div className="calendar-connection__actions">
            <form
              action="/api/connectors/google-calendar/disconnect"
              method="post"
            >
              <button
                ref={disconnectConfirmRef}
                className="button-danger"
                type="submit"
                aria-describedby="calendar-disconnect-detail"
              >
                {isFixture
                  ? "Remove fictional fixture"
                  : "Remove local connection"}
              </button>
            </form>
            <button
              className="button-secondary"
              type="button"
              onClick={cancelDisconnect}
            >
              {connected ? "Keep connected" : "Cancel"}
            </button>
          </div>
        </section>
      ) : null}
    </article>
  );
}
