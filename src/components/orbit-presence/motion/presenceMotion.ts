import type { OrbitPresenceState } from "../OrbitPresence.types";

export const presenceMotionDuration: Record<OrbitPresenceState, number> = {
  idle: 9,
  noticing: 2.8,
  listening: 3.2,
  thinking: 5.2,
  speaking: 2.6,
  attention: 3.4,
  completed: 1.2,
  error: 0,
};

export const presenceSequence: Array<{
  state: OrbitPresenceState;
  duration: number;
}> = [
  { state: "idle", duration: 1800 },
  { state: "noticing", duration: 1400 },
  { state: "listening", duration: 2100 },
  { state: "thinking", duration: 2400 },
  { state: "speaking", duration: 2200 },
  { state: "completed", duration: 1300 },
  { state: "idle", duration: 1000 },
];
