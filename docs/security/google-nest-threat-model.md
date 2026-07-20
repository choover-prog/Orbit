# Google Nest stream and control threat model

- Review status: Required gate for fixture and live qualification
- Scope: local OAuth, home context, temporary video, thermostat/fan commands

## Protected assets

- Google refresh/access tokens and OAuth authorization codes;
- home/room/device identity and current state;
- WebRTC SDP, ICE information, media session IDs, and live audio/video;
- command authority, plans, approvals, results, verification, and audit;
- separation among Calendar, Gmail, Nest, and future Home Assistant state.

## Threats and controls

| Threat | Control |
| --- | --- |
| OAuth login CSRF or connector crossover | Random state, HttpOnly same-site connector cookie, S256 PKCE, exact loopback callback, exactly-one-connector dispatch, one-use session. |
| Token theft | Server-only exchange, Nest-specific DPAPI CurrentUser entropy and file, no browser token, no token logs or snapshot fields. |
| Excessive provider authority | PCM device/trait selection plus a smaller hard-coded Orbit capability and command allowlist; no browser-provided command names. |
| Passive navigation spends authority | Snapshot/page GETs use cache-only `peek`; reads, streams, and controls require exact-origin POST. |
| Forged device target | Browser uses an opaque normalized ID; server resolves it through the latest private batch map and exact resource prefix. |
| Stale approval | Plans require fresh complete data, show previous/expected state, expire in five minutes, include a server-held hash, and execute once. |
| False success | Command is followed by authoritative readback; mismatch is `verification_failed`. |
| Video starts without intent | Two-step View/confirm UI and exact-origin POST; no background stream route. |
| Stream credential disclosure | SDP and media IDs are response-only/in-memory, bounded, and absent from logs, snapshots, audit text, persistence, and URLs. |
| Camera recording or analysis | No MediaRecorder, canvas capture, image/clip API, storage, telemetry, or model path. |
| Stream continues after UI | Explicit Stop, expiry timer, navigation cleanup, gateway tracking, disconnect cleanup, and provider expiry. |
| Malicious provider strings | NFKC/control/bidi sanitization, length bounds, React text rendering, raw trait allowlist, no HTML interpretation. |
| Resource exhaustion | Fixed origins/paths, timeout, response byte limit, hierarchy caps, cache, single-flight sync, and retry backoff. |
| Cross-connector deletion | Separate vault path, entropy, cookie, sessions, cache, token, plans, streams, and registry state. |
| Unsafe undo | Undo is a new visible plan requiring approval and is never automatic. |

## Required audit assertions

- Search artifacts for tokens, codes, client metadata, SDP, stream URLs, media session IDs, provider resource names, and personal fixtures.
- Prove GET routes never call SDM or execute commands.
- Prove stream routes accept only bounded receive-only WebRTC offers.
- Prove command routes reject cross-site requests, arbitrary commands, unknown devices, stale/reused plans, modified hashes, and unsafe parameters.
- Prove provider failures and verification mismatch never appear as success.
- Prove disconnect deletes the Nest vault even if revocation fails.

## Live stop conditions

Do not qualify live mode if PCM drops PKCE parameters, requested traits exceed the disclosure, SDP appears in a log, a command bypasses approval, video persists after stop/expiry, or disconnect cannot delete the local vault.
