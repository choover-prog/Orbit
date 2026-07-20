# Permissions and Trust

## Trust promise

Orbit should be useful before it can act. Users should always be able to answer: what Orbit accessed, what it inferred, what it recommends, what it can do, what it did, whether it worked, and how to stop or reverse it.

## Capability model

Permission is granted to a provider-neutral capability, a resource scope, and a mode—not to “the AI” in general.

Example: “Read calendar event titles and times for the next 30 days” is distinct from “Create or update calendar events.” Connecting a provider never implies write permission.

## Risk classes

| Class                          | Examples                                                 | Default policy                                                               |
| ------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| R0 Observe                     | Read weather, list connected-service status              | Allowed within granted read scope                                            |
| R1 Summarize                   | Create a private briefing from authorized facts          | Allowed; show sources and corrections                                        |
| R2 Draft                       | Draft a private message or proposed event change         | Allowed; no external side effect                                             |
| R3 Reversible action           | Create a task, change a private event                    | Explicit approval for exact plan; verify and offer undo                      |
| R4 Consequential action        | Message another person, change shared home state         | Strong confirmation, current evidence, recipient/effect review, verification |
| R5 Prohibited in initial scope | Purchase, diagnose, unlock access, irreversible deletion | Blocked regardless of model recommendation                                   |

Risk may increase based on recipients, shared resources, health context, money, location, security, timing, or missing evidence.

## Implemented Stage 2a boundary

The Open-Meteo sandbox is an R0 Observe capability with no personal grant because it reads a public forecast for one server-owned fictional coarse location. Fixture mode is the default; live mode is an explicit development setting. Neither mode requests browser geolocation, stores a credential, authorizes an account, calls a model, or exposes a write capability.

Weather evidence includes source, modeled status, observed time, freshness, and Open-Meteo attribution when live. Stale weather cannot create an attention item. The interface exposes degraded and misconfigured states instead of presenting unavailable data as current.

The Calendar proposal, approval, execution, verification, audit, and undo
journey remains a fictional mock. Its approval UI demonstrates the intended
trust contract but grants no live authority.

Stage 2b separately authorizes one R0 Observe capability: read minimal event
timing from the owned primary Google Calendar for a bounded window. The
connection disclosure states purpose, fields, local encrypted credential
storage, and deletion. Stale or incomplete reads cannot produce attention.
Disconnect deletes local credentials and context before best-effort remote
revocation. No write scope, proposal, approval, or action route is present.

## Approval invariants

- Approval binds to the exact content-addressed `ActionPlan`.
- Changes to recipients, content, time, target, provider, or side effects invalidate approval.
- Approval expires and cannot be reused for another plan.
- The interface states who or what will be affected and whether undo is available.
- Silence, continued conversation, or model confidence never counts as approval.
- Voice approval for higher-risk actions requires a clear readback and may require a second factor.

## Execution and verification

1. Re-check permission, plan hash, approval, expiry, adapter health, and preconditions.
2. Execute once using an idempotency key.
3. Record the provider receipt without claiming success.
4. Read authoritative state from the provider.
5. Compare observed state with approved expected effects.
6. Report verified, failed, partial, or unknown state in plain language.
7. Produce an `UndoPlan` only when the compensating effect is understood.

## Audit

Every lifecycle transition records actor, object reference, event type, timestamp, policy decision, and redacted metadata. Audit views should be understandable to users and diagnostically useful without duplicating private content unnecessarily.

## Undo

Undo is a new capability-checked, potentially approval-requiring action. It must state limitations such as notifications already sent, elapsed time, downstream changes, or non-reversible effects. “Undo available” must never be shown from optimistic assumption alone.

## Health boundaries

- Health data is optional and independently scoped.
- Orbit may summarize authorized records and relate them to scheduling or environmental context.
- Orbit must not diagnose, invent clinical meaning, or present model inference as medical fact.
- Concerning information should encourage appropriate professional or emergency help without pretending Orbit assessed the user medically.

## User controls

- See each connected service, granted capability, purpose, last sync, and current health.
- Reduce access without deleting the entire account.
- Pause synchronization or proactive suggestions.
- Correct an inference and prevent repeated use where appropriate.
- Revoke a connection and request scoped deletion.
- Review action, approval, verification, and undo history.

## Threats to address before real integrations

The weather sandbox addresses its risks in the [live-context threat model](security/live-context-threat-model.md). The local personal Calendar connector addresses OAuth, token-vault, provider-data, disconnect, and read-only escalation risks in the [Google Calendar threat model](security/google-calendar-threat-model.md). Hosted cross-user disclosure, broader prompt injection, replayed approvals, partial write failure, malicious voice commands, sensitive audit leakage, and unsafe execution retries still require explicit controls before production deployment or write credentials.
