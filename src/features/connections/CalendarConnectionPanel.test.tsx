import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import {
  CalendarConnectionPanel,
  isCalendarNoticeConsistent,
  type CalendarConnectionView,
} from "./CalendarConnectionPanel";

const disconnected: CalendarConnectionView = {
  status: "disconnected",
  mode: "fixture",
  eventCount: 0,
  complete: true,
};

describe("CalendarConnectionPanel", () => {
  it("requires explicit consent and states the read-only boundary", async () => {
    const { container } = render(
      <CalendarConnectionPanel connection={disconnected} />,
    );

    const connect = screen.getByRole("button", {
      name: "Connect fictional Calendar fixture",
    });
    expect(connect.closest("form")).toHaveAttribute(
      "action",
      "/api/connectors/google-calendar/connect",
    );
    expect(connect).toHaveAccessibleDescription(
      /offline demo reads only fictional/i,
    );
    expect(
      screen.getByText(/cannot create, change, or delete events/i),
    ).toBeVisible();
    expect(screen.getByText(/stores no durable credential/i)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Calendar demo" }),
    ).toBeVisible();
    expect(
      screen.queryByText(/your primary calendar/i),
    ).not.toBeInTheDocument();
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("never lets a query notice contradict connector state or fixture identity", () => {
    const { rerender } = render(
      <CalendarConnectionPanel connection={disconnected} notice="connected" />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(
      <CalendarConnectionPanel
        connection={{ ...disconnected, status: "fresh", eventCount: 3 }}
        notice="connected"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /fictional Calendar fixture is active/i,
    );
    expect(
      screen.queryByText(/Google Calendar is connected/i),
    ).not.toBeInTheDocument();
    expect(isCalendarNoticeConsistent("disconnected", "fresh")).toBe(false);
    expect(isCalendarNoticeConsistent("synced", "stale")).toBe(false);
  });

  it("shows bounded freshness and asks for confirmation before disconnect", async () => {
    const user = userEvent.setup();
    render(
      <CalendarConnectionPanel
        connection={{
          status: "fresh",
          mode: "live",
          eventCount: 12,
          complete: true,
          lastSyncedAt: "2026-07-19T14:00:00.000Z",
          windowStart: "2026-07-18T14:00:00.000Z",
          windowEnd: "2026-08-02T14:00:00.000Z",
          nextSyncEligibleAt: "2026-07-19T14:05:00.000Z",
          canSync: false,
        }}
      />,
    );

    expect(screen.getByText("Read only")).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Refresh available soon" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Remove local connection" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(
      screen.getByText(
        /does not change or delete anything in Google Calendar/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Remove local connection" }),
    ).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Keep connected" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Disconnect" })).toHaveFocus(),
    );
  });

  it("uses fixture-specific disconnect language and error notice semantics", async () => {
    const user = userEvent.setup();
    render(
      <CalendarConnectionPanel
        connection={{ ...disconnected, status: "fresh", eventCount: 3 }}
        notice="failed"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/could not finish/i);
    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(
      screen.getByRole("heading", {
        name: "Disconnect the fictional Calendar demo?",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/removes only the fictional.*makes no Google request/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Remove fictional fixture" }),
    ).toHaveFocus();
  });

  it("does not render a dead connect control when configuration is missing", () => {
    render(
      <CalendarConnectionPanel
        connection={{
          ...disconnected,
          mode: "live",
          status: "configuration_required",
          failureMessage: "A local OAuth client ID is required.",
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Connect Google Calendar/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "A local OAuth client ID is required.",
    );
    expect(
      screen.getByRole("button", { name: "Clear local Calendar data" }),
    ).toBeVisible();
  });

  it.each([
    ["stale", "Last validated Calendar context is stale."],
    ["rate_limited", "Google asked Orbit to wait before refreshing."],
  ] as const)(
    "explains the %s health state without hiding read-only authority",
    (status, failureMessage) => {
      render(
        <CalendarConnectionPanel
          connection={{
            ...disconnected,
            mode: "live",
            status,
            eventCount: status === "stale" ? 2 : 0,
            failureMessage,
          }}
        />,
      );

      expect(
        screen.getByText(status === "stale" ? "Stale" : "Rate limited"),
      ).toBeVisible();
      expect(screen.getByRole("status")).toHaveTextContent(failureMessage);
      expect(screen.getByText("Read only")).toBeVisible();
    },
  );

  it("offers an explicit reconnect after authorization is lost", () => {
    render(
      <CalendarConnectionPanel
        connection={{
          ...disconnected,
          mode: "live",
          status: "reauthorization_required",
          failureMessage: "Google Calendar must be connected again.",
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Reconnect Google Calendar" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Clear local Calendar data" }),
    ).toBeVisible();
    expect(screen.queryByText("Read only")).not.toBeInTheDocument();
  });
});
