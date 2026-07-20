import {
  OrbitPresence,
  type OrbitPresenceVariant,
} from "@/components/orbit-presence";
import type { ActionProposal, SourceEvidence } from "@/domain/orbit/types";
import styles from "./QuietOrbit.module.css";

interface ActionSceneProps {
  proposal: ActionProposal;
  evidence: SourceEvidence[];
  onApprove: (forceFailure?: boolean) => void;
  onCancel: () => void;
  variant: OrbitPresenceVariant;
  motionEnabled: boolean;
}

function proposalTitle(summary: string) {
  return `${summary.replace(/\s+from\s+.+?\s+to\s+/i, " to ")}?`;
}

export function ActionScene({
  proposal,
  evidence,
  onApprove,
  onCancel,
  variant,
  motionEnabled,
}: ActionSceneProps) {
  return (
    <section className={styles.actionScene} aria-labelledby="action-title">
      <div className={styles.conversationPresence}>
        <OrbitPresence
          variant={variant}
          state="noticing"
          size="medium"
          motionEnabled={motionEnabled}
        />
        <span>Orbit prepared a change</span>
      </div>
      <p className={styles.eyebrow}>
        Approval required · {proposal.reversible ? "reversible " : ""}
        calendar action
      </p>
      <h1 id="action-title">{proposalTitle(proposal.summary)}</h1>
      <p className={styles.actionSummary}>
        Orbit will update one shared calendar event after your approval. This
        demo does not contact a real provider.
      </p>

      <dl className={styles.actionDetails}>
        <div>
          <dt>Current</dt>
          <dd>{proposal.previousValue}</dd>
        </div>
        <div>
          <dt>Proposed</dt>
          <dd>{proposal.nextValue}</dd>
        </div>
        <div>
          <dt>Affects</dt>
          <dd>
            {proposal.affectedPeople
              .map((person) => person.displayName)
              .join(", ")}
          </dd>
        </div>
        <div>
          <dt>Permission</dt>
          <dd>Update this calendar event once</dd>
        </div>
        <div>
          <dt>Expected effect</dt>
          <dd>{proposal.expectedEffect}</dd>
        </div>
        <div>
          <dt>Undo</dt>
          <dd>
            Restore the previous value for 20 minutes; notifications cannot be
            recalled
          </dd>
        </div>
      </dl>

      <details className={styles.actionEvidence}>
        <summary>Review evidence · {evidence.length} sources</summary>
        {evidence.map((item) => (
          <p key={item.id}>
            <strong>{item.sourceLabel}:</strong> {item.summary}
          </p>
        ))}
      </details>

      <div className={styles.actionButtons}>
        <button className="button-primary" onClick={() => onApprove(false)}>
          Approve mocked change
        </button>
        <button className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <button className="button-quiet" onClick={() => onApprove(true)}>
        Simulate a verification problem
      </button>
    </section>
  );
}
