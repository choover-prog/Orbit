# Gmail unread Inbox connector threat model

- Status: Approved required controls for the implementation target
- Last reviewed: 2026-07-19
- Scope: one local Windows user, restricted `gmail.readonly`, unread Inbox
  metadata plus bounded snippet, no writes or model calls

## Assets and objective

Protected assets include Gmail OAuth credentials, authorization code, PKCE
verifier, unread/important status, timestamp, Subject, snippet, normalized
record identifiers, connection state, and the person's understanding of this
restricted access. The objective is bounded local awareness without allowing
email text to become an instruction, durable corpus, model input, or action
authority.

## Trust boundaries

```text
System browser
  -> local Orbit server (127.0.0.1)
    -> Gmail-only OAuth transaction/session store
    -> Google authorization/token/revocation endpoints
    -> Gmail-only DPAPI CurrentUser vault
    -> fixed Gmail messages list/get endpoints
    <- untrusted provider metadata and snippets
  <- provider-neutral read-only email observation
```

Gmail state is isolated from Calendar: no shared token, vault, transaction,
cache, cache key, backoff, normalized record set, disconnect effect, or
attention state. The local-only assumption fails for hosting, LAN exposure,
shared OS accounts, or multi-user use.

## Threats and required controls

| Threat | Required control |
| --- | --- |
| Restricted-scope overreach | Request only `gmail.readonly` because snippets require it; disclose its restricted status and keep the feature private/local. Never request compose, send, modify, broad mail, or incremental scopes. |
| OAuth CSRF, swapping, or code interception | Use a Gmail-specific 256-bit state, HttpOnly SameSite=Lax binding cookie, one-use ten-minute server session, S256 PKCE verifier, exact loopback callback, and sanitized post-callback redirect. |
| Credential mixing with Calendar | Use distinct connector IDs, vault files, transaction/cookie names, cache/backoff state, configuration keys, and explicit disconnect paths. A Gmail operation must not enumerate or mutate Calendar state. |
| Browser, URL, or log disclosure | Keep exchange/refresh server-side; never put tokens, codes, snippets, provider bodies, message IDs, headers, or raw errors in browser payloads, URLs, diagnostics, notices, audit events, or test output. Diagnostics use fixed categories and bounded safe codes only. |
| Credential disclosure at rest | Encrypt only Gmail's refresh token using DPAPI `CurrentUser` outside the repository; access tokens remain memory-only; validate schema/size and never fall back to plaintext. |
| DNS rebinding/local request forgery | Apply the same raw exact-loopback Host boundary to dynamic requests. Connect, refresh, and disconnect require exact loopback Origin plus `Sec-Fetch-Site: same-origin`; no GET may mutate or contact Gmail. |
| Unbounded mail extraction | Fix the `is:unread in:inbox` query, fields, response/page/message/text byte caps, timeout, lookback, one in-flight read, cache lifetime, and capped backoff. Do not support arbitrary search, thread traversal, history sync, watch, or pagination by user input. |
| Body/attachment/header retention | Use strict partial responses for identifiers, unread/Inbox/IMPORTANT label state, internal timestamp, bounded Subject, and bounded snippet only. Reject payload/raw/attachment/non-Subject header fields and do not request them. |
| Prompt injection or hostile text | Treat every snippet as untrusted display data; sanitize controls/bidi characters; prohibit model calls, tool invocation, HTML rendering, interpolation into logs, and action inference. |
| Partial/stale evidence | Mark capped/failed reads incomplete or stale and suppress their attention. Authentication/scope failures clear unusable local authority rather than presenting stale data as connected. |
| Provider data drives an action | Permit only a read-only observation. No recommendation, proposal, approval, execution, verification, undo, or Gmail mutation is reachable from Gmail context. |
| Cross-source overclaim | Emit at most one read-only cross-source observation only when both batches are fresh and complete and an eligible future Calendar title exactly equals an unread Inbox `IMPORTANT` Gmail Subject after conservative deterministic normalization. Snippets never participate. No fuzzy/semantic/model matching, recommendation, or action is allowed. |
| Disconnect/revocation race | Delete Gmail vault/cache/access token/session/attention locally before best-effort revocation; generation-check late writes so they cannot restore state after disconnect. |
| Restricted-scope promotion failure | Before any broader distribution, obtain required Google verification/security review and re-evaluate retention, data use, incident response, deletion/export, and hosting controls. |

## Data lifecycle

1. The person reads restricted-scope disclosure and explicitly connects Gmail.
2. Orbit creates a Gmail-only, short-lived server transaction and cookie.
3. The callback validates/consumes it before token exchange.
4. Orbit stores only the Gmail refresh credential in its DPAPI vault and holds
   the short-lived access token in memory.
5. An explicit bounded refresh normalizes permitted minimal fields to
   provider-neutral records; Subjects/snippets remain in the short process
   cache only.
6. When both providers are fresh/complete, the deterministic exact
   Calendar-title/important-Inbox-Subject rule may present one read-only
   cross-source observation; snippets remain display-only.
7. Disconnect clears all Gmail local state before best-effort revocation.
8. Process exit clears access tokens, snippets, and normalized cache.

## Required security tests

Test exact scope and scope rejection; Gmail/Calendar isolation; state/cookie
mismatch, expiry, replay, and PKCE; endpoint/redirect allowlists; bounded list
and get requests; absence of payload/raw/non-Subject headers/attachments;
Subject/snippet length and control/bidi sanitization; no provider I/O on GET;
rate limits/timeouts; stale/partial/auth-failure suppression; exact
Calendar-title/important-Inbox-Subject matching and snippet non-participation;
same-origin lifecycle mutations; disconnect race/deletion;
client-bundle/URL/log/audit scans; read-only action policy; and no model-call
path.

## Promotion gates

This design is an implementation target, not a release approval. Completion
requires tests, independent security review, and a private live qualification
that records only non-sensitive health/count outcomes. Hosting,
multiple people, mail actions, background sync, model use, or public release
require a new ADR/threat model and the required Google restricted-scope review.
