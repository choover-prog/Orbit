# ADR: Local Google Calendar authorization and storage

- Status: Accepted for the local-only vertical slice
- Date: 2026-07-19
- Decision owners: Orbit maintainers

## Context

Orbit's first personal connector must read a bounded part of one person's
primary Google Calendar without turning the browser into a credential holder,
adding a hosted identity system, or granting write authority. The current
application runs as a local Next.js process on the same Windows account as its
user.

Google documents PKCE and loopback redirects for installed desktop clients.
That model matches this local-only evaluation better than pretending the local
process is already a hosted confidential web application. The browser remains
the system browser; the local Orbit server owns the OAuth transaction, token
exchange, token vault, synchronization, and normalized response.

## Decision

Use a Google OAuth client of type **Desktop app** with the authorization-code
flow, PKCE S256, and the fixed root loopback callback documented for Desktop
clients:

```text
http://127.0.0.1:3000
```

The Desktop client ID is Orbit publisher configuration, not consumer
configuration. A released Orbit build is provisioned with its public installed
app identity before distribution. End users never create a Cloud project,
download credentials, paste an identifier, or edit an environment file. Since
a Desktop client is a public OAuth client, Orbit does not accept or transmit a
client secret.

The configured callback must use `http`, the exact `127.0.0.1` host, a bounded
local port, no credentials, and the root path. The root page immediately
forwards only bounded `code`, `state`, or `error` protocol values to an internal
callback handler, which strips them in a second redirect. Orbit will not accept
an arbitrary redirect URI or provider endpoint from the browser.

The server creates a 256-bit random state and PKCE verifier for every attempt.
It keeps the verifier in a bounded, ten-minute, in-memory, one-use transaction
store and binds the browser with an HttpOnly, SameSite=Lax cookie. The callback
validates both values before any token exchange and immediately redirects to a
sanitized Connections URL.

Request exactly this scope:

```text
https://www.googleapis.com/auth/calendar.events.owned.readonly
```

The slice reads only `calendarId=primary`. The selected scope is narrower than
`calendar.events.readonly`: it covers events on calendars the user owns rather
than all calendars the account can access. Shared/subscribed calendars require
a later product decision and new consent.

Use Windows Data Protection API (DPAPI), `CurrentUser`, for the refresh-token
vault. The encrypted blob lives under the current user's local application data
directory, outside the repository. Access tokens stay in process memory.
Secrets are passed to the fixed PowerShell DPAPI helper over stdin, never in
process arguments. There is no plaintext fallback on unsupported platforms.

Disconnect is a same-origin POST. Orbit deletes the local vault and normalized
cache before making a best-effort request to Google's fixed revocation endpoint.
If revocation is unavailable, local access still ends and the UI explains how
to remove consent from the Google Account. Disconnect never edits Calendar.

## Synchronization policy

Each explicit read is a fresh bounded query of the primary calendar:

- from one day before the request time through fourteen days after it;
- expanded recurring instances, ordered by start time;
- at most 50 items per page, four pages, and 200 normalized events;
- a five-second transport deadline and a bounded response body;
- a strict partial-response field allowlist;
- a five-minute validated cache and capped provider backoff.

Normal page and snapshot GETs only inspect this process-local cache. Provider
I/O occurs on initial consent or an explicit same-origin refresh POST, so a
passive navigation cannot spend Calendar authority or quota.

This slice intentionally does not use Calendar `syncToken`. Google does not
allow a sync token to be combined with `timeMin`, `timeMax`, or `orderBy`. A
bounded rolling read is easier to reason about for the first single-user local
slice. If the page cap is reached, the result is marked incomplete and cannot
produce attention.

## Consequences

- The local Orbit process must be running at the configured loopback origin
  during consent.
- OAuth state is intentionally lost on restart; the user simply reconnects.
- Refresh tokens are protected for the current Windows account but not against
  a compromise of that signed-in account.
- Google testing-mode grants for sensitive Calendar scopes may expire quickly.
- A future hosted or multi-user Orbit deployment must replace this Desktop
  client/DPAPI design with managed authentication, per-user encrypted storage,
  hosted callback registration, and isolation controls.
- No Calendar write scope, event mutation route, model call, autonomous action,
  or background worker is introduced.

## Alternatives considered

### Browser-held tokens

Rejected. Browser storage would expose long-lived credentials to client script
and blur Orbit's provider boundary.

### Google service account

Rejected. It does not represent ordinary consumer consent to a personal
Calendar and would require domain sharing or delegation.

### Broad Calendar read scope

Rejected for this slice. Orbit needs only event timing from the owned primary
calendar; calendar metadata and shared calendars are not required.

### Plaintext local token file

Rejected. An ignored file is not secure storage.

### New OAuth or Google SDK dependency

Rejected. Node's built-in fetch and crypto primitives are enough for this
small, auditable protocol surface.

## Authoritative references

- [Google OAuth for desktop apps and PKCE](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google OAuth security best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [Google Calendar scope definitions](https://developers.google.com/workspace/calendar/api/auth)
- [Calendar Events.list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
- [Calendar quota and backoff guidance](https://developers.google.com/workspace/calendar/api/guides/quota)

## Related documents

- [Connector server boundary](ADR-connector-server-boundary.md)
- [Google Calendar connector](../connectors/google-calendar.md)
- [Google Calendar threat model](../security/google-calendar-threat-model.md)
