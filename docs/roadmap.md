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

This is not a production system. Data, execution, history, and preferences are mocked or browser-local.

## Stage 2 — Connector-Backed Read-Only Context

**Prepared through contracts; deferred until a separate goal.**

Start with weather and one calendar provider, then evaluate Gmail, contacts, Home Assistant, and GitHub read-only adapters. Implement provider-hosted OAuth, encrypted token storage, incremental synchronization, normalization, freshness, revocation, and connector-health reporting only after a threat model and deployment posture are approved.

Loop: connect → synchronize → normalize → detect one attention candidate → explain with evidence.

## Stage 3 — Draft and Approval Actions

**Mocked in Stage 1; real execution deferred.**

Add private drafts first. Later introduce a tightly scoped reversible calendar capability through immutable plans, explicit approval, idempotent execution, authoritative readback, audit, and qualified undo.

## Stage 4 — Voice and Ambient Operation

**Deferred until voice work.**

Microphone permission, streaming audio, speech-to-text, interruption, text-to-speech, wake-word strategy, room/device context, and real voice-driven Presence state require separate privacy, safety, and accessibility work.

## Stage 5 — Friends-and-Family Alpha

**Deferred until personal usage validates value.**

Managed authentication, encrypted connection storage, hosted background synchronization, notifications, consented telemetry, account deletion, export, and invited users require an alpha-readiness review. Billing, commercial multi-tenancy, public deployment, and hardware remain out of scope.
