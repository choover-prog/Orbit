import type { OrbitPresenceState } from "../OrbitPresence.types";

export const presenceMotionDuration: Record<OrbitPresenceState, number> = {
  idle: 8,
  noticing: 3.2,
  listening: 2.8,
  thinking: 3.8,
  speaking: 2.2,
  attention: 3,
  completed: 1.2,
  error: 0,
};

export const presenceSequence: Array<{
  state: OrbitPresenceState;
  duration: number;
}> = [
  { state: "idle", duration: 1600 },
  { state: "noticing", duration: 1300 },
  { state: "listening", duration: 1800 },
  { state: "thinking", duration: 1900 },
  { state: "speaking", duration: 1900 },
  { state: "completed", duration: 1200 },
  { state: "idle", duration: 1000 },
];
