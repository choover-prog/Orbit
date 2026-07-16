"use client";

import type { CSSProperties } from "react";
import styles from "./OrbitPresence.module.css";
import type { OrbitPresenceProps } from "./OrbitPresence.types";
import { presenceLabels } from "./OrbitPresence.types";
import { useReducedMotion } from "./motion/useReducedMotion";
import { OrbitConstellation } from "./variants/OrbitConstellation";
import { OrbitHybrid } from "./variants/OrbitHybrid";
import { OrbitMark } from "./variants/OrbitMark";
import { OrbitPulse } from "./variants/OrbitPulse";
import { OrbitRibbon } from "./variants/OrbitRibbon";
import { OrbitTrail } from "./variants/OrbitTrail";

const variants = {
  mark: OrbitMark,
  pulse: OrbitPulse,
  trail: OrbitTrail,
  constellation: OrbitConstellation,
  hybrid: OrbitHybrid,
  ribbon: OrbitRibbon,
};

interface PresenceStyle extends CSSProperties {
  "--presence-intensity": number;
  "--presence-audio": number;
  "--presence-turn": string;
  "--presence-idle-turn": string;
  "--presence-speaking-turn": string;
  "--presence-breathe": string;
  "--presence-tail-speed": string;
  "--presence-speaking-tail": string;
  "--presence-particle-speed": string;
}

export function OrbitPresence({
  variant = "hybrid",
  state,
  size = "medium",
  intensity = 0.6,
  audioLevel = 0.35,
  speed = 1,
  motionEnabled = true,
  reducedMotion = false,
  className = "",
}: OrbitPresenceProps) {
  const prefersReducedMotion = useReducedMotion(reducedMotion);
  const motion = motionEnabled && !prefersReducedMotion;
  const Variant = variants[variant];
  const speedScale = Math.max(0.35, speed);
  const style: PresenceStyle = {
    "--presence-intensity": Math.max(0, Math.min(1, intensity)),
    "--presence-audio": Math.max(0, Math.min(1, audioLevel)),
    "--presence-turn": `${5.2 / speedScale}s`,
    "--presence-idle-turn": `${10 / speedScale}s`,
    "--presence-speaking-turn": `${2.6 / speedScale}s`,
    "--presence-breathe": `${Math.max(1.4, 3.8 - audioLevel) / speedScale}s`,
    "--presence-tail-speed": `${3.4 / speedScale}s`,
    "--presence-speaking-tail": `${2 / speedScale}s`,
    "--presence-particle-speed": `${3.6 / speedScale}s`,
  };

  return (
    <span
      className={`${styles.presence} ${styles[size]} ${className}`}
      data-variant={variant}
      data-state={state}
      data-motion={motion ? "on" : "off"}
      role="status"
      aria-live={state === "error" || state === "completed" ? "polite" : "off"}
      aria-label={presenceLabels[state]}
      style={style}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <Variant />
      </svg>
    </span>
  );
}
