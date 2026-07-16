"use client";

import { useEffect, useRef, useState } from "react";
import {
  OrbitPresence,
  presenceStates,
  presenceVariants,
  usePresencePreference,
  type OrbitPresenceSize,
  type OrbitPresenceState,
} from "@/components/orbit-presence";
import { presenceSequence } from "@/components/orbit-presence/motion/presenceMotion";
import styles from "./PresenceLab.module.css";

const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function PresenceLab() {
  const [variant, setVariant] = usePresencePreference("hybrid");
  const [state, setState] = useState<OrbitPresenceState>("idle");
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [intensity, setIntensity] = useState(0.6);
  const [speed, setSpeed] = useState(1);
  const [audioLevel, setAudioLevel] = useState(0.35);
  const [size, setSize] = useState<OrbitPresenceSize>("medium");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [comparison, setComparison] = useState(false);
  const [sequenceRunning, setSequenceRunning] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const replaySequence = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setSequenceRunning(true);
    let elapsed = 0;
    presenceSequence.forEach((item, index) => {
      const timer = window.setTimeout(() => {
        setState(item.state);
        if (index === presenceSequence.length - 1) setSequenceRunning(false);
      }, elapsed);
      timers.current.push(timer);
      elapsed += item.duration / speed;
    });
  };

  const commonProps = {
    state,
    size,
    intensity,
    audioLevel,
    speed,
    motionEnabled,
    reducedMotion,
  };

  return (
    <main id="main-content" className={styles.lab}>
      <header className={styles.labHeader}>
        <div>
          <p className="admin-kicker">Development-only design lab</p>
          <h1>Orbit Presence</h1>
          <p>
            Compare one living brand mark across the same semantic states. The
            selected variant is saved only in this browser.
          </p>
        </div>
        <div className={styles.modeButtons}>
          <button
            className={comparison ? "button-secondary" : "button-primary"}
            onClick={() => setComparison(false)}
          >
            Context view
          </button>
          <button
            className={comparison ? "button-primary" : "button-secondary"}
            onClick={() => setComparison(true)}
          >
            Compare all
          </button>
          <button
            className="button-secondary"
            onClick={replaySequence}
            disabled={sequenceRunning}
          >
            {sequenceRunning ? "Playing…" : "Replay sequence"}
          </button>
        </div>
      </header>

      <section className={styles.controls} aria-label="Presence controls">
        <fieldset>
          <legend>Variant</legend>
          <div className={styles.segmented}>
            {presenceVariants.map((value) => (
              <button
                key={value}
                aria-pressed={variant === value}
                onClick={() => setVariant(value)}
              >
                {label(value)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>State</legend>
          <div className={styles.segmented}>
            {presenceStates.map((value) => (
              <button
                key={value}
                aria-pressed={state === value}
                onClick={() => setState(value)}
              >
                {label(value)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className={styles.controlGrid}>
          <label>
            Intensity <output>{intensity.toFixed(1)}</output>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={intensity}
              onChange={(event) => setIntensity(Number(event.target.value))}
            />
          </label>
          <label>
            Speed <output>{speed.toFixed(1)}×</output>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
          </label>
          <label>
            Simulated audio <output>{audioLevel.toFixed(2)}</output>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioLevel}
              onChange={(event) => setAudioLevel(Number(event.target.value))}
            />
          </label>
          <label>
            Size
            <select
              value={size}
              onChange={(event) =>
                setSize(event.target.value as OrbitPresenceSize)
              }
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label>
            Preview
            <select
              value={theme}
              onChange={(event) =>
                setTheme(event.target.value as "light" | "dark")
              }
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              checked={motionEnabled}
              onChange={(event) => setMotionEnabled(event.target.checked)}
            />{" "}
            Animation
          </label>
          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />{" "}
            Simulate reduced motion
          </label>
        </div>
      </section>

      <p className={styles.liveState} role="status" aria-live="polite">
        Showing {comparison ? "all variants" : label(variant)} in {label(state)}{" "}
        state.
      </p>

      {comparison ? (
        <section
          className={styles.comparisonGrid}
          data-theme={theme}
          aria-label={`All variants in ${state} state`}
        >
          {presenceVariants.map((value) => (
            <article key={value}>
              <OrbitPresence variant={value} {...commonProps} />
              <h2>{label(value)}</h2>
              <p>{label(state)}</p>
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.contextGrid} data-theme={theme}>
          <article className={styles.quietPreview}>
            <span>Quiet resting screen</span>
            <OrbitPresence variant={variant} {...commonProps} />
            <h2>Good morning, Maya</h2>
            <p>Nothing needs your attention.</p>
          </article>
          <article className={styles.attentionPreview}>
            <span>Single-attention screen</span>
            <OrbitPresence variant={variant} {...commonProps} />
            <h2>Your flight and review overlap.</h2>
            <p>One concern, ready when you are.</p>
          </article>
          <article className={styles.actionPreview}>
            <span>Conversation or action screen</span>
            <OrbitPresence variant={variant} {...commonProps} />
            <h2>Move the review to 4:30 PM?</h2>
            <button className="button-primary">Review change</button>
          </article>
        </section>
      )}
    </main>
  );
}
