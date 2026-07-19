# Google Calendar vertical-slice audit

- Review date: 2026-07-19
- Scope: local-only, single-user, owned-primary-calendar read slice
- Review status: complete; implementation findings resolved and repository
  gates green
- Review method: independent architecture/security and UX/accessibility review,
  adversarial route checks, focused automated tests, and repository diff review

## Authority reviewed

The audited capability starts at explicit Calendar consent and ends at a
provider-neutral, read-only overlap concern. It includes the Desktop OAuth
loopback, S256 PKCE transaction, token exchange and refresh, DPAPI vault,
bounded Events request, normalization, local cache, health and provenance,
disconnect/revocation, UI disclosure, and action-policy boundary. Calendar
writes, model calls, background synchronization, hosted access, and multi-user
identity are absent.

## Findings and disposition

| Finding | Severity | Resolution |
| --- | --- | --- |
| PowerShell DPAPI helpers did not load `System.Security` in a fresh `-NoProfile` process. | High | Both fixed scripts load the assembly; a real Windows `CurrentUser` protect/unprotect test now runs in addition to mocked runner tests. |
| The Desktop client used a callback path although Google documents the loopback redirect at the host root. | High | The provider redirect is exact root `http://127.0.0.1:<port>`; the root forwards only bounded protocol fields to the internal handler. |
| An arbitrary Host could reach the unauthenticated loopback app through DNS rebinding. | High | The Next.js request proxy rejects every dynamic page, API, and RSC request unless raw Host is exact `127.0.0.1:<bounded-port>`. |
| A failed first read could still display a successful connection/read notice. | High | Connect and callback notices claim success only when the returned gateway state is `fresh`; URL notices are also checked against current state. |
| Authentication failures could be presented as stale connected data. | High | Authentication/scope failures suppress cached batches, delete invalid grants, and expose `reauthorization_required`. |
| A Calendar 401 could reuse the rejected in-memory access token. | High | The gateway clears it, performs at most one refresh and one retry, then clears it again on a second 401. |
| Ordinary GET rendering could silently contact Google. | High | Snapshot building uses provider-I/O-free `peek`; only consent completion and exact-origin sync POST can read Google. |
| Provider titles allowed control and bidirectional override characters. | Medium | Normalization strips C0/C1, line, zero-width, BOM, and bidi-control characters before titles reach trust UI. |
| Fixture UI could imply a real Google grant and vault. | Medium | Mode-specific title, consent, notices, action labels, and disconnect copy identify the offline fictional demo and its in-memory storage. |
| Consent omitted eligibility fields actually requested. | Medium | Disclosure now names timing, availability, status, update time, and the user's own response; descriptions, locations, identities, and conference data remain excluded. |
| Disconnect focus and notice semantics were incomplete. | Medium | Focus moves to the confirmation action and returns on cancel; success/warning/error notices use distinct semantics and calm styling. |
| A disconnect racing refresh or token rotation could repopulate local state. | Medium | Credential generations invalidate late writes and cache generations prevent late synchronization from restoring data. |

## Positive controls

- Exact `calendar.events.owned.readonly` scope and `calendarId=primary` are
  compiled into server code.
- State and cookie binding are 256-bit values; the S256 verifier stays in a
  bounded, one-use, ten-minute process store.
- Access tokens remain in memory. Only a strictly validated refresh credential
  is encrypted under `%LOCALAPPDATA%\Orbit` with DPAPI `CurrentUser`.
- OAuth, provider, and vault response bodies are byte-bounded. Calendar reads
  also cap duration, pages, events, page tokens, fields, and time horizon.
- Provider identifiers are one-way hashed; raw IDs and excluded event fields do
  not cross the adapter boundary.
- Partial and stale batches cannot produce attention. Calendar attention has no
  recommendation, proposal, approval, execute, or undo authority.
- Disconnect deletes local authority and cache before best-effort remote
  revocation; orphaned encrypted temporary files are also removed.

## Automated evidence

Focused tests cover OAuth state/cookie mismatch and replay, PKCE, exact scope,
token/body limits, invalid grant deletion, real DPAPI round-trip, atomic vault
deletion, bounded pagination, rate limits, 401 refresh-once behavior, malicious
titles, cache races, provider-I/O-free snapshots, deterministic overlap,
read-only action isolation, lifecycle routes, notices, focus, and accessibility.

Final repository evidence on Node 24:

- `npm run format:check`, `npm run lint`, and `npm run typecheck` passed.
- `npm test` passed 22 files and 173 unit, component, route, domain, and server
  tests.
- `npm run build` produced the optimized Next.js 16.2.10 application with the
  connector routes and loopback proxy.
- `npm run test:e2e` passed 12 applicable desktop/mobile scenarios; four
  project-inapplicable duplicates were intentionally skipped.
- `git diff --check` and a repository-diff secret/artifact scan passed. Matches
  in tests are explicit fictional markers used to prove sensitive values do
  not escape server boundaries.

## Manual live-consent checkpoint

Automated validation uses fictional credentials and responses. A maintainer
must create a local Google Cloud Desktop OAuth client, enable Calendar API, add
their evaluating account as a consent-screen test user, provision the public
client ID into the private qualification build, and complete one unrecorded
end-user consent/sync/disconnect run. The evaluator only uses Orbit's Connect
control and Google's login and consent surfaces; they never edit configuration.
This checkpoint must not capture or commit codes, tokens, event values, or the
DPAPI blob.

## Accepted local-only residual risk

DPAPI and the Host boundary do not defend against malware or another process
already running as the same Windows user. The in-memory cache disappears on
restart and is intentionally not a durable synchronization system. Google
testing-mode grant expiry, provider availability, and quota remain external.
These constraints prohibit treating this slice as hosted or multi-user
production infrastructure.
