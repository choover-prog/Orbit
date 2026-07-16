import {
  OrbitPresence,
  type OrbitPresenceState,
  type OrbitPresenceVariant,
} from "@/components/orbit-presence";
import { contextRecords, maya, travelConflict } from "@/mocks/fixtures";
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
      <div className={styles.centerPerson}>
        <OrbitPresence
          variant={variant}
          state={presenceState}
          size="medium"
          motionEnabled={motionEnabled}
        />
        <span className={styles.avatar} aria-label={`${maya.displayName}, you`}>
          {maya.initials}
        </span>
        <p>{maya.displayName}</p>
      </div>

      <div className={styles.signalLine} aria-hidden="true" />
      <div className={styles.focalSignal}>
        <span className={styles.signalDot} aria-hidden="true" />
        <p className={styles.signalLabel}>Needs attention</p>
        <h1 id="attention-title">{travelConflict.title}</h1>
        <div className={styles.factPair} aria-label="Related facts">
          <span>{contextRecords[0].summary}</span>
          <span>{contextRecords[1].summary}</span>
        </div>
        <p className={styles.reason}>{travelConflict.reason}</p>
        <button className="button-primary" onClick={onExplore}>
          Talk it through
        </button>
        <p className={styles.otherThings}>
          There are two other things, when you’re ready.
        </p>
      </div>
    </section>
  );
}
