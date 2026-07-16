"use client";

import { useState } from "react";
import {
  ORBIT_PREFERENCES_STORAGE_KEY,
  orbitPreferenceDefaults,
  type OrbitPreferences,
} from "@/domain/orbit/preferences";
import { useLocalStorageValue } from "@/lib/useLocalStorageValue";

export function SettingsClient() {
  const [preferences, setPreferences] = useLocalStorageValue<OrbitPreferences>(
    ORBIT_PREFERENCES_STORAGE_KEY,
    orbitPreferenceDefaults,
  );
  const [saved, setSaved] = useState("");

  const toggle = (key: keyof OrbitPreferences) => {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setSaved("Saved locally.");
  };

  const rows: Array<[keyof OrbitPreferences, string, string]> = [
    [
      "proactiveAttention",
      "Relevant attention",
      "Allow one eligible concern to enter the daily surface.",
    ],
    [
      "voiceReplies",
      "Spoken replies",
      "Use simulated voice-state behavior; no microphone or speech service is connected.",
    ],
    [
      "motionEnabled",
      "Presence motion",
      "Animate Orbit Presence unless reduced motion is requested by the system.",
    ],
    [
      "conciseReplies",
      "Concise by default",
      "Keep responses short and reveal evidence or options when requested.",
    ],
  ];

  return (
    <div className="admin-list">
      <p role="status" aria-live="polite">
        {saved}
      </p>
      {rows.map(([key, title, description]) => (
        <div className="admin-row" key={key}>
          <h2>{title}</h2>
          <p>{description}</p>
          <button
            className={preferences[key] ? "button-primary" : "button-secondary"}
            type="button"
            role="switch"
            aria-checked={preferences[key]}
            onClick={() => toggle(key)}
          >
            {preferences[key] ? "On" : "Off"}
          </button>
        </div>
      ))}
    </div>
  );
}
