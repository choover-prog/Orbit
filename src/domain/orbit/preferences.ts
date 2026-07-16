export interface OrbitPreferences {
  proactiveAttention: boolean;
  voiceReplies: boolean;
  motionEnabled: boolean;
  conciseReplies: boolean;
}

export const orbitPreferenceDefaults: OrbitPreferences = {
  proactiveAttention: true,
  voiceReplies: false,
  motionEnabled: true,
  conciseReplies: true,
};

export const ORBIT_PREFERENCES_STORAGE_KEY = "orbit.mock.preferences";
