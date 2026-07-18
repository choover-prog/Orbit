import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { UtilityMenu } from "./UtilityMenu";

describe("UtilityMenu", () => {
  it("opens from the keyboard without making utility navigation persistent", async () => {
    const user = userEvent.setup();
    render(<UtilityMenu showPresenceLab />);
    const trigger = screen.getByRole("button", { name: "Menu" });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    trigger.focus();
    await user.keyboard("{Enter}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /Presence Lab/ })).toBeVisible();
  });
});
