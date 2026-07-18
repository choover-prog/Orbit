import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "jest-axe";
import { QuietOrbitShell } from "./QuietOrbitShell";

describe("QuietOrbitShell", () => {
  beforeEach(() => window.localStorage.clear());

  it("moves from attention through progressive disclosure to verified completion and undo", async () => {
    const user = userEvent.setup();
    render(<QuietOrbitShell initialState="attention" />);

    expect(
      screen.getByRole("heading", { name: /flight lands ten minutes/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Talk it through" }));
    await user.click(
      screen.getByRole("button", { name: "What are my options?" }),
    );
    await user.click(screen.getByRole("button", { name: "Draft this" }));
    expect(
      screen.getByRole("heading", { name: /Move Project Review to 4:30 PM/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Approve mocked change" }),
    );
    expect(
      await screen.findByRole("heading", { name: /now at 4:30 PM/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Undo mocked change" }),
    );
    expect(
      await screen.findByRole("heading", { name: /back at 2:30 PM/i }),
    ).toBeInTheDocument();
  });

  it("shows a calm error when verification fails", async () => {
    const user = userEvent.setup();
    render(<QuietOrbitShell initialState="action" />);
    await user.click(
      screen.getByRole("button", { name: "Simulate a verification problem" }),
    );
    expect(
      await screen.findByRole("heading", { name: /could not confirm/i }),
    ).toBeInTheDocument();
  });

  it("keeps the resting state accessible", async () => {
    const { container } = render(<QuietOrbitShell initialState="resting" />);
    expect(
      screen.getByRole("heading", { name: "Nothing needs your attention." }),
    ).toBeInTheDocument();
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("applies the saved motion preference and exposes simulated listening", async () => {
    window.localStorage.setItem(
      "orbit.mock.preferences",
      JSON.stringify({
        proactiveAttention: true,
        voiceReplies: false,
        motionEnabled: false,
        conciseReplies: true,
      }),
    );
    const user = userEvent.setup();
    render(<QuietOrbitShell initialState="attention" />);

    expect(
      screen.getByRole("status", { name: "Orbit needs your attention" }),
    ).toHaveAttribute("data-motion", "off");

    await user.click(screen.getByRole("button", { name: "Listen" }));
    expect(
      screen.getByRole("status", { name: "Orbit is listening" }),
    ).toHaveAttribute("data-motion", "off");
  });
});
