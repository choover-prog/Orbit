# Google Home / Nest local connector

- Status: Fixture implementation complete; live qualification requires a Device Access project and supported device
- Modes: `fixture` (default), `live` (explicit publisher provisioning)
- Boundary: one local Windows user, selected Nest devices, no hosted service

## What this connector is

This is Google's server-side Nest Device Access integration. It is not the native Google Home API and does not cover every light, plug, speaker, Matter device, or Works-with-Google-Home device shown in the Google Home app.

Supported Device Access families currently include Nest thermostats, cameras, doorbells, and Nest Hub Max. Orbit shows devices returned by Google that do not fit its current allowlist as unsupported instead of inferring capabilities from their names.

## Consumer flow

1. Open **Connections** and read the video/control disclosure.
2. Choose **Connect Google Home / Nest**.
3. In Google's Partner Connections Manager, select the home, devices, and trait groups Orbit may access.
4. Return to Orbit for one bounded read.
5. Choose **View live video** on a WebRTC-capable camera and confirm the temporary session, or choose a thermostat/fan change and review its plan.
6. Approve or cancel the exact change. Orbit executes once, reads back, verifies, audits, and offers an undo plan when possible.
7. Disconnect to stop sessions, delete local cache and the DPAPI vault, and ask Google to revoke the grant.

The person does not paste tokens into Orbit. Publisher-owned project ID, OAuth client ID, and client secret are server-only runtime configuration.

## Normalized context

One bounded batch contains provider-neutral structures, rooms, devices, capabilities, observations, permissions, provenance, retrieval time, stale time, and completeness. Raw enterprise, structure, room, and device resource names do not enter product components or `OrbitSnapshot`.

Allowed observation traits are connectivity, ambient temperature, humidity, HVAC state, thermostat mode, current setpoint, fan timer state, and camera stream protocol/resolution capability. Camera event images, clips, event history, microphones, Pub/Sub events, arbitrary traits, and command metadata are excluded.

## Video

- WebRTC only in the browser; each session requires an explicit request and confirmation.
- Audio is receive-only; Orbit never opens a microphone track.
- SDP is ephemeral and never persisted or logged.
- The stream is never recorded, analyzed, summarized, cached, or sent to an AI provider.
- Sessions stop on request, expiry, navigation cleanup, and disconnect.
- RTSP-only devices display an explicit limitation.

## Controls

The browser supplies a provider-neutral desired change, never a Google command. The server maps a validated capability to a fixed command and parameters. Temperature is bounded to 9–32°C; heat/cool ranges preserve at least a 1°C gap; fan timers are bounded to 1 minute–12 hours.

Every control follows:

`fresh state → immutable plan → explicit approval → execute once → bounded readback → verify → audit → optional undo plan`

No model output can create or approve a plan.

## Live runtime configuration

```dotenv
ORBIT_GOOGLE_NEST_MODE=live
ORBIT_GOOGLE_NEST_CLIENT_ID=<Web OAuth client ID>
ORBIT_GOOGLE_NEST_CLIENT_SECRET=<Web OAuth client secret>
ORBIT_GOOGLE_NEST_PROJECT_ID=<Device Access project ID>
ORBIT_GOOGLE_NEST_REDIRECT_URI=http://127.0.0.1:3000
```

Keep real values in ignored local configuration. The OAuth redirect must match exactly. Device Access project setup is publisher preparation, not ordinary consumer onboarding.

## Explicit exclusions

- No background monitoring, Pub/Sub, event images, clips, recording, face/person inference, microphone capture, model calls, or automation rules.
- No arbitrary commands, lock/alarm control, hosted tokens, or multi-user accounts.
- No native Google Home SDK or Home Assistant adapter in this milestone.

## Related documents

- [ADR](../adr/ADR-google-nest-device-access.md)
- [Threat model](../security/google-nest-threat-model.md)
- [Mobile bridge boundary](../architecture/google-home-mobile-bridge.md)
