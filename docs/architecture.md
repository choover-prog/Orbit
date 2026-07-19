# Orbit Architecture

## Architectural intent

Orbit Core coordinates provider-neutral context, attention, permissions, action state, verification, and audit. Providers supply data, model inference, or execution capabilities through replaceable adapters. Probabilistic output may propose or explain; deterministic systems authorize and change state.

```mermaid
flowchart LR
    P["Context provider adapters"] --> N["Normalization and provenance"]
    N --> G["Personal context graph"]
    G --> A["Attention engine"]
    A --> R["Reasoning provider adapter"]
    R --> V["Schema validation"]
    V --> E["Observations and recommendations"]
    E --> O["Deterministic policy and approval"]
    O --> C["Capability router"]
    C --> X["Execution adapter"]
    X --> K["Provider readback verification"]
    K --> U["Audit and undo metadata"]
```

## Boundaries

### Orbit Core owns

- normalized context and source provenance
- people, household, and relationship rules
- attention scoring inputs and deterministic guardrails
- structured observations, evidence, recommendations, and intents
- capability catalog and permission state
- risk classification and approval policy
- action lifecycle, idempotency, verification, audit, and undo eligibility

### Provider adapters own

- provider authentication and token handling
- translation between provider records and Orbit contracts
- provider capability discovery
- rate-limit, retry, and provider-error translation
- scoped execution and readback

### User experience owns

- onboarding and connection education
- briefings, evidence, follow-up, and corrections
- permission and approval review
- status, verification, history, and undo presentation
- voice input/output and configurable wake-word preferences

## Implemented Stage 2a server boundary

The weather sandbox is the first live context path. Next.js server code selects a fixture or live connector, validates the untrusted provider response, normalizes it, applies freshness and deterministic attention policy, and assembles one serializable `OrbitSnapshot`. Product components never import Open-Meteo response types.

```mermaid
flowchart LR
    B["Browser route"] --> S["Orbit snapshot builder"]
    S --> R["Server connector registry"]
    R --> F["Fixture weather"]
    R --> W["Open-Meteo adapter"]
    F --> N["Normalized SourceRecord contract"]
    W --> V["Validate and normalize"]
    V --> N
    N --> T["Provenance, freshness, and health"]
    T --> A["Deterministic attention gate"]
    A --> O["Provider-neutral OrbitSnapshot"]
    O --> B
```

The home route consumes this boundary directly on the server. `GET /api/orbit/snapshot` exposes the same normalized snapshot with `cache-control: no-store` for local inspection and future trusted consumers. Fixture mode is the default and performs no network request. Live mode calls only Open-Meteo for one fixed fictional coarse test point.

This slice has no reasoning-provider call, OAuth, credential store, authentication, background sync, or write path. A stale weather record remains inspectable but cannot create an attention item.

## First action vertical slice

The action demonstration continues to use fictional adapter data. A calendar change and related email create an observation that a meeting conflicts with travel. Orbit recommends rescheduling, drafts a calendar update plus message, requests approval, executes through a mock adapter, verifies the event state, records the audit trail, and offers undo. The Open-Meteo sandbox does not participate in this action path.

```mermaid
sequenceDiagram
    actor User
    participant UI as Orbit UX
    participant Core as Orbit Core
    participant Model as Reasoning Adapter
    participant Policy as Policy Engine
    participant Mock as Mock Provider

    Mock->>Core: Context records with provenance
    Core->>Core: Normalize and rank candidate signal
    Core->>Model: Structured bounded context
    Model-->>Core: Proposed observation and recommendation
    Core->>Core: Validate schema and evidence references
    Core-->>UI: Briefing item with reason and evidence
    User->>UI: Draft a reschedule
    UI->>Core: Intent
    Core->>Model: Draft request
    Model-->>Core: Proposed action plan
    Core->>Policy: Validated plan plus permission state
    Policy-->>UI: Approval request
    User->>UI: Approve exact plan
    UI->>Core: Approval token
    Core->>Mock: Idempotent execution
    Mock-->>Core: Provider result
    Core->>Mock: Readback
    Mock-->>Core: Current provider state
    Core-->>UI: Verified result and eligible undo
```

## Core components

1. **Connection registry:** adapter instance, user-facing service identity, granted scopes, health, and sync cursor.
2. **Normalization pipeline:** converts source records to typed context events and preserves immutable provenance references.
3. **Context graph:** time-bounded relationships among people, commitments, messages, places, devices, and sources.
4. **Attention engine:** applies deterministic eligibility and safety filters, then ranks candidate concerns using transparent features and optional model assistance.
5. **Reasoning gateway:** sends minimized structured context to a replaceable model adapter and validates returned schemas.
6. **Policy engine:** determines capability availability, risk, required approval, expiry, and prohibited actions.
7. **Capability router:** selects an adapter only after permission and approval checks succeed.
8. **Action coordinator:** enforces immutable plans, idempotency, state transitions, retries, and partial-failure handling.
9. **Verification service:** reads authoritative state from the provider and compares it with the approved expected effect.
10. **Audit service:** records redacted lifecycle events and undo metadata.
11. **Connector registry:** selects the configured server-only context adapter and fails closed on unsupported mode.
12. **Snapshot builder:** combines normalized context, evidence, connection health, and attention bundles into the versioned `OrbitSnapshot` consumed by routes.

## State and trust rules

- Source facts, model inferences, user corrections, and action results are separate record types.
- Model output cannot mutate context, permissions, approval, or execution state directly.
- Every recommendation references evidence IDs and a freshness window.
- Every execution references one unexpired approval for one content-addressed plan.
- Retry uses the same idempotency key and never silently broadens the plan.
- Success means verified provider state, not a successful transport response.
- Undo is a new authorized action, not a database rollback fiction.

## Deployment posture

No production topology is selected. Stage 2a remains a local evaluation sandbox: its only live source is a public Open-Meteo forecast for a fixed fictional location, its cache is process memory, and it has no personal data or credential. Authentication, OAuth, encrypted token storage, durable background synchronization, retention, user isolation, provider service levels, and deployment require explicit decisions before a personal connector is enabled.
