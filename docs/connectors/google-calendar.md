# Google Calendar connector

## Scope

This is Orbit's first authenticated personal connector. It is intentionally a
local-only, single-user, read-only vertical slice.

It can:

- ask for explicit access to events on the user's owned primary calendar;
- read a rolling, bounded window from yesterday through the next fourteen days;
- normalize minimal timing data behind Orbit's `SourceRecord` contract;
- show health, freshness, provenance, and one deterministic overlap concern;
- remove the local connection and request Google token revocation.

It cannot create, change, move, invite, delete, or respond to events. It makes
no model call and exposes no action proposal. The existing scheduling action is
a separate fictional demo adapter.

## Data minimization

Orbit requests and retains only what the overlap rule needs:

- event title (or the neutral fallback `Busy event`);
- start and end;
- all-day, busy/free, and event status;
- the signed-in user's own response status;
- provider update time;
- an opaque hash derived from the provider event identifier.

Orbit does not request or normalize descriptions, locations, conference links,
attachments, attendee names or addresses, creator details, or raw Google event
objects. Normalized records are cached only in the running process. The refresh
token is the only durable personal credential and is encrypted with Windows
DPAPI for the current user.

## End-user connection

In a publisher-provisioned Orbit build, the person:

1. Opens **Connections**.
2. Reads what Calendar data Orbit can and cannot access.
3. Chooses **Connect Google Calendar**.
4. Signs in on Google's page and approves or cancels the read-only request.
5. Returns to Orbit, which reports connection health and freshness.

The person never creates a Google Cloud project, supplies an OAuth client ID,
downloads a credential file, or edits Orbit configuration.

## Publisher provisioning

This is release and maintainer work, not onboarding:

1. Create or select a Google Cloud project.
2. Enable Google Calendar API.
3. Configure the OAuth consent/branding screen and add the evaluating account
   as a test user.
4. Create an OAuth client of type **Desktop app**.
5. Provision the Desktop client ID and generated client secret into the Orbit
   server runtime. Local maintainers use ignored `.env.local`; a future
   packaged release must inject them during build or installation.
6. Set `ORBIT_GOOGLE_CALENDAR_MODE=live` for the qualified build.
7. Keep the callback at the documented loopback URI unless the local port is
   deliberately changed.
8. Start Orbit on `127.0.0.1`, open `/connections`, read the disclosure, and
   choose **Connect Google Calendar**.

No token, authorization code, publisher credential, or personal event belongs
in source control. The Desktop client ID is a public installed-app identifier;
Google's generated Desktop client secret is required by the token endpoint but
cannot be treated as a durable confidential control in distributed software.
Both remain publisher-owned, server-only, redacted, and outside the repository.

Fixture mode is the default. It performs no Google request and exercises the
same connection, synchronization, normalization, attention, and disconnect
lifecycle with fictional data.

## Bounded read

Orbit queries the fixed Calendar API endpoint for `calendars/primary/events`
with `singleEvents=true`, `orderBy=startTime`, and fixed time bounds. It caps
pages, events, response bytes, string lengths, and request duration. A response
that exceeds the cap is incomplete and is not eligible for attention.

Validated records are fresh for five minutes. Only connect and the explicit,
same-origin **Refresh now** operation may contact Google; ordinary pages and
snapshot GETs only peek at in-memory state. Repeated explicit reads share a
single in-flight synchronization. Rate limits and provider failures set a
bounded retry time; Orbit does not create a foreground retry storm. A validated
prior batch may be shown as stale, but stale or incomplete evidence cannot
create a new scheduling concern. Authentication and scope failures discard the
stale view and require reconnection.

## Deterministic attention

Orbit ignores all-day, cancelled, transparent, self-declined, invalid, and
already-ended events. It sorts eligible records by start, end, and stable record
identifier. The first strict overlap wins; adjacent meetings are not an
overlap. At most one `calendar_conflict` read-only bundle is emitted.

The UI can explain the titles, times, overlap duration, provenance, and
freshness. It never offers approval or execution from this connector.

## Disconnect and deletion

Disconnect first makes Orbit locally unable to access the account by deleting
the DPAPI vault and clearing access-token, cache, backoff, and pending OAuth
state. It then asks Google to revoke the grant. Revocation can affect every
scope granted to the same Google Cloud project/client family, which the UI
states before confirmation.

If Google revocation fails, the local deletion remains complete. The user can
also remove Orbit under Google Account > Security > Third-party access.

## Validation

Run:

```bash
npm run check
npm run test:e2e
```

Automated tests use only fictional credentials and provider responses. Live
consent is a separate manual checkpoint and must never be recorded.

The private live procedure and its data-safe qualification helper are described
in [Google Calendar private live qualification](google-calendar-live-qualification.md).

## Related documents

- [Local auth ADR](../adr/ADR-google-calendar-local-auth.md)
- [Threat model](../security/google-calendar-threat-model.md)
- [Connector boundary](../adr/ADR-connector-server-boundary.md)
- [Private live qualification](google-calendar-live-qualification.md)
