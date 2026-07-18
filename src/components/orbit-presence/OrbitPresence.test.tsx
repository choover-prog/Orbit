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

  it("renders Morph as a raster liquid-metal asset instead of SVG", () => {
    render(
      <OrbitPresence variant="morph" state="attention" motionEnabled={false} />,
    );
    const presence = screen.getByRole("status", {
      name: "Orbit needs your attention",
    });
    expect(presence.querySelector("svg")).not.toBeInTheDocument();
    expect(
      presence.querySelector('[data-renderer="raster-liquid-metal"]'),
    ).toBeInTheDocument();
    expect(
      presence.querySelector(
        'img[src="/presence/morph/stills/attention.webp"]',
      ),
    ).toHaveAttribute("data-active", "true");
  });

  it("plays Morph from frame-loop assets when motion is enabled", () => {
    render(<OrbitPresence variant="morph" state="attention" />);
    const presence = screen.getByRole("status", {
      name: "Orbit needs your attention",
    });
    const asset = presence.querySelector(
      '[data-renderer="raster-liquid-metal"]',
    );
    expect(asset).toHaveAttribute("data-sequence", "attention");
    expect(asset).toHaveAttribute("data-frame-count", "20");
    expect(
      presence.querySelector(
        'img[src^="/presence/morph/frame-loops/attention/attention-"]',
      ),
    ).toHaveAttribute("data-animated", "true");
  });

  it("provides a distinct source-derived Morph sequence for every state", () => {
    for (const state of presenceStates) {
      const { unmount } = render(
        <OrbitPresence variant="morph" state={state} />,
      );
      const presence = screen.getByRole("status");
      const asset = presence.querySelector(
        '[data-renderer="raster-liquid-metal"]',
      );
      expect(asset).toHaveAttribute("data-sequence", state);
      expect(
        presence.querySelector(
          `img[src^="/presence/morph/frame-loops/${state}/${state}-"]`,
        ),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <OrbitPresence variant="hybrid" state="listening" />,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
