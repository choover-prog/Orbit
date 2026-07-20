# Google Nest fixture qualification

- Date: 2026-07-19
- Scope: local fixture, browser UI, server gateway, normalized home boundary
- Live status: pending a publisher Device Access project and supported Nest hardware

## Qualified consumer path

1. The person connects a fictional Nest home without editing credentials.
2. Orbit performs one bounded normalized read and distinguishes supported from unsupported devices.
3. A camera stays closed until **View live video** and a second confirmation are selected.
4. The fictional stream is visibly temporary and can be stopped.
5. Thermostat mode, setpoint, and fan timer requests create an immutable review plan.
6. Nothing executes before **Approve change**.
7. Execution produces a verification result, audit entries, and a separately reviewed undo plan when the previous state is known.
8. Disconnect stops streams and clears credentials, cached context, pending plans, and sessions.

## Automated evidence

- Domain tests cover fresh/complete attention gating and provider-neutral normalization.
- Gateway tests cover connection, streaming, plans, approval, single execution, verification, undo, unsafe temperature rejection, unknown devices, and malformed SDP.
- Route tests prove cross-site rejection and the absence of GET mutation handlers.
- Component tests cover disclosures, two-step camera intent, and action approval.
- Playwright covers the fixture connection, requested stream, stop, approved thermostat change, verification, undo availability, accessibility, disconnect, and state deletion.

## Live checkpoint

Fixture qualification does not prove Google authorization, a real WebRTC answer, media rendering, command behavior, or read-after-write latency. A private live run must verify all of those with a supported device. Stop immediately if PKCE is not preserved, video remains after stop, a command can bypass approval, sensitive media negotiation appears in logs, or local credential deletion fails.
