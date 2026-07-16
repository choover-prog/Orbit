export type OrbitPresenceVariant =
  "mark" | "pulse" | "trail" | "constellation" | "hybrid" | "ribbon";

export type OrbitPresenceState =
  | "idle"
  | "noticing"
  | "listening"
  | "thinking"
  | "speaking"
  | "attention"
  | "completed"
  | "error";

export type OrbitPresenceSize = "small" | "medium" | "large";

export interface OrbitPresenceProps {
  variant?: OrbitPresenceVariant;
  state: OrbitPresenceState;
  size?: OrbitPresenceSize;
  intensity?: number;
  audioLevel?: number;
  speed?: number;
  motionEnabled?: boolean;
  reducedMotion?: boolean;
  className?: string;
}

export const presenceLabels: Record<OrbitPresenceState, string> = {
  idle: "Orbit is ready",
  noticing: "Orbit noticed something relevant",
  listening: "Orbit is listening",
  thinking: "Orbit is thinking",
  speaking: "Orbit is speaking",
  attention: "Orbit needs your attention",
  completed: "Orbit completed the action",
  error: "Orbit encountered a problem",
};

export const presenceVariants: OrbitPresenceVariant[] = [
  "mark",
  "pulse",
  "trail",
  "constellation",
  "hybrid",
  "ribbon",
];

export const presenceStates: OrbitPresenceState[] = [
  "idle",
  "noticing",
  "listening",
  "thinking",
  "speaking",
  "attention",
  "completed",
  "error",
];
