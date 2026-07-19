# Google Calendar connector threat model

- Status: Required controls for the local read-only vertical slice
- Last reviewed: 2026-07-19
- Scope: One local Windows user, owned primary Calendar events, no writes

## Assets and security objective

Protected assets are the OAuth refresh token, short-lived access token,
authorization code, PKCE verifier, normalized personal event timing, connection
state, and the user's understanding of what Orbit may do. Reading Calendar must
never confer action authority.

## Trust boundaries

```text
System browser
  -> local Orbit server (127.0.0.1)
    -> bounded OAuth transaction store
    -> Google authorization/token/revocation endpoints
    -> Windows DPAPI CurrentUser vault
    -> fixed Google Calendar Events endpoint
    <- untrusted provider responses
  <- provider-neutral records, health, freshness, provenance, attention
```

The local process has no Orbit login because this goal is explicitly
single-user and local-only. That assumption is invalid for hosted access,
shared operating-system accounts, or a LAN-bound server.

## Threats and controls

| Threat | Required control |
| --- | --- |
| OAuth CSRF or login swapping | Generate a 256-bit state, bind it to an HttpOnly SameSite=Lax cookie, retain it server-side for at most ten minutes, compare exactly, consume once before exchange, and reject missing, expired, mismatched, or replayed callbacks. |
| Authorization-code interception | Use S256 PKCE with a unique 43-128 character verifier, keep the verifier server-side, use the system browser, and accept only the fixed loopback callback. |
| Redirect manipulation | Validate the Desktop-client URI as exact root `http://127.0.0.1:<bounded-port>`; forward only bounded protocol parameters to the fixed internal handler; never accept a redirect URI or post-auth destination from a request. |
| Scope escalation | Compile in only `calendar.events.owned.readonly`; validate returned scope contains it; never use incremental/broad consent; reconnect is required for any future scope change. |
| Credential disclosure in the browser | Exchange and refresh server-side; never return a token or raw OAuth payload; use an HttpOnly transaction cookie; apply `no-store` throughout, `same-origin` referrer policy to accepted local pages, and `no-referrer` to OAuth or rejected responses. |
| Credential disclosure at rest | Encrypt the refresh token with DPAPI `CurrentUser`; write ciphertext atomically outside the repository; do not fall back to plaintext; bound and validate the decrypted schema. |
| Credential disclosure through processes/logs | Send DPAPI input through stdin, not arguments; use constant scripts and fixed endpoints; never log codes, tokens, cookies, headers, provider bodies, event values, or decrypted data. |
| DNS rebinding or local request forgery | Bind the app to loopback and reject every dynamic page, API, and RSC request unless the raw `Host` header is exactly `127.0.0.1:<bounded-port>`. Require both an exact loopback `Origin` and `Sec-Fetch-Site: same-origin` on connect, sync, and disconnect POSTs; expose no GET mutation. |
| Token replay after disconnect | Delete the vault and clear memory before remote revocation; clear access-token cache, events, failures, and pending transactions. |
| Revocation outage | Local deletion remains authoritative; return a calm partial result and direct the user to Google Account third-party access for remote cleanup. |
| Refresh-token invalidation | Map `invalid_grant` to reauthorization required; delete unusable local credentials; never spin on refresh. |
| SSRF/provider redirect | Keep authorization, token, revocation, and Calendar origins as HTTPS constants; do not follow user/provider URLs; construct only allowlisted query parameters. |
| Unbounded provider work | Use a five-second abort, bounded body reader, 50 items/page, four pages, 200 events, fixed fourteen-day horizon, one in-flight read, five-minute cache, and no foreground retry loop. |
| Rate-limit amplification | Honor capped `Retry-After`, expose next eligible time, and reject refresh attempts during backoff. |
| Malformed/malicious event data | Runtime-validate arrays, dates, enums, and string lengths before normalization; drop unneeded fields; hash provider identifiers; never cast a raw response into a domain contract. |
| Partial data presented as complete | Mark a capped multi-page response incomplete, retain no misleading empty result, and suppress attention until a complete read succeeds. |
| Stale evidence drives attention | Attach retrieved/stale timestamps; show stale health; suppress Calendar attention when the batch is stale or incomplete. |
| Prompt injection | Make no model call; do not retain descriptions or other free-form provider content beyond bounded titles; treat titles as display data only. |
| Provider data drives an action | Emit only a read-only attention bundle with no recommendation, proposal, approval, or execution route. Preserve the action-policy gate and keep the fictional demo connection distinct. |
| Cross-user disclosure | Prohibit hosted/multi-user deployment. A later deployment requires authenticated ownership, per-user vault/cache keys, authorization checks, deletion/export, and isolation tests. |
| Test or screenshot leakage | Use fictional fixtures and fake tokens; do not record live consent, event values, browser storage, files, or network payloads. |

## Data lifecycle

1. A user reads the disclosure and explicitly submits Connect.
2. Orbit stores only a short-lived in-memory OAuth transaction and cookie.
3. The callback consumes the transaction before exchanging the code.
4. Orbit validates scope and token shape, DPAPI-encrypts only the refresh token
   record, and keeps the access token in memory.
5. A bounded read validates and minimizes Calendar events into `SourceRecord`s.
6. Normalized events live only in the process cache and expire from fresh state
   after five minutes.
7. Disconnect deletes the vault and all in-memory connector state, then requests
   remote revocation.
8. Process termination removes access tokens and normalized event cache.

## Security tests

Automated tests must cover PKCE shape; exact scope/endpoints; state mismatch,
expiry, cookie mismatch, and replay; denied consent; malformed token response;
insufficient scope; mocked and real DPAPI round-trip, tamper/failure behavior,
atomic replacement, and deletion; exact Host, Origin, and Fetch Metadata
enforcement on mutating POSTs;
fixture no-network
behavior; provider timeouts, body/page/event caps, rate limits, unauthorized
refresh, and malformed/control-character event data; stale/partial attention
suppression; read-only action escalation protection; and disconnect cache/vault
deletion. Ordinary page and snapshot reads must prove they perform no Calendar
provider I/O.

Review must also search generated client bundles, HTTP responses, test output,
repository files, and application logs for plaintext fake-token markers. A live
manual consent run is valid only after this automated gate passes.

## Residual risks and promotion gates

DPAPI protects at rest but cannot protect against malware or a process running
as the same Windows user. The strict Host boundary blocks browser DNS rebinding,
but other software already running as that Windows user can still send direct
loopback requests. Google testing-mode grants may expire after seven days.
Provider availability and quota are external dependencies. These are accepted
for a personal local experiment, not production.

Before hosting or supporting more than one person, require a new ADR and threat
model for authenticated user isolation, managed encrypted secrets, production
OAuth verification, durable jobs, deletion/export, consent telemetry, incident
response, and provider terms. Calendar writes require a separate capability,
approval, verification, audit, and undo goal.
