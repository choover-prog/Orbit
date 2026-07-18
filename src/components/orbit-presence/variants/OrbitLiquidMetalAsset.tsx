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

type MorphShape = "attention" | "idle" | "speaking";

interface LiquidAssetStyle extends CSSProperties {
  "--liquid-asset-intensity": number;
  "--liquid-asset-audio": number;
  "--liquid-asset-speed": string;
  "--liquid-frame-fade": string;
}

interface MorphSequence {
  count: number;
  durationMs: number;
  loop: boolean;
  shape: MorphShape;
}

const morphSequences: Record<OrbitPresenceState, MorphSequence> = {
  idle: { count: 14, durationMs: 6400, loop: true, shape: "idle" },
  noticing: {
    count: 18,
    durationMs: 3000,
    loop: true,
    shape: "attention",
  },
  listening: { count: 20, durationMs: 3400, loop: true, shape: "idle" },
  thinking: { count: 22, durationMs: 3000, loop: true, shape: "idle" },
  speaking: {
    count: 24,
    durationMs: 2400,
    loop: true,
    shape: "speaking",
  },
  attention: {
    count: 20,
    durationMs: 3200,
    loop: true,
    shape: "attention",
  },
  completed: { count: 16, durationMs: 1800, loop: false, shape: "idle" },
  error: { count: 14, durationMs: 5200, loop: true, shape: "idle" },
};

const sequenceFrames = (state: OrbitPresenceState, count: number) =>
  Array.from(
    { length: count },
    (_, index) =>
      `/presence/morph/frame-loops/${state}/${state}-${String(index).padStart(2, "0")}.webp`,
  );

function useMorphFrameIndex(
  state: OrbitPresenceState,
  sequence: MorphSequence,
  speed: number,
  motionEnabled: boolean,
) {
  const [playback, setPlayback] = useState({ state, frameIndex: 0 });

  useEffect(() => {
    if (!motionEnabled || sequence.count <= 1) return;

    const frameMs = Math.max(
      76,
      sequence.durationMs / Math.max(0.35, speed) / sequence.count,
    );
    const interval = window.setInterval(() => {
      setPlayback((current) => {
        const currentFrame = current.state === state ? current.frameIndex : 0;
        const frameIndex = sequence.loop
          ? (currentFrame + 1) % sequence.count
          : Math.min(sequence.count - 1, currentFrame + 1);
        return { state, frameIndex };
      });
    }, frameMs);

    return () => window.clearInterval(interval);
  }, [motionEnabled, sequence, speed, state]);

  return playback.state === state ? playback.frameIndex : 0;
}

export function OrbitLiquidMetalAsset({
  state,
  intensity,
  audioLevel,
  speed,
  motionEnabled,
}: OrbitLiquidMetalAssetProps) {
  const safeSpeed = Math.max(0.35, speed);
  const activeSequence = morphSequences[state];
  const frames = sequenceFrames(state, activeSequence.count);
  const frameIndex = useMorphFrameIndex(
    state,
    activeSequence,
    safeSpeed,
    motionEnabled,
  );
  const frameMs = activeSequence.durationMs / safeSpeed / activeSequence.count;
  const style: LiquidAssetStyle = {
    "--liquid-asset-intensity": Math.max(0, Math.min(1, intensity)),
    "--liquid-asset-audio": Math.max(0, Math.min(1, audioLevel)),
    "--liquid-asset-speed": `${safeSpeed}`,
    "--liquid-frame-fade": `${Math.round(Math.min(210, Math.max(68, frameMs * 0.78)))}ms`,
  };

  return (
    <span
      className="liquid-metal-asset"
      data-renderer="raster-liquid-metal"
      data-material="source-derived-mesh"
      data-state={state}
      data-sequence={state}
      data-frame-count={activeSequence.count}
      data-frame-index={motionEnabled ? frameIndex : "static"}
      data-motion={motionEnabled ? "on" : "off"}
      style={style}
      aria-hidden="true"
    >
      <span className="liquid-metal-stack" data-shape={activeSequence.shape}>
        {motionEnabled ? (
          <>
            <img
              src={`/presence/morph/stills/${state}.webp`}
              alt=""
              data-frame={state}
              data-fallback="true"
              data-active="false"
              data-animated="false"
              draggable={false}
              decoding="sync"
              fetchPriority="high"
            />
            {frames.map((src, index) => (
              <img
                key={src}
                src={src}
                alt=""
                data-frame={state}
                data-active={index === frameIndex ? "true" : "false"}
                data-animated="true"
                draggable={false}
                decoding="async"
                loading={index < 3 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
              />
            ))}
          </>
        ) : (
          <img
            src={`/presence/morph/stills/${state}.webp`}
            alt=""
            data-frame={state}
            data-active="true"
            data-animated="false"
            draggable={false}
            decoding="async"
            fetchPriority="high"
          />
        )}
      </span>
    </span>
  );
}
