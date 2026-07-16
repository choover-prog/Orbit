import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "jest-axe";
import { PresenceLab } from "./PresenceLab";

describe("PresenceLab", () => {
  beforeEach(() => window.localStorage.clear());

  it("prioritizes a large semantic preview and compares all variants", async () => {
    const user = userEvent.setup();
    render(<PresenceLab />);

    expect(
      screen.getByRole("heading", { name: "Meet Orbit in motion." }),
    ).toBeInTheDocument();
    const hero = screen.getByRole("region", { name: "Idle" });
    expect(
      within(hero).getByRole("status", { name: "Orbit is ready" }),
    ).toHaveAttribute("data-variant", "hybrid");

    await user.click(screen.getByRole("button", { name: "Speaking" }));
    await user.click(screen.getByRole("button", { name: "Compare all" }));

    const comparison = screen.getByRole("region", {
      name: "Compare personality",
    });
    expect(comparison.querySelectorAll("article")).toHaveLength(5);
    expect(
      screen.getAllByRole("status", { name: "Orbit is speaking" }),
    ).toHaveLength(6);
  });

  it("keeps the studio controls accessible", async () => {
    const { container } = render(<PresenceLab />);
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
