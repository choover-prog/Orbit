import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import {
  GmailConnectionPanel,
  isGmailNoticeConsistent,
  type GmailConnectionView,
} from "./GmailConnectionPanel";

const disconnected: GmailConnectionView = {
  status: "disconnected",
  mode: "fixture",
  messageCount: 0,
  complete: true,
};

describe("GmailConnectionPanel", () => {
  it("requires explicit consent and labels the fictional boundary", async () => {
    const { container } = render(
      <GmailConnectionPanel connection={disconnected} />,
    );

    const connect = screen.getByRole("button", {
      name: "Connect fictional Gmail fixture",
    });
    expect(connect.closest("form")).toHaveAttribute(
      "action",
      "/api/connectors/gmail/connect",
    );
    expect(connect).toHaveAccessibleDescription(
      /offline demo reads only a small set of fictional unread Inbox records/i,
    );
    expect(screen.getByText(/makes no Google request/i)).toBeVisible();
    expect(screen.getByText(/stores no durable credential/i)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Gmail demo" })).toBeVisible();
    expect(
      screen.queryByText(/restricted Gmail read-only permission/i),
    ).not.toBeInTheDocument();
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("explains the broader restricted authority and Orbit's narrower live use", () => {
    render(
      <GmailConnectionPanel connection={{ ...disconnected, mode: "live" }} />,
    );

    expect(
      screen.getByText(
        /restricted Gmail read-only permission can authorize reading mail/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/small, bounded set of unread Inbox/i),
    ).toBeVisible();
    expect(
      screen.getByText(/No full bodies, MIME parts, attachments, headers/i),
    ).toBeVisible();
    expect(screen.getByText(/separate from Google Calendar/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
  });

  it("never lets a query notice contradict connector state or fixture identity", () => {
    const { rerender } = render(
      <GmailConnectionPanel connection={disconnected} notice="connected" />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(
      <GmailConnectionPanel
        connection={{ ...disconnected, status: "fresh", messageCount: 3 }}
        notice="connected"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /fictional Gmail fixture is active/i,
    );
    expect(screen.queryByText(/^Gmail is connected/i)).not.toBeInTheDocument();
    expect(isGmailNoticeConsistent("disconnected", "fresh")).toBe(false);
    expect(isGmailNoticeConsistent("synced", "stale")).toBe(false);
  });

  it("shows bounded freshness and preserves focus through disconnect confirmation", async () => {
    const user = userEvent.setup();
    render(
      <GmailConnectionPanel
        connection={{
          status: "fresh",
          mode: "live",
          messageCount: 5,
          complete: true,
          lastSyncedAt: "2026-07-19T14:00:00.000Z",
          windowStart: "2026-07-12T14:00:00.000Z",
          windowEnd: "2026-07-19T14:00:00.000Z",
          nextSyncEligibleAt: "2026-07-19T14:05:00.000Z",
          canSync: false,
        }}
      />,
    );

    expect(screen.getByText("Restricted read only")).toBeVisible();
    expect(screen.getByText("5")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Refresh available soon" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(
      screen.getByText(/does not change mail or your Calendar connection/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Remove local Gmail connection" }),
    ).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Keep connected" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Disconnect" })).toHaveFocus(),
    );
  });

  it("uses fixture-specific disconnect language and an alert for failures", async () => {
    const user = userEvent.setup();
    render(
      <GmailConnectionPanel
        connection={{ ...disconnected, status: "fresh", messageCount: 3 }}
        notice="failed"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/could not finish/i);
    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(
      screen.getByRole("heading", {
        name: "Disconnect the fictional Gmail demo?",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/fictional in-memory.*makes no Google request/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Remove fictional fixture" }),
    ).toHaveFocus();
  });

  it("does not ask the person to configure a missing publisher identity", () => {
    render(
      <GmailConnectionPanel
        connection={{
          ...disconnected,
          mode: "live",
          status: "configuration_required",
          failureMessage: "Gmail is unavailable in this Orbit build.",
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Connect Gmail/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Gmail is unavailable in this Orbit build.",
    );
    expect(
      screen.getByText(/nothing is required from your Google account/i),
    ).toBeVisible();
    expect(
      screen.queryByText(/\.env\.local|client ID/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear local Gmail data" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["stale", "Last validated Gmail context is stale."],
    ["rate_limited", "Google asked Orbit to wait before refreshing Gmail."],
  ] as const)(
    "explains the %s health state without hiding read-only authority",
    (status, failureMessage) => {
      render(
        <GmailConnectionPanel
          connection={{
            ...disconnected,
            mode: "live",
            status,
            messageCount: status === "stale" ? 2 : 0,
            failureMessage,
          }}
        />,
      );

      expect(
        screen.getByText(status === "stale" ? "Stale" : "Rate limited"),
      ).toBeVisible();
      expect(screen.getByRole("status")).toHaveTextContent(failureMessage);
      expect(screen.getByText("Restricted read only")).toBeVisible();
    },
  );

  it("offers an explicit reconnect after authorization is lost", () => {
    render(
      <GmailConnectionPanel
        connection={{
          ...disconnected,
          mode: "live",
          status: "reauthorization_required",
          failureMessage: "Gmail must be connected again.",
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Reconnect Gmail" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Clear local Gmail data" }),
    ).toBeVisible();
    expect(screen.queryByText("Restricted read only")).not.toBeInTheDocument();
  });

  it("represents every lifecycle label without relying on color", () => {
    const states = [
      ["configuration_required", "Unavailable"],
      ["disconnected", "Not connected"],
      ["connected", "Connected"],
      ["reauthorization_required", "Reconnect required"],
      ["storage_unavailable", "Secure storage unavailable"],
      ["syncing", "Refreshing"],
      ["fresh", "Fresh"],
      ["stale", "Stale"],
      ["rate_limited", "Rate limited"],
      ["unavailable", "Unavailable"],
    ] as const;

    const { rerender } = render(
      <GmailConnectionPanel
        connection={{ ...disconnected, status: states[0][0] }}
      />,
    );

    for (const [status, label] of states) {
      rerender(
        <GmailConnectionPanel connection={{ ...disconnected, status }} />,
      );
      expect(screen.getByText(label)).toBeVisible();
    }
  });
});
