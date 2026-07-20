# Google Home private qualification

- Status: qualification harness complete; authenticated SDK download and physical consent checkpoint pending
- Date: 2026-07-20
- Data classification: no personal inventory captured or committed

## Completed locally

- Installed and verified a portable JDK 17 and Android SDK 35 toolchain without machine-wide configuration.
- Verified the official Android Studio 2026.1.2.10 archive against Google's published SHA-256.
- Compiled the companion, built a debug APK, ran 16 native unit tests, and passed Android lint.
- Added explicit connect, refresh, local disconnect, denial, revocation, unavailable, and error states.
- Added a provider-neutral `GoogleHomeSdkClient` boundary and conservative inventory normalizer.
- Enforced 250-observation and text bounds, duplicate removal, exact connectivity mapping, and HMAC-pseudonymized provider identities.
- Added P-256 Android Keystore bridge signing, public-key pairing metadata, session-bound signature domains, payload byte bounds, monotonic sequences, and destructive local disconnect.
- Kept local discovery off and requested no location, nearby-device, camera, microphone, multicast, or background permission.

## SDK access finding

Google's Home APIs are in public beta. The current sample app declares Home API version 17.1.0, but Maven resolution from Google's public repository returns no artifact. Google's setup guide directs a signed-in developer to download the SDK through Google Home Developers and install it in a local Maven repository. Orbit does not substitute an invented coordinate, copy an SDK from an untrusted source, or commit the downloaded libraries.

This means the checked-in build uses `UnprovisionedGoogleHomeSdkClient` and fails closed. The real adapter must be added only after the official artifact is available locally and must implement the existing primitive seam. Google SDK types may not enter `CompanionInventory`, the bridge payload, Orbit Core, logs, screenshots, or fixtures.

## Private live-consent checkpoint

With the person present:

1. Obtain the official Home APIs SDK through the Google Home Developers account.
2. Register `app.orbit.companion` and configure the Web OAuth client locally.
3. Install the debug build on an Android 10+ device already signed into the private test home.
4. Select a deliberately small test structure/device set in Google's permission screen.
5. Reconcile the selected count and categories against the Google Home app without recording device names, room names, provider IDs, screenshots, or account identifiers.
6. Exercise denial, partial selection, provider revocation, offline, empty-home, refresh, app restart, and local disconnect.
7. Pair only to an explicitly chosen local Orbit endpoint, confirm the public-key fingerprint out of band, send a redacted synthetic payload first, and reject replay or a changed key.
8. Record only pass/fail counts and redacted timestamps in this file.

No device command, automation activation, camera or microphone access, background monitoring, or network discovery is permitted during this checkpoint.

## Evidence

| Gate | Result |
| --- | --- |
| Microsoft OpenJDK 17.0.19 | passed |
| Android SDK 35 / build tools 35.0.0 | passed |
| `testDebugUnitTest` | 16 tests passed |
| `assembleDebug` | passed |
| `lintDebug` | passed |
| Node 24 lint and type check | passed |
| Full web suite | 293 tests passed across 45 files |
| Next.js production build | passed |
| Official SDK resolution | pending authenticated Google Home Developers download |
| Physical-device consent | pending person and device |
| Private inventory reconciliation | pending consent |

Official references: [Android SDK setup](https://developers.home.google.com/apis/android/sdk), [initialize Home APIs](https://developers.home.google.com/apis/android/initialize), [permissions](https://developers.home.google.com/apis/android/permissions), and [device API](https://developers.home.google.com/apis/android/device).
