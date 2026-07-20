# Device Atlas fixture qualification

- Status: TypeScript fixture and native harness qualified; private SDK consent pending
- Date: 2026-07-20

## Automated evidence

The qualification suite must prove:

- five source observations reconcile to four devices, with two weak identities left for review;
- Google Home and Govee observations merge only through a shared strong provider link;
- a same-name discovery remains separate;
- a fully consented local Matter path scores 100;
- an equal-score path with broader useful capability coverage wins the deterministic tie-break;
- event-capable sources select subscriptions and other sources use bounded polling;
- an automation remains simulated and sends no command;
- fixture output retains no IP or hardware address;
- bridge messages runtime-validate bounded fields and bytes, sign exact received payloads, and reject invalid signatures, stale timestamps, replayed sequences, and network identities;
- the Connections panel communicates privacy and simulated authority;
- the fixture API is non-cacheable.

## Native harness evidence

The companion now compiles with JDK 17 and Android SDK 35. Sixteen Kotlin tests, debug APK assembly, and Android lint pass. Consent state, read-only normalization, provider-ID pseudonymization, canonical bridge encoding, and device-bound bridge signing are covered. The manifest remains free of location, nearby-device, camera, microphone, multicast, and background permissions.

Official Google Home SDK artifacts, app registration, physical-device consent, real inventory reconciliation, Android accessibility inspection, and pinned bridge transport remain pending. See [Google Home private qualification](google-home-live-qualification.md).

## Recorded result

- TypeScript type check: passed on Node 24.14.0
- Targeted Device Atlas suite: 10 tests passed
- Full repository suite: 293 tests passed across 45 files
- Targeted ESLint: passed
- Next.js production build: passed; `/connections` and `/api/device-atlas` included
- Browser: desktop render and phone breakpoint passed; no console errors; no horizontal overflow
- Android build: 16 tests, debug assembly, and lint passed with JDK 17 / SDK 35
