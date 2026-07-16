import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "jest-axe";
import { OrbitPresence } from "./OrbitPresence";
import { presenceStates, presenceVariants } from "./OrbitPresence.types";

describe("OrbitPresence", () => {
  it("supports every variant and semantic state", () => {
    for (const variant of presenceVariants) {
      for (const state of presenceStates) {
        const { unmount } = render(
          <OrbitPresence
            variant={variant}
            state={state}
            motionEnabled={false}
          />,
        );
        expect(screen.getByRole("status")).toHaveAttribute(
          "data-variant",
          variant,
        );
        expect(screen.getByRole("status")).toHaveAttribute("data-state", state);
        unmount();
      }
    }
  });

  it("provides a static reduced-motion representation", () => {
    render(<OrbitPresence variant="trail" state="speaking" reducedMotion />);
    expect(
      screen.getByRole("status", { name: "Orbit is speaking" }),
    ).toHaveAttribute("data-motion", "off");
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <OrbitPresence variant="hybrid" state="listening" />,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
