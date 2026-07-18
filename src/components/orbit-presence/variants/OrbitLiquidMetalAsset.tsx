"use client";

/* eslint-disable @next/next/no-img-element */

import type { CSSProperties } from "react";
import type { OrbitPresenceState } from "../OrbitPresence.types";

interface OrbitLiquidMetalAssetProps {
  state: OrbitPresenceState;
  intensity: number;
  audioLevel: number;
  speed: number;
  motionEnabled: boolean;
}

interface LiquidAssetStyle extends CSSProperties {
  "--liquid-asset-intensity": number;
  "--liquid-asset-audio": number;
  "--liquid-asset-speed": string;
}

const morphFrameByState: Record<
  OrbitPresenceState,
  "attention" | "idle" | "speaking"
> = {
  idle: "idle",
  noticing: "attention",
  listening: "idle",
  thinking: "idle",
  speaking: "speaking",
  attention: "attention",
  completed: "idle",
  error: "idle",
};

const morphFrames = [
  {
    id: "idle",
    src: "/presence/morph/idle.png",
  },
  {
    id: "attention",
    src: "/presence/morph/attention.png",
  },
  {
    id: "speaking",
    src: "/presence/morph/speaking.png",
  },
] as const;

export function OrbitLiquidMetalAsset({
  state,
  intensity,
  audioLevel,
  speed,
  motionEnabled,
}: OrbitLiquidMetalAssetProps) {
  const safeSpeed = Math.max(0.35, speed);
  const style: LiquidAssetStyle = {
    "--liquid-asset-intensity": Math.max(0, Math.min(1, intensity)),
    "--liquid-asset-audio": Math.max(0, Math.min(1, audioLevel)),
    "--liquid-asset-speed": `${safeSpeed}`,
  };
  const activeFrame = morphFrameByState[state];

  return (
    <span
      className="liquid-metal-asset"
      data-renderer="raster-liquid-metal"
      data-state={state}
      data-motion={motionEnabled ? "on" : "off"}
      style={style}
      aria-hidden="true"
    >
      {morphFrames.map((frame) => (
        <img
          key={frame.id}
          src={frame.src}
          alt=""
          data-frame={frame.id}
          data-active={frame.id === activeFrame ? "true" : "false"}
          draggable={false}
          decoding="async"
          fetchPriority={frame.id === activeFrame ? "high" : "auto"}
        />
      ))}
    </span>
  );
}
