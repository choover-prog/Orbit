import type { OrbitExperienceState } from "./types";

const validExperienceStates: OrbitExperienceState[] = [
  "resting",
  "attention",
  "conversation",
  "action",
  "executing",
  "completed",
  "error",
  "undone",
];

export function parseExperienceState(value?: string): OrbitExperienceState {
  return validExperienceStates.includes(value as OrbitExperienceState)
    ? (value as OrbitExperienceState)
    : "attention";
}
