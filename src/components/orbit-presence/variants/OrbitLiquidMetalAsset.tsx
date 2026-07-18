"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
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

const sequenceFrames = (id: "attention" | "idle" | "speaking", count: number) =>
  Array.from(
    { length: count },
    (_, index) =>
      `/presence/morph/frame-loops/${id}/${id}-${String(index).padStart(2, "0")}.webp`,
  );

const morphSequences: Record<
  "attention" | "idle" | "speaking",
  {
    durationMs: number;
    frames: string[];
    still: string;
  }
> = {
  idle: {
    durationMs: 5600,
    frames: sequenceFrames("idle", 8),
    still: "/presence/morph/idle.png",
  },
  attention: {
    durationMs: 3200,
    frames: sequenceFrames("attention", 10),
    still: "/presence/morph/attention.png",
  },
  speaking: {
    durationMs: 2400,
    frames: sequenceFrames("speaking", 10),
    still: "/presence/morph/speaking.png",
  },
};

function useMorphFrameIndex(
  frameCount: number,
  durationMs: number,
  speed: number,
  motionEnabled: boolean,
) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!motionEnabled || frameCount <= 1) return;

    const frameMs = Math.max(
      80,
      durationMs / Math.max(0.35, speed) / frameCount,
    );
    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frameCount);
    }, frameMs);

    return () => window.clearInterval(interval);
  }, [durationMs, frameCount, motionEnabled, speed]);

  return frameIndex % Math.max(1, frameCount);
}

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
  const activeSequence = morphSequences[activeFrame];
  const frameIndex = useMorphFrameIndex(
    activeSequence.frames.length,
    activeSequence.durationMs,
    safeSpeed,
    motionEnabled,
  );
  const currentSrc = motionEnabled
    ? activeSequence.frames[frameIndex]
    : activeSequence.still;

  useEffect(() => {
    if (!motionEnabled) return;

    activeSequence.frames.forEach((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    });
  }, [activeSequence.frames, motionEnabled]);

  return (
    <span
      className="liquid-metal-asset"
      data-renderer="raster-liquid-metal"
      data-state={state}
      data-sequence={activeFrame}
      data-frame-count={activeSequence.frames.length}
      data-frame-index={motionEnabled ? frameIndex : "static"}
      data-motion={motionEnabled ? "on" : "off"}
      style={style}
      aria-hidden="true"
    >
      <img
        src={currentSrc}
        alt=""
        data-frame={activeFrame}
        data-active="true"
        data-animated={motionEnabled ? "true" : "false"}
        draggable={false}
        decoding="async"
        fetchPriority="high"
      />
    </span>
  );
}
