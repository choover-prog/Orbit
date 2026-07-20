import {
  OrbitPresence,
  type OrbitPresenceVariant,
} from "@/components/orbit-presence";
import type { AttentionBundle } from "@/domain/orbit/connectors";
import type { ConversationStep } from "@/domain/orbit/types";
import styles from "./QuietOrbit.module.css";
import { SourceAttributionLine } from "./SourceAttributionLine";

interface ConversationSceneProps {
  bundle: AttentionBundle;
  step: ConversationStep;
  onStep: (step: ConversationStep) => void;
  onPropose?: () => void;
  variant: OrbitPresenceVariant;
  motionEnabled: boolean;
}

export function ConversationScene({
  bundle,
  step,
  onStep,
  onPropose,
  variant,
  motionEnabled,
}: ConversationSceneProps) {
  const options = bundle.recommendation?.options ?? [];
  const hasOptions = options.length > 0;
  const canPropose =
    bundle.actionability === "mocked_action" &&
    Boolean(bundle.actionProposal) &&
    Boolean(onPropose);

  return (
    <section
      className={styles.conversationScene}
      aria-labelledby="conversation-title"
    >
      <div className={styles.conversationPresence}>
        <OrbitPresence
          variant={variant}
          state="speaking"
          size="medium"
          intensity={0.7}
          audioLevel={0.52}
          motionEnabled={motionEnabled}
        />
        <span>Orbit is speaking</span>
      </div>
      <p className={styles.eyebrow}>{bundle.label}</p>
      <h1 id="conversation-title">{bundle.item.title}</h1>

      {step === "overview" ? (
        <div className={styles.conversationAnswer}>
          <p>{bundle.item.reason}</p>
          <div className={styles.promptActions}>
            <button
              className="button-secondary"
              onClick={() => onStep("reason")}
            >
              Why does this matter?
            </button>
            <button
              className="button-secondary"
              onClick={() => onStep("evidence")}
            >
              Show the evidence
            </button>
            {hasOptions ? (
              <button
                className="button-primary"
                onClick={() => onStep("options")}
              >
                What are my options?
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === "reason" ? (
        <div className={styles.conversationAnswer}>
          <p className={styles.largeAnswer}>{bundle.explanation}</p>
          <button
            className="button-primary"
            onClick={() => onStep(hasOptions ? "options" : "evidence")}
          >
            {hasOptions ? "Show my options" : "Show the evidence"}
          </button>
        </div>
      ) : null}

      {step === "evidence" ? (
        <div className={styles.evidenceList} aria-label="Supporting evidence">
          {bundle.evidence.map((item) => (
            <article key={item.id}>
              <div>
                <p className={styles.evidenceSource}>{item.sourceLabel}</p>
                <p>{item.summary}</p>
                {item.attribution ? (
                  <SourceAttributionLine
                    attribution={item.attribution}
                    className={styles.attribution}
                  />
                ) : null}
              </div>
              <p className={styles.freshness}>
                {item.freshnessLabel} · {item.epistemicStatus}
              </p>
            </article>
          ))}
          {hasOptions ? (
            <button
              className="button-primary"
              onClick={() => onStep("options")}
            >
              What can I do?
            </button>
          ) : (
            <p className={styles.readOnlyLine}>
              This context is read-only. Orbit has not proposed an action.
            </p>
          )}
        </div>
      ) : null}

      {step === "options" && hasOptions ? (
        <div className={styles.optionsList}>
          <p className={styles.answerLead}>
            {options.length === 1
              ? "One way forward"
              : `${options.length} ways forward`}
          </p>
          {options.map((option, index) => (
            <div className={styles.optionRow} key={option.id}>
              <span>{index + 1}</span>
              <p>{option.label}</p>
              {canPropose && index === 0 ? (
                <button className="button-primary" onClick={onPropose}>
                  Draft this
                </button>
              ) : (
                <button className="button-quiet" type="button">
                  Consider
                </button>
              )}
            </div>
          ))}
          <p className={styles.trustLine}>Nothing changes until you approve.</p>
        </div>
      ) : null}

      {step === "options" && !hasOptions ? (
        <div className={styles.conversationAnswer}>
          <p className={styles.readOnlyLine}>
            This context is read-only. Orbit has not proposed an action.
          </p>
          <button
            className="button-secondary"
            onClick={() => onStep("evidence")}
          >
            Show the evidence
          </button>
        </div>
      ) : null}
    </section>
  );
}
