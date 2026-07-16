"use client";

import { useEffect, useRef, useState } from "react";
import {
  OrbitPresence,
  presenceStates,
  presenceVariants,
  usePresencePreference,
  type OrbitPresenceSize,
  type OrbitPresenceState,
  type OrbitPresenceVariant,
} from "@/components/orbit-presence";
import { presenceSequence } from "@/components/orbit-presence/motion/presenceMotion";
import styles from "./PresenceLab.module.css";

const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const variantPersonality: Record<OrbitPresenceVariant, string> = {
  mark: "Graphic and composed — the original Orbit signature, gently awake.",
  pulse: "Warm and receptive — a soft presence that breathes with you.",
  trail:
    "Conversational and expressive — a thought carried along a living path.",
  constellation:
    "Relational and thoughtful — a few signals gathering with purpose.",
  hybrid:
    "Calm, warm, and articulate — breath, orbit, and voice in one identity.",
  ribbon:
    "Fluid and intuitive — a living gesture that unfolds without becoming a ring.",
};

const stateMeaning: Record<OrbitPresenceState, string> = {
  idle: "Available without asking for attention.",
  noticing: "Orienting toward something newly relevant.",
  listening: "Receptive and responding to your voice.",
  thinking: "Forming a deliberate path between context and answer.",
  speaking: "Expressing an answer with the clearest conversational motion.",
  attention: "Holding one important concern in focus.",
  completed: "Settling after a verified result.",
  error: "Pausing calmly because the result needs review.",
};

export function PresenceLab() {
  const [variant, setVariant] = usePresencePreference("hybrid");
  const [state, setState] = useState<OrbitPresenceState>("idle");
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [intensity, setIntensity] = useState(0.6);
  const [speed, setSpeed] = useState(1);
  const [audioLevel, setAudioLevel] = useState(0.35);
  const [size, setSize] = useState<OrbitPresenceSize>("large");
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

  const motionProps = {
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
          <p className="admin-kicker">Development-only presence studio</p>
          <h1>Meet Orbit in motion.</h1>
          <p>
            Compare personality and state clarity before any Presence becomes
            the default.
          </p>
        </div>
      </header>

      <section
        className={styles.heroStudio}
        data-theme={theme}
        aria-labelledby="live-presence-title"
      >
        <div className={styles.heroCopy}>
          <p>{label(variant)} presence</p>
          <h2 id="live-presence-title">{label(state)}</h2>
          <p>{variantPersonality[variant]}</p>
        </div>

        <div className={styles.heroPresenceWrap}>
          <OrbitPresence
            variant={variant}
            state={state}
            size={size}
            className={styles.heroPresence}
            {...motionProps}
          />
        </div>

        <div className={styles.heroState}>
          <p role="status" aria-live="polite">
            {stateMeaning[state]}
          </p>
          <button
            className="button-primary"
            onClick={replaySequence}
            disabled={sequenceRunning}
          >
            {sequenceRunning ? "Playing…" : "Replay sequence"}
          </button>
        </div>

        <div className={styles.modeButtons} aria-label="Preview mode">
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
        </div>
      </section>

      <details className={styles.controls} open>
        <summary>Adjust presence and motion</summary>
        <div className={styles.controlBody}>
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
              />
              Animation
            </label>
            <label className={styles.switchLabel}>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(event) => setReducedMotion(event.target.checked)}
              />
              Simulate reduced motion
            </label>
          </div>
        </div>
      </details>

      {comparison ? (
        <section
          className={styles.comparisonSection}
          aria-labelledby="comparison-title"
        >
          <div className={styles.sectionHeading}>
            <p>Same state, equal scale</p>
            <h2 id="comparison-title">Compare personality</h2>
          </div>
          <div
            className={styles.comparisonGrid}
            data-theme={theme}
            aria-label={`All variants in ${state} state`}
          >
            {presenceVariants.map((value) => (
              <article key={value}>
                <OrbitPresence
                  variant={value}
                  state={state}
                  size="large"
                  {...motionProps}
                />
                <h3>{label(value)}</h3>
                <p>{variantPersonality[value]}</p>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section
          className={styles.contextSection}
          aria-labelledby="context-title"
        >
          <div className={styles.sectionHeading}>
            <p>One identity, three moments</p>
            <h2 id="context-title">Experience Orbit in context</h2>
          </div>
          <div className={styles.contextStack} data-theme={theme}>
            <article className={styles.quietPreview}>
              <div>
                <span>Quiet resting screen</span>
                <h3>Good morning, Maya.</h3>
                <p>Nothing needs your attention.</p>
              </div>
              <OrbitPresence
                variant={variant}
                state="idle"
                size="large"
                {...motionProps}
              />
            </article>
            <article className={styles.attentionPreview}>
              <OrbitPresence
                variant={variant}
                state="attention"
                size="large"
                {...motionProps}
              />
              <div>
                <span>Single-attention screen</span>
                <h3>Your flight and Project Review overlap.</h3>
                <p>One concern, ready whenever you are.</p>
              </div>
            </article>
            <article className={styles.actionPreview}>
              <div>
                <span>Focus conversation screen</span>
                <h3>Move the review to 4:30 PM?</h3>
                <p>Orbit is explaining the proposed change.</p>
                <button className="button-primary">Review change</button>
              </div>
              <OrbitPresence
                variant={variant}
                state="speaking"
                size="large"
                audioLevel={0.6}
                intensity={intensity}
                speed={speed}
                motionEnabled={motionEnabled}
                reducedMotion={reducedMotion}
              />
            </article>
          </div>
        </section>
      )}
    </main>
  );
}
