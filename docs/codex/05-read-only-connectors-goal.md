# Next Codex Goal: Read-Only Connector-Backed MVP

`/goal`

GOAL: Build Orbit's first connector-backed, read-only context slice using weather and Google Calendar while preserving the approved Quiet Orbit experience and deterministic trust boundaries.

## Outcome

Replace the Stage 1 weather and calendar fixtures with provider adapters that can synchronize authorized read-only data, normalize it into Orbit Core contracts, detect the existing travel-versus-meeting attention candidate, explain it with source evidence, and display one focal item in Quiet Orbit. Keep every action path mocked and disabled for real execution.

## Required decisions and gates

1. Threat-model OAuth callbacks, token storage, refresh, revocation, log redaction, and local development before accepting credentials.
2. Record ADRs for the server boundary, encrypted secret storage, sync ownership, and provider error policy.
3. Use least-privilege Google Calendar read-only scopes and a weather provider that does not require exposing a secret to the browser.
4. Keep provider response objects inside adapters; product components consume only the provider-neutral contracts already defined.
5. Preserve explicit fixture mode so contributors and CI can run without credentials.
6. Do not add Gmail, Contacts, Home Assistant, GitHub, authentication, write scopes, background hosting, or production deployment in this goal.

## Implementation slice

- Add server-only connector interfaces and configuration validation.
- Implement weather and Google Calendar read-only adapters.
- Implement bounded synchronization, normalization, freshness, provenance, and health states.
- Map synchronized records into the existing attention-candidate interface.
- Show connected, syncing, stale, unavailable, revoked, and permission-insufficient states in `/connections` without turning `/` into a dashboard.
- Preserve the current mocked scheduling proposal and clearly label it as unavailable for live execution.
- Add redacted audit events for authorization, sync, normalization, and read operations.
- Add contract, fixture, adapter, failure, security, route, accessibility, and end-to-end tests.
- Update architecture, connection, privacy, security, and roadmap documentation.

## Definition of done

The goal is complete when a developer can run fixture mode without secrets, optionally connect authorized test accounts through the approved server boundary, synchronize weather and calendar read-only data, see one evidence-backed focal concern in Quiet Orbit, inspect provenance and freshness, revoke access, and pass security, accessibility, test, type, lint, build, and review gates. No real action execution or write permission is present.
