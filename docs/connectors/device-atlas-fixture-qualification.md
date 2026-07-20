# Device Atlas fixture qualification

- Status: TypeScript fixture qualified; native qualification pending
- Date: 2026-07-19

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
- bridge messages reject invalid signatures, stale timestamps, and replayed sequences;
- the Connections panel communicates privacy and simulated authority;
- the fixture API is non-cacheable.

## Native evidence pending

Kotlin compilation, Android accessibility inspection, Google Home SDK permission selection, real inventory count, foreground/background behavior, and physical-device bridge transport remain pending because this workstation does not have Android Studio, a JDK 17 development kit, or Android SDK installed.

## Recorded result

- TypeScript type check: passed on Node 24.14.0
- Targeted Device Atlas suite: 10 tests passed
- Full repository suite: 283 tests passed across 44 files
- Targeted ESLint: passed
- Next.js production build: passed; `/connections` and `/api/device-atlas` included
- Browser: desktop render and phone breakpoint passed; no console errors; no horizontal overflow
- Android build: not run; required toolchain is absent
