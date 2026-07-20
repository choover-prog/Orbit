# ADR: Device Atlas and the Android companion boundary

- Status: Accepted; fixture and native harness qualified, private live consent pending
- Date: 2026-07-19

## Context

Most of the initial household devices are visible in Google Home, while some manufacturers such as Govee expose richer direct capabilities. Google Home APIs are native Android/iOS SDKs rather than a server REST replacement. Local discovery can add useful paths, but an indiscriminate port scanner would create privacy, security, battery, and trust problems without proving that Orbit can safely control a device.

## Decision

Orbit will build one provider-neutral Device Atlas and treat every provider as an observation source:

1. The Android companion requests Google Home permission for a selected home and devices and emits normalized observations.
2. A direct Govee adapter may add capability and event observations after separate consent.
3. Local discovery begins with Android's privacy-preserving selected-service flow. Broad LAN access is off and requires a later explicit checkpoint.
4. Device observations merge only through strong provider links, Matter node identity, manufacturer serial identity, or explicit user confirmation. Network endpoints are prohibited from the normalized model; names and service labels are insufficient by themselves.
5. Orbit scores candidate paths deterministically from consent, confirmed-online availability, locality, readback verification, reversibility, and adapter-declared event support.
6. Event subscriptions are preferred only when an adapter declares them for that observation. Polling is bounded to a documented interval and active use. Unknown-status devices remain observe-only.
7. Automation output stops at draft and simulation. Activation and command execution require future approval, execution, verification, audit, and undo work.

The local bridge protocol is versioned, runtime-schema and byte bounded, freshness checked, and replay protected. The authenticated session identifier is transport metadata; sequence, capture time, and observations exist only inside the signed payload. Signatures cover the exact received bytes before strict UTF-8 decoding rather than a language-specific reserialization. There is no ingest route until device-bound key storage and transport are implemented and reviewed.

## Consequences

- Orbit Core stays independent of Google Home, Govee, Matter, Android, and Home Assistant objects.
- One physical device can have several paths while presenting one understandable identity.
- Conservative reconciliation can leave duplicates for user review; this is safer than silently controlling the wrong device.
- The native harness now compiles and passes tests/lint with JDK 17 and Android SDK 35. Private live work still needs the authenticated Google Home Developers SDK download, app/OAuth registration, and a physical Android 10+ device.
- Home Assistant remains an optional future adapter, not a prerequisite.

## References

- [Google Home APIs for Android](https://developers.home.google.com/apis/android/overview)
- [Google Home data model](https://developers.home.google.com/apis/android/data-model)
- [Google Home permissions](https://developers.home.google.com/apis/android/permissions)
- [Android network service discovery](https://developer.android.com/develop/connectivity/wifi/use-nsd)
- [Android local-network permission](https://developer.android.com/privacy-and-security/local-network-permission)
- [Govee developer platform](https://developer.govee.com/)
