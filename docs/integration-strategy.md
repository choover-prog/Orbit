# Integration Strategy

## Principle

Orbit coordinates providers; it does not replace them. Integration code is isolated behind versioned adapters so calendar, email, model, workflow, health, and smart-home products can change without redefining Orbit Core.

## Adapter families

### Context adapters

Read authorized provider records, expose synchronization cursors and freshness, translate provider objects into `SourceRecord` and `ContextEvent`, and preserve provider identity for evidence and correction.

### Reasoning adapters

Accept minimized structured inputs and return versioned schemas for summaries, rankings, explanations, intents, or drafts. They have no authority to grant permission or execute capabilities.

### Capability adapters

Advertise supported provider-neutral capabilities, validate provider-specific preconditions, execute idempotently where supported, return receipts, and provide authoritative readback.

### Voice adapters

Handle speech input/output and wake-word preferences separately from Orbit identity. Raw audio retention is opt-in and purpose-limited.

## Initial adapter contract

```text
adapter.describe() -> metadata, supported capabilities, health
adapter.authorize(requestedScopes) -> connection reference
adapter.sync(cursor, scope) -> source records, next cursor
adapter.prepare(capability, parameters) -> provider preconditions
adapter.execute(plan, idempotencyKey) -> provider receipt
adapter.verify(expectedEffect, receipt) -> observed state
adapter.prepareUndo(result) -> undo eligibility and plan
adapter.revoke() -> revocation result
```

The concrete implementation language and transport are intentionally undecided during discovery.

## First-phase providers

| Domain | Discovery behavior | Production decision |
|---|---|---|
| Calendar | Mock events and one reversible reschedule action | Select after provider comparison |
| Email | Mock metadata, thread summaries, and draft-only response | No send action in first slice |
| Contacts | Mock identity resolution | Read-only initially |
| Tasks | Mock task context | Candidate early reversible action |
| Weather | Mock or public non-personal forecast | Low-risk read integration candidate |
| Home Assistant | Optional status mock | Reuse platform; no broad device control |
| Health | Optional summary mock | Platform-specific read-only research required |
| Model provider | Structured mock fixtures, then replaceable adapter | Evaluate privacy, schema reliability, and cost |

## Selection criteria

- consumer-friendly authorization and revocation
- least-privilege scopes
- stable change feeds or synchronization
- authoritative readback and idempotency support
- transparent quotas and error semantics
- privacy, retention, export, and deletion controls
- household and delegated-account behavior
- open standards and maintainable licensing where practical

## Secrets and data

No production credentials belong in the repository. `.env.example` documents names only. Real integrations require encrypted secret storage, rotation, revocation, scope inventory, and logs that redact tokens and private payloads.

## Failure handling

Adapters translate provider failures into typed states: authentication required, permission lost, rate limited, unavailable, conflict, rejected, unknown result, or verification mismatch. Orbit must surface degraded context and never silently reuse stale evidence for consequential actions.

## Anti-goals

- No custom email, calendar, speech, model, workflow, or smart-home platform.
- No provider-specific fields distributed through Orbit Core.
- No broad connector catalog in the first vertical slice.
- No execution merely because a provider supports an API.
