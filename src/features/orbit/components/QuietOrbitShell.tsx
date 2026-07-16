"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  OrbitPresence,
  type OrbitPresenceState,
  usePresencePreference,
} from "@/components/orbit-presence";
import {
  ORBIT_PREFERENCES_STORAGE_KEY,
  orbitPreferenceDefaults,
  type OrbitPreferences,
} from "@/domain/orbit/preferences";
import type {
  ActionAuditRecord,
  ConversationStep,
  OrbitExperienceState,
} from "@/domain/orbit/types";
import { createMockCalendarAdapter } from "@/mocks/calendar-adapter";
import { saveAuditRecord } from "@/mocks/history-store";
import { moveReviewProposal } from "@/mocks/fixtures";
import { useLocalStorageValue } from "@/lib/useLocalStorageValue";
import { ActionScene } from "./ActionScene";
import { CenteredAttention } from "./CenteredAttention";
import { ConversationScene } from "./ConversationScene";
import { OrbitInput } from "./OrbitInput";
import styles from "./QuietOrbit.module.css";

interface QuietOrbitShellProps {
  initialState?: OrbitExperienceState;
}

export function QuietOrbitShell({
  initialState = "attention",
}: QuietOrbitShellProps) {
  const [state, setState] = useState<OrbitExperienceState>(initialState);
  const [conversationStep, setConversationStep] =
    useState<ConversationStep>("overview");
  const [announcement, setAnnouncement] = useState(
    "Orbit has one concern that needs attention.",
  );
  const [auditRecord, setAuditRecord] = useState<ActionAuditRecord | null>(
    null,
  );
  const [presenceOverride, setPresenceOverride] =
    useState<OrbitPresenceState | null>(null);
  const [variant] = usePresencePreference("hybrid");
  const [preferences] = useLocalStorageValue<OrbitPreferences>(
    ORBIT_PREFERENCES_STORAGE_KEY,
    orbitPreferenceDefaults,
  );
  const adapter = useMemo(() => createMockCalendarAdapter(), []);

  const enterConversation = (step: ConversationStep = "overview") => {
    setPresenceOverride(null);
    setConversationStep(step);
    setState("conversation");
    setAnnouncement("Orbit is explaining the travel conflict.");
  };

  const handleQuestion = (question: string) => {
    setPresenceOverride(null);
    const normalized = question.toLowerCase();
    if (normalized.includes("evidence") || normalized.includes("show me"))
      enterConversation("evidence");
    else if (normalized.includes("option") || normalized.includes("what could"))
      enterConversation("options");
    else if (normalized.includes("move") || normalized.includes("reschedule"))
      setState("action");
    else if (normalized.includes("nothing") || normalized.includes("rest"))
      setState("resting");
    else enterConversation("reason");
  };

  const handleListen = () => {
    setPresenceOverride("listening");
    setAnnouncement(
      "Orbit is listening. This prototype uses simulated audio only.",
    );
  };

  const approve = async (forceVerificationFailure = false) => {
    setState("executing");
    setAnnouncement("Orbit is performing the approved mocked change.");
    const now = new Date();
    const approval = {
      id: "approval_move_review",
      proposalId: moveReviewProposal.id,
      planHash: moveReviewProposal.planHash,
      riskClass: "R3" as const,
      permissionLabel: "Update this calendar event once",
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      state: "approved" as const,
    };

    try {
      const record = await adapter.execute(moveReviewProposal, approval, {
        forceVerificationFailure,
      });
      saveAuditRecord(record);
      setAuditRecord(record);
      if (record.verification.status === "verified") {
        setState("completed");
        setAnnouncement(
          "Project Review was updated and verified in the mocked calendar.",
        );
      } else {
        setState("error");
        setAnnouncement(
          "The mocked calendar update could not be verified. No success is claimed.",
        );
      }
    } catch (error) {
      setState("error");
      setAnnouncement(
        error instanceof Error ? error.message : "The mocked action failed.",
      );
    }
  };

  const undo = async () => {
    if (!auditRecord) return;
    try {
      const record = await adapter.undo(auditRecord);
      saveAuditRecord(record);
      setAuditRecord(record);
      setState("undone");
      setAnnouncement(
        "Undo was verified. Project Review is back at 2:30 PM in the mock calendar.",
      );
    } catch (error) {
      setState("error");
      setAnnouncement(
        error instanceof Error ? error.message : "Undo could not be verified.",
      );
    }
  };

  return (
    <main
      id="main-content"
      className={styles.shell}
      data-experience-state={state}
    >
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>

      {state === "resting" ? (
        <section
          className={styles.restingScene}
          aria-labelledby="resting-title"
        >
          <OrbitPresence
            variant={variant}
            state={presenceOverride ?? "idle"}
            size="large"
            motionEnabled={preferences.motionEnabled}
          />
          <p className={styles.greeting}>Good morning, Maya</p>
          <h1 id="resting-title">Nothing needs your attention.</h1>
          <p>Orbit is quiet until something becomes relevant or you ask.</p>
          <button
            className="button-secondary"
            onClick={() => setState("attention")}
          >
            Show the demo concern
          </button>
        </section>
      ) : null}

      {state === "attention" ? (
        <CenteredAttention
          variant={variant}
          presenceState={presenceOverride ?? "attention"}
          motionEnabled={preferences.motionEnabled}
          onExplore={() => enterConversation("overview")}
        />
      ) : null}

      {state === "conversation" ? (
        <ConversationScene
          step={conversationStep}
          onStep={setConversationStep}
          onPropose={() => {
            setState("action");
            setAnnouncement(
              "Orbit has prepared a mocked calendar change for review.",
            );
          }}
        />
      ) : null}

      {state === "action" ? (
        <ActionScene
          onApprove={approve}
          onCancel={() => setState("attention")}
        />
      ) : null}

      {state === "executing" ? (
        <section
          className={styles.resultScene}
          aria-labelledby="executing-title"
        >
          <OrbitPresence
            variant={variant}
            state="thinking"
            size="large"
            motionEnabled={preferences.motionEnabled}
          />
          <p className={styles.eyebrow}>Approved · mock adapter</p>
          <h1 id="executing-title">Updating, then checking the result.</h1>
          <p>
            Orbit does not call this complete until readback matches the
            approved plan.
          </p>
        </section>
      ) : null}

      {state === "completed" ? (
        <section
          className={styles.resultScene}
          aria-labelledby="completed-title"
        >
          <OrbitPresence
            variant={variant}
            state="completed"
            size="large"
            motionEnabled={preferences.motionEnabled}
          />
          <p className={styles.eyebrow}>Verified result</p>
          <h1 id="completed-title">Project Review is now at 4:30 PM.</h1>
          <p>
            The mock calendar readback matches the exact approved plan. Undo is
            available for 20 minutes.
          </p>
          <div className={styles.actionButtons}>
            <button className="button-primary" onClick={undo}>
              Undo mocked change
            </button>
            <Link className="button-secondary" href="/history">
              View action history
            </Link>
          </div>
        </section>
      ) : null}

      {state === "undone" ? (
        <section className={styles.resultScene} aria-labelledby="undone-title">
          <OrbitPresence
            variant={variant}
            state="completed"
            size="large"
            motionEnabled={preferences.motionEnabled}
          />
          <p className={styles.eyebrow}>Undo verified</p>
          <h1 id="undone-title">Project Review is back at 2:30 PM.</h1>
          <p>
            The mock calendar readback confirmed the original time. Previously
            delivered notifications cannot be recalled.
          </p>
          <button
            className="button-secondary"
            onClick={() => setState("resting")}
          >
            Return to quiet
          </button>
        </section>
      ) : null}

      {state === "error" ? (
        <section className={styles.resultScene} aria-labelledby="error-title">
          <OrbitPresence
            variant={variant}
            state="error"
            size="large"
            motionEnabled={preferences.motionEnabled}
          />
          <p className={styles.errorEyebrow}>Verification needs attention</p>
          <h1 id="error-title">
            Orbit could not confirm the calendar changed.
          </h1>
          <p>
            The mock provider accepted the request, but readback still shows
            2:30 PM. Orbit has not reported success or retried.
          </p>
          <div className={styles.actionButtons}>
            <button
              className="button-primary"
              onClick={() => setState("action")}
            >
              Review the proposal
            </button>
            <Link className="button-secondary" href="/history">
              Inspect history
            </Link>
          </div>
        </section>
      ) : null}

      <div className={styles.inputDock}>
        <OrbitInput
          onSubmit={handleQuestion}
          onListen={handleListen}
          disabled={state === "executing"}
        />
        <div className={styles.quietControls} aria-label="Demo state shortcuts">
          <button className="button-quiet" onClick={() => setState("resting")}>
            Quiet state
          </button>
          <button
            className="button-quiet"
            onClick={() => setState("attention")}
          >
            Attention state
          </button>
        </div>
      </div>
    </main>
  );
}
