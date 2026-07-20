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

## Stage 2 — Connector-Backed Context

**Stage 2a weather, Stage 2b Calendar, and the local Gmail slice are implemented. Stage 2c Google Nest is in fixture qualification.**

Stage 2a proves the smallest server-side context path:

- fixture-default and live-opt-in Open-Meteo weather modes;
- a fixed fictional coarse test location with no browser geolocation or credential;
- provider response validation and normalization into a versioned `OrbitSnapshot`;
- provenance, 15-minute freshness, connection health, and stale fallback;
- deterministic weather attention with stale evidence suppressed;
- `GET /api/orbit/snapshot` plus Quiet Orbit and Connections integration;
- provider attribution and explicit evaluation-only limitations.

Stage 2b proves the first authenticated personal connector on one local Windows
account:

- explicit Google Calendar onboarding and disconnect;
- a server-owned Desktop authorization-code flow with S256 PKCE;
- the owned-primary-events read-only scope;
- a Windows DPAPI refresh-token vault and deletion;
- a bounded fourteen-day primary-calendar read with rate-limit and freshness
  state;
- minimal provider-neutral event records and opaque provider references;
- at most one deterministic, read-only overlap concern;
- no Calendar write, model call, autonomous action, hosted deployment, or
  multi-user authentication.

The fictional flight-versus-meeting execution remains a separate mock. Calendar
and Gmail have independently qualified local OAuth/vault boundaries and bounded
read-only context.

Stage 2c adds shared provider-neutral home contracts and a Google Nest Device
Access adapter. Useful home behavior includes explicitly requested temporary
WebRTC video and narrowly allowlisted thermostat/fan commands. Every control is
an immutable plan with explicit approval, one execution, provider readback,
verification, audit, and a separately approved undo plan when possible. Fixture
qualification precedes the private supported-device live checkpoint. Broader
native Google Home coverage and Home Assistant remain later adapters to the same
Orbit Core contracts.

Stage 2d Device Atlas now has a qualified fixture and compiled Android harness. It adds a provider-neutral
multi-source device identity model, deterministic control-path scoring,
event-first monitoring plans, a versioned local companion bridge boundary, and
an isolated Android app. Consent state, bounded read-only normalization,
Keystore pseudonyms, canonical payload encoding, and device-bound signing are
implemented. Google Home, Govee, Matter, and selected local-service observations
remain fictional. Automation is draft-and-simulate only. Authenticated SDK
download/app registration, physical-device consent, pinned bridge transport, real Govee
authorization, broad network access, background monitoring, and device command
execution remain qualification gates.

Target read loop: connect -> synchronize -> normalize -> detect one attention
candidate -> explain with evidence.

Target home action loop: fresh state -> plan -> approve -> execute -> verify ->
audit -> offer undo.

## Stage 3 — Draft and Approval Actions

**Mocked in Stage 1; real execution deferred.**

Add private drafts first. Later introduce a tightly scoped reversible calendar capability through immutable plans, explicit approval, idempotent execution, authoritative readback, audit, and qualified undo.

## Stage 4 — Voice and Ambient Operation

**Deferred until voice work.**

Microphone permission, streaming audio, speech-to-text, interruption, text-to-speech, wake-word strategy, room/device context, and real voice-driven Presence state require separate privacy, safety, and accessibility work.

## Stage 5 — Friends-and-Family Alpha

**Deferred until personal usage validates value.**

Managed authentication, hosted encrypted connection storage, background synchronization, notifications, consented telemetry, account deletion, export, and invited users require an alpha-readiness review. The local Calendar DPAPI vault does not satisfy those hosted requirements. Billing, commercial multi-tenancy, public deployment, and hardware remain out of scope.
