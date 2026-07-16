import {
  evidence,
  travelConflict,
  travelRecommendation,
} from "@/mocks/fixtures";
import type { ConversationStep } from "@/domain/orbit/types";
import styles from "./QuietOrbit.module.css";

interface ConversationSceneProps {
  step: ConversationStep;
  onStep: (step: ConversationStep) => void;
  onPropose: () => void;
}

export function ConversationScene({
  step,
  onStep,
  onPropose,
}: ConversationSceneProps) {
  return (
    <section
      className={styles.conversationScene}
      aria-labelledby="conversation-title"
    >
      <p className={styles.eyebrow}>Travel conflict</p>
      <h1 id="conversation-title">Let’s make the conflict workable.</h1>

      {step === "overview" ? (
        <div className={styles.conversationAnswer}>
          <p>{travelConflict.reason}</p>
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
            <button
              className="button-primary"
              onClick={() => onStep("options")}
            >
              What are my options?
            </button>
          </div>
        </div>
      ) : null}

      {step === "reason" ? (
        <div className={styles.conversationAnswer}>
          <p className={styles.largeAnswer}>
            There is only a ten-minute gap. The usual airport-to-office trip
            takes at least 35 minutes.
          </p>
          <button className="button-primary" onClick={() => onStep("options")}>
            Show my options
          </button>
        </div>
      ) : null}

      {step === "evidence" ? (
        <div className={styles.evidenceList} aria-label="Supporting evidence">
          {evidence.map((item) => (
            <article key={item.id}>
              <div>
                <p className={styles.evidenceSource}>{item.sourceLabel}</p>
                <p>{item.summary}</p>
              </div>
              <p className={styles.freshness}>
                {item.freshnessLabel} · {item.epistemicStatus}
              </p>
            </article>
          ))}
          <button className="button-primary" onClick={() => onStep("options")}>
            What can I do?
          </button>
        </div>
      ) : null}

      {step === "options" ? (
        <div className={styles.optionsList}>
          <p className={styles.answerLead}>Three ways forward</p>
          {travelRecommendation.options.map((option, index) => (
            <div className={styles.optionRow} key={option.id}>
              <span>{index + 1}</span>
              <p>{option.label}</p>
              {option.id === "option_move" ? (
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
    </section>
  );
}
