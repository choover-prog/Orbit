import {
  OrbitPresence,
  type OrbitPresenceState,
  type OrbitPresenceVariant,
} from "@/components/orbit-presence";
import type { AttentionBundle } from "@/domain/orbit/connectors";
import type { PersonReference } from "@/domain/orbit/types";
import styles from "./QuietOrbit.module.css";
import { SourceAttributionLine } from "./SourceAttributionLine";

interface CenteredAttentionProps {
  bundle: AttentionBundle;
  person: PersonReference;
  variant: OrbitPresenceVariant;
  presenceState?: OrbitPresenceState;
  motionEnabled?: boolean;
  onExplore: () => void;
}

export function CenteredAttention({
  bundle,
  person,
  variant,
  presenceState = "attention",
  motionEnabled = true,
  onExplore,
}: CenteredAttentionProps) {
  const relatedFacts = bundle.contextRecords.slice(0, 2);
  const otherEligibleCount = bundle.item.otherEligibleCount;
  const firstName = person.displayName.split(" ")[0] ?? person.displayName;
  const attribution = bundle.evidence.find(
    (evidence) => evidence.attribution,
  )?.attribution;

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
        <p className={styles.greeting}>Good morning, {firstName}</p>
        <p className={styles.presenceCaption}>
          {presenceState === "listening"
            ? "I’m listening"
            : "One thing needs your attention"}
        </p>
      </div>

      <div className={styles.focalSignal}>
        <p className={styles.signalLabel}>{bundle.label}</p>
        <h1 id="attention-title">{bundle.item.title}</h1>
        <p className={styles.reason}>{bundle.item.reason}</p>
        {attribution ? (
          <SourceAttributionLine
            attribution={attribution}
            className={styles.signalAttribution}
          />
        ) : null}
        <button className="button-primary" onClick={onExplore}>
          Talk it through
        </button>
        {relatedFacts.length > 0 ? (
          <details className={styles.supportingContext}>
            <summary>Why this matters</summary>
            <div className={styles.factPair} aria-label="Related facts">
              {relatedFacts.map((record) => (
                <span key={record.id}>{record.summary}</span>
              ))}
            </div>
          </details>
        ) : null}
        {otherEligibleCount > 0 ? (
          <p className={styles.otherThings}>
            {otherEligibleCount === 1
              ? "There is one other thing, whenever you’re ready."
              : `There are ${otherEligibleCount} other things, whenever you’re ready.`}
          </p>
        ) : null}
      </div>
    </section>
  );
}
