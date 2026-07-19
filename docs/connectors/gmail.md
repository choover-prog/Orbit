# Gmail unread Inbox connector design

- Status: Implemented and privately qualified for local-only evaluation
- Scope: local-only, one Windows user, read-only unread Inbox awareness

## Purpose and boundary

This implementation target lets Orbit show a small, bounded set of unread Inbox
items with a timestamp and short snippet. The purpose is awareness: help the
person decide whether to open Gmail. Orbit is not an email client, inbox
replacement, summarizer, search index, or agent for mail.

`gmail.readonly` is required because the product deliberately includes a
snippet; `gmail.metadata` cannot supply it. Google classifies `gmail.readonly`
as a restricted scope. The connector therefore stays private/local during this
stage and cannot be treated as a broadly released or hosted feature.

## What Orbit may read and retain

For a bounded set of `is:unread in:inbox` messages only:

- opaque hashed message and thread identifiers;
- Inbox/unread state;
- Gmail's `IMPORTANT` label and a bounded sanitized `Subject` header used only
  for the deterministic cross-source rule;
- provider internal timestamp; and
- a short, length-capped, sanitized snippet.

The snippet is a body-derived teaser, not a message body. It is visible only in
the local process cache and minimal UI evidence while fresh. Orbit must not
request, normalize, retain, display, log, search, or transmit MIME bodies,
attachments, `raw`, headers other than the bounded `Subject`, sender/recipient
addresses, drafts, thread history, message payload parts, or any other mail
content.

## Consent and publisher provisioning

The person opens **Connections**, reads a clear restricted-scope privacy
explanation, and explicitly selects **Connect Gmail**. The system browser
performs the Google authorization flow. The person never creates a Cloud
project or supplies OAuth values.

Publisher-owned Desktop client metadata (client ID and generated client secret)
is server-only and stored outside source control. For local qualification it
lives in ignored `.env.local`; a future package would provision it without
showing it to the person. PKCE S256, state/cookie binding, fixed root loopback
redirect, and exact local Host/origin controls apply independently to Gmail.

## Synchronization and health

An explicit consent completion or **Refresh now** is the only provider-I/O
path. A fixed Gmail endpoint lists unread Inbox identifiers and obtains a
strict partial response for no more than a small fixed number of messages.
The implementation must use fixed query/fields, bounded response sizes,
timeouts, page/message caps, one in-flight read, a short cache, and capped
provider backoff.

The connection surface exposes consent, scope, health, freshness,
completeness, provenance, and rate-limit retry time without revealing message
content in a status notice. Ordinary rendering can show validated cache state
only. A stale, incomplete, unauthorized, or malformed read may not create a
new attention item.

## Attention safety

Email is untrusted external input. Snippets are display data, not instructions
or evidence of an action. No model call receives a snippet. The connector can
emit a provider-neutral, read-only `email_attention` observation with
freshness/provenance and no recommendation, proposal, approval, execution,
verification, or undo authority.

The approved cross-source scenario may emit one `calendar_email_attention`
observation only if both the Calendar and Gmail batches are fresh and complete.
It considers an eligible future Calendar event and an unread Inbox Gmail
message with the `IMPORTANT` label. A match requires exact equality of the
conservatively normalized Calendar title and Gmail Subject: Unicode normalize,
remove controls/bidi characters, collapse whitespace, case-fold, then compare.
There is no substring, fuzzy, semantic, LLM, or snippet matching. The earliest
event start wins, with a stable record-ID tie-breaker. The UI may show minimal
provenance and the snippet as display-only context, but never uses it to match,
infer priority, recommend, or act.

## Disconnect and deletion

**Disconnect Gmail** is an exact same-origin POST with confirmation. It first
deletes Gmail-only DPAPI credentials, access token, PKCE sessions, cache,
backoff, records, and attention; then it asks Google's fixed revocation
endpoint to revoke the grant. Local deletion remains successful if revocation
is unavailable. It never marks mail read, archives, labels, drafts, sends, or
otherwise changes Gmail.

## Explicit non-goals

- No message bodies, attachments, headers other than the bounded Subject,
  search, thread expansion, or local mail index.
- No send, draft, reply, forward, archive, label, delete, mark-read, or modify
  scope/API.
- No background polling, push watch, hosted deployment, multi-user account,
  model call, prompt processing, autonomous recommendation, or action.

## Validation contract

Tests must prove exact restricted scope, OAuth/session isolation from Calendar,
no browser token exposure, no Gmail provider I/O on GET, bounds/rate limits,
identifier hashing, Subject/snippet sanitization, no body/attachment or
non-Subject header fields, stale/partial suppression, exact conservative
Calendar-title/Subject matching, snippet non-participation in matching,
explicit refresh, disconnect/deletion, and absence of snippets from logs, URLs,
notices, fixtures, screenshots, client bundles, and audit events.

The private live run passed the consent, bounded-read, incomplete-batch
suppression, connector-isolation, disconnect, cache-clearing, and encrypted
vault-deletion checks. See the qualification record; it intentionally contains
no account or message content.

## Related documents

- [Local Gmail auth ADR](../adr/ADR-gmail-local-readonly.md)
- [Gmail threat model](../security/gmail-threat-model.md)
- [Gmail audit gate](../security/gmail-audit.md)
- [Private live qualification](gmail-live-qualification.md)
