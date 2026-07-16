import {
  OrbitPresence,
  type OrbitPresenceState,
  type OrbitPresenceVariant,
} from "@/components/orbit-presence";
import { contextRecords, travelConflict } from "@/mocks/fixtures";
import styles from "./QuietOrbit.module.css";

interface CenteredAttentionProps {
  variant: OrbitPresenceVariant;
  presenceState?: OrbitPresenceState;
  motionEnabled?: boolean;
  onExplore: () => void;
}

export function CenteredAttention({
  variant,
  presenceState = "attention",
  motionEnabled = true,
  onExplore,
}: CenteredAttentionProps) {
  return (
    <section
      className={styles.attentionScene}
      aria-labelledby="attention-title"
    >
      <div className={styles.presenceStage}>
        <OrbitPresence
          variant={variant}
          state={presenceState}
          size="large"
          motionEnabled={motionEnabled}
          audioLevel={presenceState === "listening" ? 0.58 : 0.25}
          className={styles.attentionPresence}
        />
        <p className={styles.greeting}>Good morning, Maya</p>
        <p className={styles.presenceCaption}>
          {presenceState === "listening"
            ? "I’m listening"
            : "One thing needs your attention"}
        </p>
      </div>

      <div className={styles.focalSignal}>
        <p className={styles.signalLabel}>Travel conflict</p>
        <h1 id="attention-title">{travelConflict.title}</h1>
        <p className={styles.reason}>{travelConflict.reason}</p>
        <button className="button-primary" onClick={onExplore}>
          Talk it through
        </button>
        <details className={styles.supportingContext}>
          <summary>Why this matters</summary>
          <div className={styles.factPair} aria-label="Related facts">
            <span>{contextRecords[0].summary}</span>
            <span>{contextRecords[1].summary}</span>
          </div>
        </details>
        <p className={styles.otherThings}>
          There are two other things, whenever you’re ready.
        </p>
      </div>
    </section>
  );
}
