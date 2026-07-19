# Gmail unread Inbox connector audit gate

- Status: Passed for the local-only implementation and private qualification
- Review date: 2026-07-19
- Scope: approved local-only restricted-scope Gmail implementation target

## Audit objective

This gate prevents Calendar's trusted timing pattern from being copied into
email without accounting for private, body-derived, and adversarial snippets.
It governs the implemented local-only connector and is not approval for hosted
deployment, public distribution, background synchronization, or email action.

## Required evidence before implementation completion

| Control | Evidence required |
| --- | --- |
| Scope necessity | Design proves `gmail.readonly` is needed for snippets and documents why `gmail.metadata` is insufficient. |
| Restricted-scope posture | Local/private status, publisher-owned OAuth metadata, and public-release/hosting gates are clear. |
| Credential/session isolation | Tests prove Gmail cannot read, overwrite, revoke, or reuse Calendar vault/session/cache/backoff state. |
| Data minimization | Fixed unread-Inbox query and response allowlist prove only IDs, unread/Inbox/IMPORTANT state, internal timestamp, bounded Subject, and bounded snippet cross the adapter boundary. |
| Content exclusion | Tests and HTTP fixtures prove no body, payload, raw, attachment, header other than bounded Subject, sender/recipient, draft, or thread content is requested, normalized, logged, or retained. |
| Explicit provider I/O | Consent completion and exact-origin refresh are the only Gmail network paths; GET/page/snapshot reads are provider-I/O-free. |
| Untrusted text handling | Snippets are length-limited and control/bidi-sanitized; no model/tool/action path, raw diagnostic, unsafe HTML, or log interpolation exists. |
| Attention safety | Stale/partial data is suppressed. One deterministic read-only cross-source observation is allowed only for fresh/complete data when an eligible future Calendar title exactly equals an unread Inbox `IMPORTANT` Gmail Subject after conservative normalization; snippets are display-only and it has no action authority. |
| Disconnect/deletion | Gmail-only local deletion precedes best-effort revocation and survives racing refresh/token rotation. |
| Secret/privacy scan | No OAuth values, snippets, account identity, message IDs, network bodies, DPAPI blobs, or absolute local paths appear in source, fixtures, logs, URLs, screenshots, or generated bundles. |

## Review findings

The implementation and tests were reviewed against this gate. No release-
blocking credential crossover, browser token exposure, GET-triggered provider
I/O, unbounded content path, snippet-to-model/action path, or stale/partial
attention path was found. Exact punctuation-preserving title/Subject matching
was strengthened during review and covered by a regression test.

Remaining promotion conditions:

- Confirm Google’s current restricted-scope verification and user-data policy
  requirements before any distribution beyond private local evaluation.
- Confirm a Gmail API partial response can provide only the documented minimal
  fields while deliberately retaining a Subject and snippet and excluding MIME
  payloads.
- Repeat policy and restricted-scope review before any distribution beyond the
  current private local evaluation.

## Stop conditions

Do not approve Gmail implementation or release if any test exposes private text
outside the intended transient local UI/cache, if connector state can cross
into Calendar, if any GET contacts Gmail, if a model receives a snippet, or if
an email observation can lead to a Gmail or other provider action, or if a
snippet is used for matching or prioritization.

## Related documents

- [Local Gmail auth ADR](../adr/ADR-gmail-local-readonly.md)
- [Gmail connector design](../connectors/gmail.md)
- [Gmail threat model](gmail-threat-model.md)
- [Private live qualification](../connectors/gmail-live-qualification.md)
