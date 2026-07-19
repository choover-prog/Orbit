"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  OrbitPresence,
  type OrbitPresenceState,
  usePresencePreference,
} from "@/components/orbit-presence";
import type { AttentionBundle, OrbitSnapshot } from "@/domain/orbit/connectors";
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
import { useLocalStorageValue } from "@/lib/useLocalStorageValue";
import { createMockCalendarAdapter } from "@/mocks/calendar-adapter";
import { saveAuditRecord } from "@/mocks/history-store";
import { ActionScene } from "./ActionScene";
import { CenteredAttention } from "./CenteredAttention";
import { ConversationScene } from "./ConversationScene";
import { OrbitInput } from "./OrbitInput";
import styles from "./QuietOrbit.module.css";

interface QuietOrbitShellProps {
  snapshot: OrbitSnapshot;
  initialState?: OrbitExperienceState;
}

const ACTION_STATES = new Set<OrbitExperienceState>([
  "action",
  "executing",
  "completed",
  "error",
  "undone",
]);

function selectedAttention(snapshot: OrbitSnapshot) {
  if (!snapshot.selectedAttentionId) return null;
  return (
    snapshot.attention.find(
      (bundle) => bundle.id === snapshot.selectedAttentionId,
    ) ?? null
  );
}

function supportsMockedAction(bundle: AttentionBundle | null) {
  return (
    bundle?.actionability === "mocked_action" &&
    bundle.actionProposal !== undefined
  );
}

function safeInitialState(
  requested: OrbitExperienceState,
  bundle: AttentionBundle | null,
) {
  if (!bundle) return "resting";
  if (!supportsMockedAction(bundle) && ACTION_STATES.has(requested)) {
    return "attention";
  }
  return requested;
}

function weatherTrustMessage(snapshot: OrbitSnapshot) {
  if (snapshot.weather.status === "fresh") {
    return "The current modeled forecast crosses no Orbit attention threshold.";
  }
  if (snapshot.weather.status === "stale") {
    return "The weather forecast is stale, so Orbit suppressed it from attention.";
  }

  const reason = snapshot.weather.failure?.message;
  return reason
    ? "No weather concern was inferred. " + reason
    : "No weather concern was inferred because weather context is unavailable.";
}

function quietTrustMessage(snapshot: OrbitSnapshot) {
  if (snapshot.requestedContext !== "calendar") {
    return weatherTrustMessage(snapshot);
  }

  switch (snapshot.calendar.status) {
    case "disconnected":
      return "Google Calendar is not connected, so Orbit has no personal Calendar context.";
    case "configuration_required":
    case "storage_unavailable":
      return (
        snapshot.calendar.failure?.message ?? "Calendar setup is incomplete."
      );
    case "reauthorization_required":
      return "Google Calendar needs to be reconnected before Orbit can read it.";
    case "stale":
      return "Calendar context is stale, so Orbit suppressed it from attention.";
    case "rate_limited":
    case "unavailable":
      return "Calendar context is temporarily unavailable, so Orbit stayed quiet.";
    case "connected":
    case "syncing":
      return "Calendar context is not ready yet.";
    case "fresh":
      return snapshot.calendar.complete
        ? "No overlapping events were found in the bounded Calendar window."
        : "The Calendar read was incomplete, so Orbit suppressed it from attention.";
  }
}

export function QuietOrbitShell({
  snapshot,
  initialState = "attention",
}: QuietOrbitShellProps) {
  const bundle = selectedAttention(snapshot);
  const canAct = supportsMockedAction(bundle);
  const firstName =
    snapshot.person.displayName.split(" ")[0] ?? snapshot.person.displayName;
  const [state, setState] = useState<OrbitExperienceState>(() =>
    safeInitialState(initialState, bundle),
  );
  const [conversationStep, setConversationStep] =
    useState<ConversationStep>("overview");
  const [announcement, setAnnouncement] = useState(
    bundle
      ? "Orbit has one concern that needs attention."
      : "Nothing needs your attention.",
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
    if (!bundle) {
      setState("resting");
      setAnnouncement("Nothing needs your attention.");
      return;
    }
    setConversationStep(step);
    setState("conversation");
    setAnnouncement("Orbit is explaining " + bundle.label.toLowerCase() + ".");
  };

  const requestAction = () => {
    if (!canAct) {
      enterConversation("reason");
      setAnnouncement(
        "This context is read-only. Orbit has not proposed an action.",
      );
      return;
    }
    setState("action");
    setAnnouncement("Orbit has prepared a mocked calendar change for review.");
  };

  const handleQuestion = (question: string) => {
    setPresenceOverride(null);
    if (!bundle) {
      setState("resting");
      setAnnouncement("Nothing needs your attention.");
      return;
    }

    const normalized = question.toLowerCase();
    if (normalized.includes("evidence") || normalized.includes("show me")) {
      enterConversation("evidence");
    } else if (
      normalized.includes("option") ||
      normalized.includes("what could")
    ) {
      if (bundle.recommendation?.options.length) {
        enterConversation("options");
      } else {
        enterConversation("reason");
        setAnnouncement(
          "This context is read-only. Orbit has not proposed an action.",
        );
      }
    } else if (
      normalized.includes("move") ||
      normalized.includes("reschedule")
    ) {
      requestAction();
    } else if (normalized.includes("nothing") || normalized.includes("rest")) {
      setState("resting");
    } else {
      enterConversation("reason");
    }
  };

  const handleListen = () => {
    setPresenceOverride("listening");
    setAnnouncement(
      "Orbit is listening. This prototype uses simulated audio only.",
    );
  };

  const approve = async (forceVerificationFailure = false) => {
    const proposal =
      bundle?.actionability === "mocked_action"
        ? bundle.actionProposal
        : undefined;
    if (!proposal) {
      setState(bundle ? "attention" : "resting");
      setAnnouncement(
        "This context is read-only. Orbit has not proposed an action.",
      );
      return;
    }

    setState("executing");
    setAnnouncement("Orbit is performing the approved mocked change.");
    const now = new Date();
    const approval = {
      id: "approval_" + proposal.id,
      proposalId: proposal.id,
      planHash: proposal.planHash,
      riskClass: "R3" as const,
      permissionLabel: "Update this calendar event once",
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      state: "approved" as const,
    };

    try {
      const record = await adapter.execute(proposal, approval, {
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
            className={styles.heroPresence}
          />
          <p className={styles.greeting}>Good morning, {firstName}</p>
          <h1 id="resting-title">Nothing needs your attention.</h1>
          <p>Orbit is quiet until something becomes relevant or you ask.</p>
          {!bundle ? (
            <p className={styles.trustLine}>{quietTrustMessage(snapshot)}</p>
          ) : null}
          {bundle ? (
            <button
              className="button-secondary"
              onClick={() => setState("attention")}
            >
              Show the demo concern
            </button>
          ) : null}
        </section>
      ) : null}

      {state === "attention" && bundle ? (
        <CenteredAttention
          bundle={bundle}
          person={snapshot.person}
          variant={variant}
          presenceState={presenceOverride ?? "attention"}
          motionEnabled={preferences.motionEnabled}
          onExplore={() => enterConversation("overview")}
        />
      ) : null}

      {state === "conversation" && bundle ? (
        <ConversationScene
          bundle={bundle}
          step={conversationStep}
          variant={variant}
          motionEnabled={preferences.motionEnabled}
          onStep={setConversationStep}
          onPropose={canAct ? requestAction : undefined}
        />
      ) : null}

      {state === "action" &&
      bundle?.actionability === "mocked_action" &&
      bundle.actionProposal ? (
        <ActionScene
          proposal={bundle.actionProposal}
          evidence={bundle.evidence}
          variant={variant}
          motionEnabled={preferences.motionEnabled}
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
            onClick={() => setState(bundle ? "attention" : "resting")}
            disabled={!bundle}
          >
            Attention state
          </button>
        </div>
      </div>
    </main>
  );
}
