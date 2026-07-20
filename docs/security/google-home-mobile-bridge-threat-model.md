# Google Home mobile bridge threat model

## Assets and trust boundaries

Assets are the person's selected-home consent, device and room labels, provider identifiers, normalized inventory, bridge signing key, pairing public key, sequence state, and the local Orbit process. Google Home SDK objects remain inside the Android adapter. Only bounded provider-neutral observations may cross the bridge.

## Threats and controls

| Threat | Control | Residual checkpoint |
| --- | --- | --- |
| Consent confused with Orbit authority | Provider-owned consent screen; explicit local state; no read before `GRANTED` | Validate copy and partial selection on device |
| Excessive provider scope | Home platform scope v1; only selected structures/devices; exported capability is connectivity only | Verify SDK registration requests no advanced camera scope |
| Raw provider IDs become durable identity | Non-exportable Keystore HMAC pseudonymization; raw SDK records are transient | Inspect live adapter for logging and crash-report leakage |
| Impersonated companion | P-256 device-bound signing key; public-key fingerprint pairing; exact-byte verification server-side | Design the out-of-band fingerprint confirmation UI |
| Cross-session or reordered replay | Signature domain binds the authenticated session ID; monotonic per-session sequence plus server replay guard and freshness window | Persist server session state across local restarts before production |
| Malicious or oversized payload | 256 KiB and 250-observation bounds; strict runtime schema; bounded strings and arrays | Fuzz the final serializer and transport parser |
| Local bridge interception | Cleartext disabled; explicit endpoint only; certificate/public-key pin required by final transport | Transport implementation and certificate lifecycle remain pending |
| Revoked provider access still appears active | Permission recheck before inventory; empty/revoked state deletes local inventory | Validate provider revocation latency on physical device |
| Disconnect leaves linkable data | Delete HMAC key, bridge signing key, session ID, sequence, and local inventory | Verify uninstall/reinstall and backup behavior on device |
| LAN scanning or lateral movement | No location, nearby-device, multicast, or discovery permission; no port probing | Any discovery proposal requires a new threat review |
| Device command hidden in inventory | SDK seam exposes only permission and `readSelectedDevices`; normalized capabilities are observe-only | Review future adapter imports for command/automation APIs |
| Camera, microphone, or background collection | No manifest permissions or background components; no camera/voice SDK types | Re-review manifest and dependency graph before every release |

## Security invariants

1. A denied, unavailable, revoked, or uninitialized provider state yields no inventory.
2. Provider IDs never leave the Android adapter unhashed.
3. Signing keys and HMAC keys are non-exportable and deleted on local disconnect.
4. A bridge session accepts only the next sequence and signs the exact payload bytes in a domain bound to its authenticated session ID.
5. Local discovery remains off and no endpoint is inferred from household traffic.
6. This slice cannot issue commands, activate automations, stream media, or run unattended.

## Deferred review

The live SDK adapter, physical-device behavior, pinned transport, Android backup/uninstall semantics, session enrollment UX, and private consent evidence require a second review after the authenticated SDK download and app registration. No personal values belong in the repository or CI artifacts.
