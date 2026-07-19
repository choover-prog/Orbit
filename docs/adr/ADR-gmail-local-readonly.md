# ADR: Local Gmail unread-metadata connector

- Status: Approved implementation target; not yet implemented
- Date: 2026-07-19
- Decision owners: Orbit maintainers

## Context

Orbit needs a deliberately narrow email experiment after Calendar: surface a
small number of unread Inbox items with enough bounded context for a person to
decide whether to open Gmail. Gmail's `gmail.metadata` scope cannot return a
message snippet. A short snippet is intentionally part of this experiment, so
the smallest viable Google scope is the restricted
`https://www.googleapis.com/auth/gmail.readonly` scope. It is not a claim that
Orbit may read, summarize, or act on a whole mailbox.

Because this is a restricted scope that exposes private email text, the design
remains a single-user Windows, local-only prototype. It is not eligible for
hosting, shared devices, family accounts, broad rollout, or model processing.
Any public distribution must satisfy Google's then-current restricted-scope
verification and applicable user-data policy before release.

## Decision

Reuse the server-owned Desktop OAuth architecture only as an isolated Gmail
connector instance:

- a publisher-owned Desktop client ID and generated client secret live only in
  ignored local configuration or future package provisioning, never onboarding;
- a distinct S256 PKCE transaction, state cookie, one-use ten-minute session
  store, token configuration key, DPAPI `CurrentUser` vault path, in-memory
  access-token slot, cache, rate-limit state, audit namespace, and disconnect
  operation; and
- fixed Google authorization, token, revocation, and Gmail API origins.

The Calendar connector must neither read Gmail credentials nor share its
refresh token, OAuth session, cache, backoff, normalized records, or attention
state with Gmail. Disconnecting one connector has no local effect on the other.

Request exactly:

```text
https://www.googleapis.com/auth/gmail.readonly
```

This is a restricted-scope exception justified solely by bounded snippets.
Do not request `gmail.modify`, `gmail.compose`, `gmail.send`, `mail.google.com`,
or incremental scopes. A future draft/send product requires a separate
approval, policy, audit, verification, and undo decision.

## Bounded read

Provider I/O is explicit only: a successful consent completion or an exact
same-origin **Refresh now** POST. Pages, snapshots, and attention rendering
only inspect a process-local validated cache.

The adapter will list only `is:unread in:inbox` message identifiers, with a
fixed small page cap and fixed lookback window, then fetch at most that cap of
message metadata and a bounded `snippet`. It will request a strict partial
response allowlist: opaque message/thread identifiers, Inbox/unread labels,
provider internal timestamp, and the bounded snippet. It will never request or
retain MIME `payload` parts, `raw`, attachments, headers, bodies, drafts,
thread expansion, senders, recipients, addresses, or labels beyond the
minimum Inbox/unread state.

The implementation must also extract only the `Subject` header as a bounded
field for a deterministic cross-source match. It must reject malformed
responses and overlong strings, hash provider identifiers before `SourceRecord`
normalization, sanitize control/bidi characters, cap response
bytes/pages/messages/timeouts, use one in-flight refresh, and apply a short
cache with capped `Retry-After` backoff. Neither stale nor partial email
batches may create attention.

## Consequences

- A snippet is untrusted, private, body-derived text. It is display-only and
  must never be executed, interpreted as instructions, forwarded to a model,
  logged, indexed, or used as action authority.
- The read-only connector may explain bounded provenance and freshness, but
  cannot mark read/unread, archive, label, draft, send, delete, modify, or
  invoke a model.
- Calendar and email may create one deterministic, read-only cross-source
  attention item only when both connector batches are fresh and complete. The
  rule considers only an eligible future Calendar event and an unread Inbox
  message bearing Gmail's `IMPORTANT` label, then requires exact equality of
  their conservatively normalized title/Subject (Unicode-normalized, controls
  and bidi characters removed, whitespace collapsed, case-folded; no substring,
  fuzzy, semantic, or snippet match). It picks the earliest event start and
  stable record-ID tie-breaker. The snippet is display-only and never enters
  matching. The output contains evidence/provenance only—never a
  recommendation, action, or model input.
- Disconnect deletes Gmail's vault, access token, sessions, cache, backoff,
  normalized records, and pending attention locally before best-effort Google
  revocation. No Gmail operation changes mail state.

## Alternatives rejected

### `gmail.metadata`

Rejected for this experiment because it cannot supply snippets. It remains the
preferred scope for any future metadata-only experience.

### Full message bodies or attachments

Rejected. They are unnecessary for an Inbox awareness slice and materially
increase retention, prompt-injection, privacy, and restricted-scope exposure.

### Sharing Calendar's credential or cache implementation

Rejected. Shared state would make disconnect, deletion, rate limits, and
provenance ambiguous across independent authorities.

### Model-based email prioritization

Rejected. This lane has no model call. Any later model processing needs a
separate purpose limitation, consent, minimization, retention, and threat
model decision.

## References

- [Gmail scope definitions](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Gmail Messages.get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get)
- [Gmail message resource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages)
- [Google Workspace API user-data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)

## Related documents

- [Connector server boundary](ADR-connector-server-boundary.md)
- [Gmail connector design](../connectors/gmail.md)
- [Gmail threat model](../security/gmail-threat-model.md)
- [Gmail audit gate](../security/gmail-audit.md)
