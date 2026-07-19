"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ConnectorMode,
  EmailContextStatus,
} from "@/domain/orbit/connectors";

export type GmailConnectionNotice =
  | "connected"
  | "disconnected"
  | "synced"
  | "current"
  | "denied"
  | "expired"
  | "invalid_callback"
  | "failed"
  | "local_only";

export interface GmailConnectionView {
  status: EmailContextStatus;
  mode: ConnectorMode;
  messageCount: number;
  complete: boolean;
  lastSyncedAt?: string;
  windowStart?: string;
  windowEnd?: string;
  nextSyncEligibleAt?: string;
  canSync?: boolean;
  failureMessage?: string;
}

interface GmailConnectionPanelProps {
  connection: GmailConnectionView;
  notice?: GmailConnectionNotice;
}

const liveNoticeCopy: Record<GmailConnectionNotice, string> = {
  connected: "Gmail is connected and the first bounded read completed.",
  disconnected:
    "Gmail was disconnected. Gmail-only credentials and synchronized data were removed from this device.",
  synced: "Gmail context was refreshed.",
  current: "Gmail context is already fresh; no provider request was needed.",
  denied: "Gmail access was not granted. Nothing was stored.",
  expired: "The Gmail connection attempt expired. Please start again.",
  invalid_callback:
    "Orbit rejected an invalid Gmail connection response. Nothing was stored.",
  failed:
    "Orbit could not finish the Gmail request. Review the status below and try again.",
  local_only:
    "Local Gmail access was removed. Google could not confirm remote revocation, so you may also remove Orbit in Google Account security settings.",
};

const fixtureNoticeCopy: Record<GmailConnectionNotice, string> = {
  ...liveNoticeCopy,
  connected:
    "The fictional Gmail fixture is active and its first bounded read completed.",
  disconnected:
    "The fictional Gmail fixture was disconnected and its in-memory data was removed.",
  synced: "The fictional Gmail context was refreshed.",
  current:
    "The fictional Gmail context is already fresh; no simulated provider read was needed.",
  local_only:
    "The fictional Gmail fixture was removed locally. It made no Google request.",
};

function statusLabel(status: EmailContextStatus) {
  const labels: Record<EmailContextStatus, string> = {
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

function isConnectedState(status: EmailContextStatus) {
  return [
    "connected",
    "syncing",
    "fresh",
    "stale",
    "rate_limited",
    "unavailable",
  ].includes(status);
}

export function isGmailNoticeConsistent(
  notice: GmailConnectionNotice,
  status: EmailContextStatus,
) {
  if (["connected", "synced", "current"].includes(notice)) {
    return status === "fresh";
  }

  if (["disconnected", "local_only", "denied"].includes(notice)) {
    return status === "disconnected";
  }

  return true;
}

function noticeSeverity(notice: GmailConnectionNotice) {
  if (["connected", "disconnected", "synced", "current"].includes(notice)) {
    return "success";
  }
  if (["denied", "expired", "local_only"].includes(notice)) {
    return "warning";
  }
  return "error";
}

export function GmailConnectionPanel({
  connection,
  notice,
}: GmailConnectionPanelProps) {
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
    notice && isGmailNoticeConsistent(notice, connection.status)
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
    <article className="gmail-connection" aria-labelledby="gmail-title">
      <header className="gmail-connection__header">
        <div>
          <p className="connection-mode">
            {isFixture
              ? "fixture mode · fictional demo"
              : "live mode · private local evaluation"}
          </p>
          <h2 id="gmail-title">{isFixture ? "Gmail demo" : "Gmail"}</h2>
        </div>
        <span className="status-text" data-status={connection.status}>
          {statusLabel(connection.status)}
        </span>
      </header>

      {visibleNotice ? (
        <p
          className="gmail-connection__notice"
          data-severity={visibleNoticeSeverity}
          role={visibleNoticeSeverity === "error" ? "alert" : "status"}
        >
          {(isFixture ? fixtureNoticeCopy : liveNoticeCopy)[visibleNotice]}
        </p>
      ) : null}

      <div id="gmail-consent" className="gmail-connection__consent">
        {isFixture ? (
          <p>
            This offline demo reads only a small set of fictional unread Inbox
            records: anonymous identifiers, bounded subjects, received times,
            Inbox, unread, and important state, and short sanitized snippets. It
            makes no Google request, stores no durable credential, and cannot
            send or change real mail.
          </p>
        ) : (
          <p>
            Google&apos;s restricted Gmail read-only permission can authorize
            reading mail. Orbit deliberately uses it only for a small, bounded
            set of unread Inbox message identifiers, bounded subjects, received
            times, Inbox, unread, and important state, and short sanitized
            snippets. A snippet is private, body-derived text. Orbit cannot send
            or change mail.
          </p>
        )}
        <ul>
          <li>
            {isFixture
              ? "A fixed fictional unread-Inbox set with a small item and time limit"
              : "A fixed unread-Inbox query with a small item and time limit"}
          </li>
          <li>
            {isFixture
              ? "Fictional snippets remain in this local process only"
              : "Validated snippets remain in this local process cache only"}
          </li>
          <li>
            {!isFixture
              ? "A Gmail-only refresh token encrypted for your Windows account"
              : "No provider request or durable credential in fixture mode"}
          </li>
          <li>
            No full bodies, MIME parts, attachments, headers other than the
            bounded Subject, sender or recipient addresses, drafts, thread
            expansion, search index, or model calls
          </li>
          <li>
            Gmail data and credentials remain separate from Google Calendar
          </li>
        </ul>
      </div>

      {connection.failureMessage ? (
        <p
          className="gmail-connection__problem"
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
        <dl className="gmail-connection__facts">
          <div>
            <dt>Authority</dt>
            <dd>Restricted read only</dd>
          </div>
          <div>
            <dt>Validated messages</dt>
            <dd>
              {connection.messageCount}
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

      <div className="gmail-connection__actions">
        {connection.status === "configuration_required" ? (
          <p className="connection-detail">
            Gmail is not available in this Orbit build. Nothing is required from
            your Google account or this device.
          </p>
        ) : null}

        {connection.status === "storage_unavailable" ? (
          <p className="connection-detail">
            Live Gmail storage requires Windows DPAPI. Orbit will not fall back
            to a plaintext token file.
          </p>
        ) : null}

        {connection.status === "disconnected" ||
        connection.status === "reauthorization_required" ? (
          <form action="/api/connectors/gmail/connect" method="post">
            <button
              className="button-primary"
              type="submit"
              aria-describedby="gmail-consent"
            >
              {connection.status === "reauthorization_required"
                ? "Reconnect Gmail"
                : isFixture
                  ? "Connect fictional Gmail fixture"
                  : "Connect Gmail"}
            </button>
          </form>
        ) : null}

        {connected ? (
          <form action="/api/connectors/gmail/sync" method="post">
            <button
              className="button-secondary"
              type="submit"
              disabled={
                connection.status === "syncing" || connection.canSync === false
              }
            >
              {connection.status === "syncing"
                ? "Refreshing…"
                : connection.canSync === false
                  ? "Refresh available soon"
                  : "Refresh now"}
            </button>
          </form>
        ) : null}

        {canClearLocalData && !confirmingDisconnect ? (
          <button
            ref={disconnectTriggerRef}
            className="button-quiet"
            type="button"
            onClick={() => setConfirmingDisconnect(true)}
          >
            {connected ? "Disconnect" : "Clear local Gmail data"}
          </button>
        ) : null}
      </div>

      {confirmingDisconnect ? (
        <section
          className="gmail-connection__disconnect"
          aria-labelledby="disconnect-gmail-title"
        >
          <h3 id="disconnect-gmail-title">
            {isFixture
              ? "Disconnect the fictional Gmail demo?"
              : connected
                ? "Disconnect Gmail?"
                : "Clear local Gmail data?"}
          </h3>
          <p id="gmail-disconnect-detail">
            {isFixture
              ? "This removes only the fictional in-memory connection and message data. It makes no Google request and changes no real mail."
              : "This removes only Gmail credentials, synchronized messages, and attention from this device. It does not change mail or your Calendar connection. Google may revoke every scope granted to this dedicated Gmail OAuth client."}
          </p>
          <div className="gmail-connection__actions">
            <form action="/api/connectors/gmail/disconnect" method="post">
              <button
                ref={disconnectConfirmRef}
                className="button-danger"
                type="submit"
                aria-describedby="gmail-disconnect-detail"
              >
                {isFixture
                  ? "Remove fictional fixture"
                  : "Remove local Gmail connection"}
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
