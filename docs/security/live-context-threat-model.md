# Live-Context Threat Model

- Status: Required controls for the weather sandbox
- Scope: Read-only Open-Meteo context in local fixture and live modes
- Last reviewed: 2026-07-18

## Security objective

The first live connector must prove that Orbit can ingest untrusted external context without exposing a user, expanding authority, or making stale and malformed data look trustworthy. A successful request is not permission to act. The sandbox remains useful when the provider is slow, unavailable, rate limited, or returns an unexpected response.

## Scope and assumptions

The protected system is the local Orbit application, its provider-neutral records, and the trust signals shown to the user. The live experiment uses one fixed fictional coarse location, has no user accounts, and has no production secrets.

In scope:

- browser requests to Orbit;
- the Next.js server boundary;
- outbound forecast requests to the fixed Open-Meteo origin;
- response validation and normalization;
- in-memory caching, freshness, health, and attention selection;
- normalized data returned to the browser.

Out of scope and prohibited in this slice:

- OAuth callbacks, authorization codes, refresh tokens, or token storage;
- browser geolocation or user-entered coordinates;
- real calendar, email, contacts, health, home, or file data;
- real write actions or action endpoints;
- background synchronization and hosted multi-user operation;
- sending provider data to an LLM or other reasoning service.

## Trust boundaries

```text
Browser
  -> Orbit route/server component
    -> connector registry and validated configuration
      -> fixed Open-Meteo HTTPS endpoint
    <- untrusted provider response
  <- normalized OrbitSnapshot with provenance and freshness
```

The provider response is untrusted even when transport succeeds. The normalization boundary is where external values become eligible for Orbit policy; malformed data never crosses it as valid context.

## Threats and required controls

| Threat | Failure mode | Required controls |
| ------ | ------------ | ----------------- |
| Server-side request forgery | A request parameter redirects the server to an attacker-controlled or internal address. | Keep the HTTPS origin and path as source constants; construct only allowlisted query parameters; accept neither URLs nor coordinates from the browser; do not follow provider-supplied links. |
| Unbounded outbound work | Slow or oversized responses and retries exhaust server capacity. | Apply a four-second abort timeout, a 128 KiB streamed-response cap, a bounded forecast horizon, no foreground retry loop, and a single fixed cache key. Translate timeout and invalid size to typed health states. |
| Malformed or adversarial schema | Missing, oversized, non-finite, or structurally invalid values reach product policy. | Perform runtime validation before normalization; reject invalid required fields; bound arrays and forecast horizon; map unknown codes to `Unrecognized conditions`; never cast a raw response directly to a domain type. |
| Sensitive logging | Raw responses, personal values, coordinates, headers, or provider errors leak into logs. | Log only connector identifier, typed outcome, timestamps, and safe aggregate timing. Do not log response bodies, request headers, raw URLs, tokens, or normalized personal records. Do not surface provider response text to the browser. |
| Location disclosure | Browser geolocation, IP-derived location, or precise coordinates reveal where a person is. | Use only the server-owned fictional label and fixed coarse test point; expose no location input; call no geolocation API; retain no location history. A future personal-location feature requires a separate consent and retention design. |
| Stale-data misuse | Old weather is presented as current or drives a recommendation. | Attach `observedAt`, `retrievedAt`, and `staleAfter`; determine freshness on the server; visibly mark stale evidence; prevent stale or unavailable data from creating attention or supporting actions. |
| Rate-limit amplification | Repeated browser loads cause unnecessary provider requests or retry storms. | Cache validated success for at most 15 minutes and never beyond 30 minutes after its modeled observation time; use one fixed request key; perform no automatic foreground retry; map HTTP 429 to a typed rate-limited state and respect provider guidance before any later retry mechanism. |
| Provider outage or no SLA | A free evaluation service becomes unavailable or changes behavior. | Fail closed, retain only validated stale fallback, expose degraded health, keep fixture mode functional, and avoid production availability claims. |
| Cache poisoning | An invalid result becomes the stale fallback used by later requests. | Write to cache only after complete schema validation and normalization; never replace a valid cache entry with an error or partial result. |
| Cross-request data mixing | One user's location or context is returned to another request. | The sandbox has no personal inputs and only one fixed public test key. Before user-specific connectors, require authenticated ownership, user-scoped cache keys, and isolation tests. |
| Prompt injection through provider data | Text returned by a provider alters model instructions or tool behavior. | Make no model call in this slice; normalize enumerated weather fields; do not include provider text or payloads in prompts. Future reasoning adapters must minimize and delimit structured inputs and treat them as data. |
| Confused-deputy action | A read response or attention item triggers an external change. | Expose no write connector or execution endpoint; keep weather capability at observe-only; do not convert attention into approval; preserve deterministic permission and action-ladder checks for future work. |
| Client authority escalation | A query parameter switches providers, changes location, or enables a capability. | Read connector mode and fixed provider configuration on the server; validate against a closed enum; ignore unsupported client values; return normalized data only. |
| Attribution loss | Transformed data is shown without source or freshness, reducing user trust and violating licence expectations. | Preserve source attribution with the normalized evidence and render it near weather values; state that data was transformed; retain observed and retrieved times. |

## Failure-state policy

The adapter translates failures into a small, stable set of Orbit codes rather than passing provider details through the boundary:

- `configuration_required`
- `timeout`
- `rate_limited`
- `provider_unavailable`
- `invalid_response`

Failure messages must be calm and actionable. An error must not masquerade as an empty forecast, and unavailable data must not silently fall back to a fresh appearance.

## Data lifecycle

1. The server constructs a request for the fixed coarse test point.
2. The provider response is held in memory while it is validated.
3. Valid values are normalized into the provider-neutral source and evidence records.
4. Only validated normalized output may enter the in-memory cache.
5. A current result expires from fresh status after 15 minutes or 30 minutes after its modeled observation time, whichever comes first.
6. A validated older result may be displayed as stale after a provider failure, but cannot produce attention or action authority.
7. Process termination removes the cache. Raw responses are not written to disk, logs, analytics, or audit history.

## Validation requirements

Automated tests must demonstrate:

- fixture mode performs zero network requests;
- unsupported configuration fails closed;
- success, timeout, HTTP 429, provider 5xx, and malformed payloads map to distinct typed results;
- invalid responses never replace a valid cache entry;
- the exact freshness boundary is deterministic;
- stale and unavailable evidence cannot create an attention candidate;
- provider response objects do not reach the browser contract;
- the default build and end-to-end journey run offline;
- no write route or live action is introduced.

Review should also inspect server logs and browser payloads to confirm that raw provider responses, exact personal locations, credentials, and provider error bodies are absent.

## Residual risks and promotion gates

The free provider endpoint has no production service-level agreement. In-memory cache is process-local and can be lost or differ across instances. The local application has no authentication because it handles only fictional data. These limits are accepted for the sandbox.

Before adding a personal connector or deploying live context, Orbit requires separate decisions and tests for:

- authentication and user/household isolation;
- OAuth state, PKCE where applicable, redirect URI validation, token encryption, rotation, revocation, and deletion;
- durable synchronization ownership and concurrency;
- scoped audit retention and redaction;
- per-user and global rate limits;
- data export, deletion, consent, and purpose limitation;
- prompt-injection defenses for any model-bound provider content;
- production provider terms, quotas, observability, and incident response;
- action capability policy, explicit approval, idempotency, verification, and undo.

## Related documents

- [ADR: Connector Server Boundary](../adr/ADR-connector-server-boundary.md)
- [Weather connector sandbox](../connectors/weather.md)
- [Permissions and trust](../permissions-and-trust.md)
