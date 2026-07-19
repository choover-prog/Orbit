# Orbit Delivery Roadmap

## Stage 1 — Quiet Orbit Frontend Foundation

**Implemented now.**

- Quiet Orbit daily shell and centered-person attention composition
- Focus-style progressive conversation and evidence
- Provider-neutral TypeScript contracts
- Fictional flight and meeting conflict
- Mock approval, execution, verification, audit, error, and undo
- History, connections, settings, and development Presence Lab routes
- Five Presence variants and eight shared states
- Responsive, keyboard, screen-reader, and reduced-motion behavior
- Automated unit, component, route, accessibility-smoke, and end-to-end test coverage, with live in-app browser validation

This is not a production system. Stage 1 scheduling data and execution remain mocked, and history and preferences are browser-local. The optional public weather sandbox is documented separately in Stage 2a below.

## Stage 2 — Connector-Backed Read-Only Context

**Stage 2a weather sandbox implemented; personal connectors remain deferred.**

Stage 2a proves the smallest server-side context path:

- fixture-default and live-opt-in Open-Meteo weather modes;
- a fixed fictional coarse test location with no browser geolocation or credential;
- provider response validation and normalization into a versioned `OrbitSnapshot`;
- provenance, 15-minute freshness, connection health, and stale fallback;
- deterministic weather attention with stale evidence suppressed;
- `GET /api/orbit/snapshot` plus Quiet Orbit and Connections integration;
- provider attribution and explicit evaluation-only limitations.

The fictional flight-versus-meeting scenario and calendar execution remain mocked. Stage 2a adds no OAuth, authentication, secret storage, background synchronization, model call, production database, or write capability.

Stage 2b is a later, separately approved goal: select one calendar provider, threat-model and implement least-privilege OAuth, encrypted connection storage, revocation, user-scoped synchronization, and authenticated isolation. Gmail, contacts, Home Assistant, GitHub, and other read-only adapters follow only after the calendar slice validates the boundary.

Target loop for personal connectors: connect -> synchronize -> normalize -> detect one attention candidate -> explain with evidence.

## Stage 3 — Draft and Approval Actions

**Mocked in Stage 1; real execution deferred.**

Add private drafts first. Later introduce a tightly scoped reversible calendar capability through immutable plans, explicit approval, idempotent execution, authoritative readback, audit, and qualified undo.

## Stage 4 — Voice and Ambient Operation

**Deferred until voice work.**

Microphone permission, streaming audio, speech-to-text, interruption, text-to-speech, wake-word strategy, room/device context, and real voice-driven Presence state require separate privacy, safety, and accessibility work.

## Stage 5 — Friends-and-Family Alpha

**Deferred until personal usage validates value.**

Managed authentication, encrypted connection storage, hosted background synchronization, notifications, consented telemetry, account deletion, export, and invited users require an alpha-readiness review. Billing, commercial multi-tenancy, public deployment, and hardware remain out of scope.
