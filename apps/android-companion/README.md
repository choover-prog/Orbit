# Orbit Android Companion

This isolated app is the native boundary for Google Home APIs. Orbit Core never receives Google SDK objects. The checked-in app owns consent state, read-only inventory normalization, provider-ID pseudonymization, and a device-bound bridge signing session.

## Authority

- Google Home access is off until the person opens Google's consent screen.
- Inventory contains only selected structures and devices.
- The normalized contract exports connectivity only; it exposes no command, automation, camera, microphone, background, or LAN-scanning authority.
- Provider IDs are HMAC-pseudonymized with a non-exportable Android Keystore key.
- Bridge payloads are signed by a non-exportable P-256 Android Keystore key and use a monotonic session sequence.
- Removing the local connection destroys inventory pseudonyms, the signing key, and session metadata. Provider consent is managed in Google Home.

The manifest requests only internet access and network-state visibility. It explicitly disables cleartext traffic and backups. It requests no location, nearby-device, camera, microphone, multicast, or background permissions.

## Build

Prerequisites: JDK 17 and Android SDK 35.

```powershell
./gradlew.bat testDebugUnitTest assembleDebug lintDebug
```

The July 20, 2026 workstation qualification used Microsoft OpenJDK 17.0.19, Android command-line tools 14742923, platform 35, build tools 35.0.0, and Gradle 8.11.1. All 16 native tests, debug assembly, and Android lint passed.

## Google Home SDK checkpoint

`GoogleHomeSdkClient` is the one permitted provider seam. `GoogleHomeSdkInventorySource` converts its primitive records into `CompanionInventory`; `UnprovisionedGoogleHomeSdkClient` fails closed in ordinary builds.

Google's Home APIs are in public beta. The official sample currently declares `com.google.android.gms:play-services-home:17.1.0` and `play-services-home-types:17.1.0`, but those artifacts are not available from the public Google Maven endpoint used by this machine. Google's SDK setup documentation directs a signed-in developer to download the SDK from Google Home Developers and host it in a local Maven repository. Do not commit those artifacts or OAuth identifiers.

The live adapter and consent run therefore require the person to provide, locally:

1. Google Home Developers access and the official SDK artifacts;
2. a registered Android application and Web OAuth client ID;
3. an Android 10+ physical device signed into the private test home;
4. an explicit Google Home permission selection.

Until those four conditions are present, the app truthfully reports that the provider is unavailable and makes no Google request.
