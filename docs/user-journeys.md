# Orbit User Journeys

All examples use fictional people and records.

## Journey 1: Understand and connect

**User:** Maya, a busy parent who uses email, calendar, contacts, and tasks but has never configured automation.

**Goal:** Receive useful help without granting broad action authority.

1. Maya sees Orbit's promise: three important changes, explained, with her approval before action.
2. Orbit asks her to connect calendar first and explains the requested read access, purpose, retention, and revocation.
3. Provider-hosted authorization completes without exposing credentials to Orbit's interface.
4. Email, contacts, tasks, and weather are offered one at a time; Home and Health are visibly optional.
5. Orbit confirms read-only mode and shows where permissions can be changed.

**Acceptance criteria**

- Maya can describe what Orbit can and cannot do.
- No write capability is granted implicitly.
- Skipping an optional service does not block core onboarding.
- Connection status and revocation are discoverable from the confirmation screen.

## Journey 2: Respond to one relevant concern

**Goal:** Understand the day in under two minutes.

1. Orbit is resting with only a greeting and input until one concern passes the attention threshold.
2. A fictional flight conflict enters focus as the only concern on screen.
3. Maya asks “Why does that matter?” to reveal the flight and calendar records, their source, and freshness.
4. Orbit quietly states that two other things are available when she is ready but does not display them.
5. Maya says “What else?” only after resolving or deferring the travel conflict.

**Acceptance criteria**

- The concern distinguishes source fact from Orbit inference.
- Evidence and freshness are available without leaving the item.
- Correction, snooze, and dismiss are accessible by keyboard and screen reader.
- The default attention state contains exactly one focal concern.

## Journey 3: Ask a follow-up and draft an action

**Goal:** Resolve the fictional travel conflict without manually coordinating several apps.

1. Maya asks, “What could I move?” by voice or text.
2. Orbit explains two alternatives based on calendar availability and the email thread.
3. Maya chooses the project review and asks Orbit to draft a change.
4. Orbit produces a private draft: new time, affected attendees, calendar edit, and proposed message.
5. Nothing external changes while she edits the draft.

**Acceptance criteria**

- The intent and constraints are shown in structured form.
- Drafting does not require write permission or produce a side effect.
- Unsupported assumptions are labeled and can be corrected.
- The draft identifies all recipients and expected provider changes.

## Journey 4: Approve, execute, and verify

**Goal:** Make the reviewed change safely.

1. Orbit detects that changing a shared event and notifying attendees is consequential.
2. It requests the necessary scoped capability and displays the exact immutable plan.
3. Maya confirms after reviewing time, recipients, message, and undo limitations.
4. A mock calendar adapter executes the approved plan with an idempotency key.
5. Orbit reads the event back, compares it with the expected effect, and reports verified success.
6. History shows the evidence, plan, approval, execution, and verification without exposing unnecessary message content.

**Acceptance criteria**

- Execution is impossible without valid permission and approval for the exact plan hash.
- Changed content invalidates approval.
- A provider receipt alone is not reported as success.
- Verification and audit records are created for success, failure, partial, and unknown outcomes.

## Journey 5: Undo or recover

**Goal:** Reverse a reversible effect or understand a failure.

1. Orbit shows “Undo available for 20 minutes” only after preparing a valid compensating plan.
2. Maya reviews what undo can restore and what it cannot retract, such as a notification already delivered.
3. Undo follows the same permission, approval, execution, and verification controls.
4. If verification fails, Orbit reports the provider's current state and recommends a bounded recovery step rather than retrying blindly.

**Acceptance criteria**

- Undo is never described as guaranteed when downstream effects remain.
- Retrying cannot duplicate the original action.
- Unknown or partial state is visible and auditable.
- Manual recovery instructions avoid technical provider jargon.

## Journey 6: Inspect and reduce access

**Goal:** Stay in control after onboarding.

1. Maya opens Connected services.
2. Each service shows capabilities, purpose, last synchronization, and health.
3. She removes calendar write access while retaining read-only attention and conversation features.
4. Orbit explains which features stop working and confirms revocation.
5. She requests deletion of stored normalized email context while preserving redacted security audit records required by policy.

**Acceptance criteria**

- Capabilities can be reduced independently.
- Consequences are explained before revocation or deletion.
- UI state matches provider and Orbit state after verification.
- Household data is not exposed through another member's permission screen.

## Journey 7: Health context without diagnosis

**Goal:** Relate optional wellness context to the day without medical overreach.

1. Maya opts into a read-only sleep summary.
2. Orbit observes that the authorized source reports less sleep than Maya's recent baseline and that her first meeting moved earlier.
3. Orbit suggests considering a lighter morning plan, labels the source data and inference, and offers to draft a private task change.
4. It does not diagnose, claim impairment, or change a health plan.

**Acceptance criteria**

- Health access is separately consented and revocable.
- Source fact and inference are visibly distinct.
- No diagnostic or prescriptive medical language appears.
- Health context cannot silently increase action authority.
