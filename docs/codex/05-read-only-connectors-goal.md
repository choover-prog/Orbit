# Connector-Backed MVP Checkpoint

- Original goal: Weather plus Google Calendar read-only context
- Status: Partially superseded on 2026-07-18
- Completed scope: Stage 2a weather sandbox
- Remaining scope: Personal calendar connector and production trust boundary

## Why this goal changed

The original goal combined a public weather feed with OAuth, token storage, revocation, user isolation, synchronization, and real calendar records. Orbit split that work so the server normalization and freshness boundary could be validated without accepting credentials or personal data.

Stage 2a is therefore complete for weather only. The original combined definition of done is not complete and must not be used to imply that Google Calendar or account connection exists.

## Implemented in Stage 2a

- server-only, provider-neutral connector contracts and registry;
- deterministic fixture weather as the default with zero network access;
- live-opt-in Open-Meteo weather for one fixed fictional coarse test location;
- strict response validation, normalized source records, provenance, and typed failures;
- 15-minute in-memory freshness cache with explicitly stale fallback;
- deterministic read-only weather attention with stale evidence suppressed;
- versioned `OrbitSnapshot` consumed by Quiet Orbit and `/connections`;
- no-store `GET /api/orbit/snapshot` inspection route;
- Open-Meteo attribution and transformed-data disclosure;
- adapter, cache, attention, snapshot, route, component, accessibility, and end-to-end tests;
- connector boundary ADR, weather operating notes, and live-context threat model.

The existing fictional flight-versus-meeting scenario remains the default focal concern. Its scheduling proposal, approval, execution, verification, audit, and undo are still mocks.

## Explicitly not implemented

- Google Calendar or any other personal connector;
- OAuth callbacks, authorization scopes, refresh, or revocation;
- credentials, encrypted token storage, or production secrets;
- authentication, accounts, household isolation, or multi-tenancy;
- durable storage or background synchronization;
- Gmail, Contacts, Home Assistant, GitHub, health, or location history;
- provider data in model prompts or live reasoning calls;
- live drafts, writes, action execution, or deployment.

## Remaining connector work

A later approved Stage 2b goal should implement one calendar provider as a separate read-only vertical slice. Before accepting any account credential, it must:

1. select the provider and document exact least-privilege read-only scopes;
2. record decisions for OAuth callback validation, encrypted secret storage, sync ownership, revocation, retention, and provider errors;
3. introduce authenticated user ownership and user-scoped isolation;
4. implement bounded initial and incremental synchronization behind the existing connector interface;
5. normalize provider records without exposing provider SDK objects to Orbit Core or React;
6. preserve provenance, freshness, permission-insufficient, revoked, stale, and unavailable states;
7. combine calendar with separately authorized context through deterministic attention policy;
8. keep every external action disabled and retain fixture mode for contributors and CI;
9. validate callback security, redaction, isolation, accessibility, failure behavior, and offline tests;
10. update the threat model and roadmap before any hosted or friends-and-family trial.

Gmail and broader connector coverage should wait until the calendar slice validates authorization, synchronization, and revocation. Model-assisted reasoning and write capabilities remain later stages.

## Current run mode

Fixture weather is automatic:

```bash
npm run dev
```

Live local evaluation is explicit:

```bash
ORBIT_WEATHER_MODE=live npm run dev
```

The Open-Meteo free endpoint is an evaluation dependency without a production service-level agreement. It uses no API key, receives only the fixed fictional coarse test point, and must be attributed where transformed weather evidence is shown.

## Governing documents

- [ADR: Connector Server Boundary](../adr/ADR-connector-server-boundary.md)
- [Weather connector sandbox](../connectors/weather.md)
- [Live-context threat model](../security/live-context-threat-model.md)
- [Delivery roadmap](../roadmap.md)
