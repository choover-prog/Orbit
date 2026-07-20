# ADR: Google Nest Device Access, temporary video, and approved controls

- Status: Accepted for local fixture qualification; live qualification pending publisher/device setup
- Date: 2026-07-19

## Context

Orbit needs useful home capabilities, not a passive device-status dashboard. The web application must show a camera when the person explicitly asks and control a supported device after a clear approval. It must not record video, hide commands inside ordinary rendering, or confuse Google Nest Device Access with the broader native Google Home APIs.

Google's Smart Device Management (SDM) API is a server-accessible REST API for supported Nest devices. Its single `sdm.service` OAuth scope is restricted and can expose both traits and commands selected by the person in Partner Connections Manager (PCM). Google does not offer a separate read-only SDM scope. Orbit therefore enforces less authority than the provider token through its own capability and command allowlists.

The broader Google Home APIs cover many more Matter and Works-with-Google-Home devices but are native Android/iOS SDKs. They are not substituted into this Next.js server connector.

## Decision

Use one isolated local Google Nest gateway with:

- PCM authorization, state/cookie binding, S256 PKCE, and an exact loopback redirect;
- a connector-specific Windows DPAPI refresh-token vault;
- bounded GET reads of selected structures, rooms, devices, and a small trait allowlist;
- hashed provider references at the Orbit Core boundary;
- WebRTC live-stream generation only after an explicit user request;
- no RTSP token exposure to the browser and an explicit unsupported message for RTSP-only devices;
- immutable thermostat/fan command plans with plan hashes, expiry, approval, single execution, provider readback, verification, audit, and undo-plan generation when prior state is known;
- active stream stop on user action, expiry, navigation cleanup, and disconnect;
- fixture mode with fictional data, preview, commands, and audit.

Only these command families are allowed initially: thermostat mode and setpoint, fan timer, and WebRTC stream generate/stop. No arbitrary trait name, command string, provider resource name, or raw parameter object may come from the browser.

## Stream privacy

WebRTC SDP is ephemeral negotiation data. Orbit validates its size and receive-only media shape, forwards it directly to SDM, and returns the answer only to the initiating browser. SDP, media session IDs, stream URLs, video, audio, frames, and camera events are never persisted, logged, added to `OrbitSnapshot`, sent to a model, or placed in audit summaries. Sessions expire after Google's short lifetime and are explicitly stopped when possible.

## Consequences

- A granted SDM token may carry provider authority beyond the current Orbit allowlist; deterministic server policy is mandatory.
- WebRTC-capable cameras work in the browser. Supporting legacy RTSP needs a separately reviewed local relay/transcoder.
- Provider commands may be eventually consistent. Orbit reports `verification_failed` when readback differs.
- Live qualification requires a Device Access project, matching Web OAuth client, supported Nest device, and explicit PCM selection.
- PCM documentation does not explicitly document PKCE query parameters. The live checkpoint must prove that PCM preserves the verifier/challenge flow; Orbit will not silently remove PKCE.

## References

- [SDM API](https://developers.google.com/nest/device-access/api)
- [Authorization and PCM](https://developers.google.com/nest/device-access/api/authorization)
- [Camera live-stream trait](https://developers.google.com/nest/device-access/traits/device/camera-live-stream)
- [Thermostat API](https://developers.google.com/nest/device-access/api/thermostat)
- [Google OAuth security practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
