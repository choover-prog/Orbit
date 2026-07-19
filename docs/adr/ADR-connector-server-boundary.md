# ADR: Connector Server Boundary

- Status: Accepted
- Date: 2026-07-18
- Decision owners: Orbit maintainers

## Context

Orbit needs live context without allowing provider-specific APIs, credentials, response objects, or failure semantics to leak into product components. The first live experiment is a read-only weather feed. Later connectors may require OAuth, user-specific synchronization, and separately approved capabilities, but those concerns are not part of this sandbox.

Orbit also needs a durable relationship with reasoning providers. A model or coding agent may help interpret normalized context in a later stage, but it must remain a replaceable provider behind Orbit's trust boundary. The product cannot depend on a developer workstation, a Codex CLI process, or a provider-specific agent session to operate.

## Decision

Orbit owns a thin, server-side, provider-neutral context and action gateway.

For the current read-only slice, the gateway:

1. selects a connector through an explicit server-side registry;
2. reads fixture or live mode from validated server configuration;
3. calls a fixed provider endpoint from server-only code;
4. validates and normalizes the untrusted provider response;
5. assigns provenance, freshness, health, and typed failure state;
6. exposes one serializable `OrbitSnapshot` to application routes and product components.

The browser receives normalized Orbit contracts only. It does not receive provider credentials, raw provider objects, arbitrary provider URLs, or a direct provider client.

The same boundary can later host action preparation, approval verification, execution, readback, and undo. No live action capability is enabled by this decision. The weather experiment is observe-only, and the existing scheduling action remains an explicit mock.

### Runtime ownership

- **Orbit Core owns** normalized context, attention policy, evidence, permissions, approvals, audit, verification, and undo metadata.
- **Connector adapters own** provider transport, response validation, provider error translation, and normalization into Orbit contracts.
- **Product components own** presentation and interaction using provider-neutral data.
- **Reasoning providers own** bounded inference requests only. They never determine permission or acquire execution authority.

### Codex boundary

Do not use Codex CLI as Orbit's product backend. Codex CLI is a developer tool and may be useful for repository work, experiments, or operations, but a workstation process is not a consumer-facing service boundary. Depending on it would couple Orbit to a local session, local credentials, process lifetime, and provider-specific behavior.

Do not build a custom agent runtime for this stage. Orbit's differentiation is context normalization, attention, trust, approval, audit, and user experience. If model-assisted reasoning is added later, it will use a narrow, versioned reasoning adapter through the Orbit gateway. That preserves provider choice without recreating a workflow engine or autonomous-agent platform.

## Boundary rules

- Provider SDKs and response types may be imported only inside their adapter.
- Domain policy and React components must not import provider types.
- Provider payloads must be treated as untrusted input and rejected when required fields are missing or invalid.
- Connector configuration is read on the server and fails closed.
- Fixture mode is the default and must perform no network request.
- Live mode is opt-in and remains read-only.
- The public response shape is versioned and serializable.
- Freshness and provenance travel with evidence; they are not inferred by the UI.
- Stale or unavailable evidence cannot create a new attention candidate or authorize an action.
- Provider failures are translated into stable Orbit error and health states.
- No provider data is sent to a model by this slice.

## Why a thin gateway

A thin gateway gives Orbit a stable product contract without prematurely creating a general-purpose backend platform. It supports server-only credentials and future callbacks while keeping deterministic product policy independent from transport. Fixture and live adapters produce the same normalized contract and then follow the same freshness, policy, and snapshot path, so local development and continuous integration remain representative without external accounts.

## Alternatives considered

### Browser-to-provider integration

Rejected. It would expose configuration and provider details to the client, make request policy harder to constrain, and create an unsafe foundation for future credentials and user-specific records.

### Codex CLI as the bridge

Rejected as a product architecture. It is not a stable, user-scoped connector service and would make application availability depend on a development tool and local machine state.

### A custom agent or workflow runtime

Rejected for this stage. It would duplicate infrastructure before Orbit has validated the context and trust experience. Existing model and workflow providers can remain replaceable adapters if they become necessary.

### Direct provider calls throughout route components

Rejected. It would distribute provider schemas and error behavior across the application and make replacement, testing, and privacy review substantially harder.

## Consequences

- Next.js server components and route handlers provide the initial gateway boundary; a separate service is not required yet.
- The application can demonstrate a live provider while builds, tests, and contributors remain on deterministic fixtures.
- Provider replacement does not require product-component changes as long as the Orbit contract remains stable.
- In-memory cache state is local to one process and is intentionally not a durable synchronization system.
- The local Google Calendar slice now adds OAuth callbacks and DPAPI token
  storage under a separate ADR. Background synchronization, multi-user
  isolation, hosted secret management, and production deployment remain later
  decisions.

## Related documents

- [Integration strategy](../integration-strategy.md)
- [Permissions and trust](../permissions-and-trust.md)
- [Weather connector sandbox](../connectors/weather.md)
- [Live-context threat model](../security/live-context-threat-model.md)
- [Local Google Calendar authorization](ADR-google-calendar-local-auth.md)
