# Google Nest implementation audit

- Date: 2026-07-19
- Result: fixture gate implemented; live gate pending hardware and publisher setup

## Authority review

- Browser requests use normalized opaque device IDs and fixed capability names.
- Only server code maps those requests to a closed Google command union.
- Plans require a fresh, complete read, expire after five minutes, include an integrity hash, and are single-use.
- Temperature and fan inputs have explicit safe bounds.
- Undo is another plan and never runs automatically.

## Camera review

- Only receive-only WebRTC offers with audio, video, and data sections in Google-required order are accepted.
- Starting video requires two explicit UI actions and a same-origin POST.
- No microphone track, recorder, canvas capture, persistence, model call, clip API, or event-image API exists.
- Session responses use `no-store`; SDP and provider media-session identifiers are absent from snapshots and audit text.
- Stop is available in the UI and is attempted on expiry, navigation cleanup, and disconnect.

## Local and connector isolation

- Nest has its own OAuth state/cookie, PKCE verifier, DPAPI vault path and entropy, token cache, sync cache, plan map, stream map, and audit buffer.
- Page and snapshot GETs use `peek` and do not spend provider authority.
- All lifecycle, stream, and control mutations reject cross-site requests.
- Disconnect deletes local credentials even when provider revocation cannot be confirmed.

## Residual risks

- Google's single restricted SDM scope may carry more provider authority than Orbit exposes; the server allowlist remains the decisive control.
- Browser cleanup is best-effort. Google session expiry and explicit server disconnect are required backstops.
- Live commands may be eventually consistent and can return `verification_failed` despite successful provider acceptance.
- Legacy RTSP cameras need a separately reviewed local media bridge and are intentionally unsupported.
- Google Home coverage outside Nest Device Access needs a future native mobile bridge; it must reuse Orbit's approval and audit contracts.
