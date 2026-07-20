import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HomeContextSnapshot } from "@/domain/orbit/connectors";
import { createGoogleNestFixtureSource } from "@/server/connectors/google-nest/fixture";
import { GoogleNestConnectionPanel } from "./GoogleNestConnectionPanel";

async function connected(): Promise<HomeContextSnapshot> {
  const result = await createGoogleNestFixtureSource().sync(
    new Date("2026-07-19T12:00:00Z"),
  );
  if (!result.ok) throw new Error();
  return {
    status: "fresh",
    authorization: "connected",
    mode: "fixture",
    records: result.batch.records,
    complete: true,
    structureCount: 1,
    roomCount: 1,
    deviceCount: 3,
    supportedDeviceCount: 2,
    unsupportedDeviceCount: 1,
    audit: [],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("GoogleNestConnectionPanel", () => {
  it("explains stream and control boundaries before connection", () => {
    render(
      <GoogleNestConnectionPanel
        snapshot={{
          status: "disconnected",
          authorization: "disconnected",
          mode: "fixture",
          records: [],
          complete: true,
          structureCount: 0,
          roomCount: 0,
          deviceCount: 0,
          supportedDeviceCount: 0,
          unsupportedDeviceCount: 0,
          audit: [],
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Connect fictional Nest home" }),
    ).toBeVisible();
    expect(
      screen.getByText(/does not record, persist, analyze/i),
    ).toBeVisible();
    expect(screen.getByText(/approval plan/i)).toBeVisible();
  });

  it("requires camera confirmation and shows a temporary fixture preview", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path.endsWith("/streams/start"))
          return Response.json({
            session: {
              fixture: true,
              sessionId: "session",
              expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            },
          });
        return new Response(null, { status: 204 });
      }),
    );
    render(<GoogleNestConnectionPanel snapshot={await connected()} />);
    await user.click(screen.getByRole("button", { name: "View live video" }));
    expect(
      screen.getByRole("dialog", { name: /View Front door camera live/i }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Start live video" }));
    expect(
      await screen.findByRole("img", {
        name: "Fictional camera stream preview",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Stop video" }));
    expect(
      screen.queryByRole("img", { name: "Fictional camera stream preview" }),
    ).not.toBeInTheDocument();
  });

  it("shows an immutable plan before approving a thermostat change", async () => {
    const user = userEvent.setup();
    const plan = {
      id: "plan",
      deviceId: "nest-device-thermostat",
      capability: "thermostat.set_mode",
      summary: "Set Hall thermostat to cool.",
      expectedEffect: "Mode becomes cool.",
      previousState: "Mode was heat.",
      planHash: "a".repeat(64),
      expiresAt: "2026-07-19T12:05:00Z",
      reversible: true,
      parameters: { mode: "cool" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/actions/plan")
          ? Response.json({ plan })
          : Response.json({
              result: {
                planId: "plan",
                state: "verified",
                completedAt: "2026-07-19T12:01:00Z",
                observedState: "Mode becomes cool.",
              },
            }),
      ),
    );
    render(<GoogleNestConnectionPanel snapshot={await connected()} />);
    await user.click(screen.getByRole("button", { name: "Set cool" }));
    expect(
      await screen.findByRole("dialog", {
        name: "Approve this device change?",
      }),
    ).toHaveTextContent("Mode was heat");
    await user.click(screen.getByRole("button", { name: "Approve change" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Verified");
  });
});
