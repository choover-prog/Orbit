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

The broader contract remains a roadmap model. Stage 2a implements the public
weather read side. Stage 2b adds authorization, bounded sync, and revocation for
one local Google Calendar read connector. Neither implements prepare, execute,
verify, or undo against a live provider.

## Implemented Google Calendar slice

The local server uses a Google Desktop OAuth client, PKCE S256, loopback
callback, and the `calendar.events.owned.readonly` scope. It stores the refresh
token with Windows DPAPI, keeps access tokens and normalized events in memory,
and reads only a bounded window from the owned primary calendar. Provider
objects and identifiers are minimized before they cross into Orbit Core.

The adapter exposes authorization, health, freshness, rate-limit, completeness,
and disconnect state. Fixture mode performs no Google request. Live Calendar
records can support one deterministic read-only overlap explanation, never the
fictional action adapter.

The local request proxy rejects non-`127.0.0.1` Host headers before rendering
pages, RSC, or APIs. Connect completion and explicit same-origin refresh are the
only Calendar provider-I/O paths; ordinary reads only inspect the in-process
cache.

## Implemented weather sandbox

Open-Meteo is the only live provider in Stage 2a. Fixture mode is the safe default. Live mode is an explicit server setting and calls a fixed HTTPS endpoint for one fixed fictional coarse location. No client input selects the endpoint or coordinates.

The adapter validates the provider payload and maps it into provider-neutral weather records with provenance and a bounded freshness deadline. The snapshot builder aggregates normalized records, derives connection health, and may add at most one deterministic weather attention bundle. A validated cached record may be shown as stale after a provider failure, but stale weather is suppressed from attention. The normalized result is consumed by the home and Connections routes and is available through `GET /api/orbit/snapshot` with no-store caching.

Weather is observe-only. It does not enter the action ladder beyond observation, and no provider data is sent to a model.

## First-phase providers

| Domain         | Discovery behavior                                       | Production decision                            |
| -------------- | -------------------------------------------------------- | ---------------------------------------------- |
| Calendar       | Google primary-calendar read plus separate mock action    | Local-only slice implemented; hosted isolation and writes deferred |
| Email          | Mock metadata, thread summaries, and draft-only response | No send action in first slice                  |
| Contacts       | Mock identity resolution                                 | Read-only initially                            |
| Tasks          | Mock task context                                        | Candidate early reversible action              |
| Weather        | Fixture-default or live Open-Meteo test forecast          | Stage 2a sandbox implemented; production review deferred |
| Home Assistant | Optional status mock                                     | Reuse platform; no broad device control        |
| Health         | Optional summary mock                                    | Platform-specific read-only research required  |
| Model provider | Structured mock behavior only                             | No live model call; evaluate privacy, schema reliability, and cost later |

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

No production credentials belong in the repository. `.env.example` names only
publisher/build configuration keys and contains no values. Open-Meteo needs no
key. A local Calendar qualification build receives its Desktop client metadata
through ignored maintainer configuration; end users never provide it. The
refresh token is DPAPI encrypted outside the repository. A hosted personal
integration still requires managed encrypted storage, rotation, revocation,
authenticated isolation, and redacted logs.

## Failure handling

The weather adapter translates configuration, timeout, rate-limit, provider-unavailable, and invalid-response failures into typed Orbit states. A validated in-memory result may be returned as explicitly stale, but it cannot create a new attention item or support an action. Future personal adapters must additionally handle authentication required, permission lost, conflict, rejected, unknown result, and verification mismatch.

## Anti-goals

- No custom email, calendar, speech, model, workflow, or smart-home platform.
- No provider-specific fields distributed through Orbit Core.
- No broad connector catalog in the first vertical slice.
- No execution merely because a provider supports an API.
- No Codex CLI process or custom agent runtime as Orbit's product backend.
- No Calendar write, background sync, Orbit account authentication, hosted
  deployment, or model-driven connector behavior in Stage 2b.
