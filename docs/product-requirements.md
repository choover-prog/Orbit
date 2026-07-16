# Orbit Product Requirements

## Product definition

Orbit is a consumer orchestration layer that turns authorized personal context into a small number of useful, explainable observations and safely assists with approved actions. It is not a chatbot, connector marketplace, workflow builder, or model provider.

## Target users

The initial user is an adult who already relies on email, calendar, contacts, tasks, and a smartphone; feels the cost of fragmented life administration; is interested in AI value but unwilling to configure infrastructure; and wants convenience without surrendering control.

Secondary participants may include household members whose shared calendars, home state, or plans affect the primary user. Their data and permissions remain independently scoped.

## Jobs to be done

1. When my day changes, help me notice the few changes that matter before they become problems.
2. When Orbit recommends something, show the evidence and explain the reasoning in plain language.
3. When an action could affect another person, money, health, security, or an external system, let me review exactly what will happen.
4. When I approve an action, verify the real outcome and help me recover if it fails or can be undone.
5. When I connect a service, make the access requested understandable without technical setup.
6. When I speak, let me ask short follow-up questions without forcing me into a chat-centric workflow.

## User problems

- Important messages are buried and calendar changes surface too late.
- Commitments and follow-ups are distributed across disconnected apps.
- Existing assistant setups require APIs, credentials, or workflow configuration.
- Broad access requests create anxiety because benefit, retention, and action authority are unclear.
- Chat-first products wait for the user to know what to ask.
- Automation demos often omit failure handling, verification, and recovery.

## Product principles

- Consumer first: ordinary onboarding, plain language, and progressive disclosure.
- Calm by default: show no concern unless it is currently relevant; expand one concern at a time.
- Provider neutral: provider contracts never define Orbit Core.
- Privacy first: purpose limitation, data minimization, clear retention, and scoped deletion.
- Read before write: useful observation precedes action permission.
- Explain recommendations: preserve evidence and expose the reason.
- Deterministic control: models cannot grant authority or bypass policy.
- Approval for consequence: confirmation describes the concrete effect.
- Verify and recover: execution is incomplete until checked; offer undo where possible.

## Initial functional requirements

### Onboarding and connections

- Explain Orbit's value before requesting access.
- Connect calendar, email, contacts, tasks, and weather through provider-hosted authorization.
- Offer Home Assistant and health as optional context domains.
- Present requested capabilities, purpose, retention, and revocation in consumer language.
- Default every connection to the minimum read-only capability set.

### Daily attention

- Present one focal concern when an eligible item requires attention; otherwise remain in a sparse resting state.
- State that other concerns exist without exposing them until requested.
- Show what changed and why it matters; reveal freshness, confidence, and evidence when decision-relevant or requested.
- Allow dismiss, snooze, correction, and follow-up by voice or text.
- Separate facts from model-generated interpretation.

### Recommendations and actions

- Represent recommendations separately from proposed actions.
- Generate a structured draft before requesting permission.
- Classify action risk deterministically.
- Require fresh approval when the target, content, side effects, or relevant evidence changes.
- Execute the approved immutable plan through a mock adapter during the initial slice.
- Verify against the provider and record the outcome.
- Offer undo only when eligibility and consequences are known.

### Trust and history

- Show connected services, active capabilities, last synchronization, and failures.
- Provide searchable human-readable action history.
- Let users revoke a connection, reduce capabilities, and request scoped deletion.
- Never frame health observations as diagnosis or unsupported medical fact.

## Non-functional requirements

- Accessibility target: WCAG 2.2 AA for implemented user interfaces.
- Clear keyboard and screen-reader paths for approvals and evidence.
- Structured schemas validate all model output crossing into deterministic systems.
- Provider adapters are replaceable and least-privileged.
- Audit records are append-only at the application boundary and redact sensitive payloads by default.
- Fictional data is mandatory in repository examples and visual concepts.

## Success criteria for the first validated prototype

- At least 80% of moderated participants can explain Orbit's role and read-only default after onboarding without assistance.
- At least 80% correctly identify whether a shown action will execute immediately or awaits approval.
- At least 90% can find why an attention item appeared and which sources support it.
- At least 90% can revoke a capability or locate action history.
- Median time to understand the focal concern is under one minute.
- No simulated consequential action executes without the required approval state.
- Every simulated execution produces a verification and audit record.

These are discovery targets, not claims of achieved performance.

## Initial scope

Included: onboarding, mocked provider connections, normalized read-only context, resting and single-concern attention states, conversational follow-up, one drafted scheduling action, approval, mock execution, verification, audit, and conditional undo.

Excluded: broad connector coverage, production credentials, autonomous purchasing, diagnosis, autonomous communication, custom models, workflow engines, smart-home platforms, hardware, commercial multi-tenancy, and production deployment.

## Open questions

- Which calendar and email providers should anchor the first real read-only integration?
- What retention defaults best balance usefulness, correction, auditability, and minimization?
- How should household participants grant and revoke visibility independently?
- Which actions are never eligible for one-tap approval or undo?
