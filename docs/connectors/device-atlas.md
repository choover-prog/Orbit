# Orbit Device Atlas

Device Atlas answers three questions without becoming a device dashboard:

1. Which devices has the person explicitly allowed Orbit to know about?
2. Which approved source is the safest path to observe or control each capability?
3. Which useful workflow could Orbit draft for review?

## Sprint 1 implementation

- Provider-neutral observations, device identity evidence, capabilities, candidate control paths, monitoring plans, and automation drafts.
- Fictional Google Home, Govee, Matter, and selected mDNS observations.
- Strong-evidence reconciliation and a visible unresolved count.
- Deterministic path scoring and event-first monitoring selection.
- A runtime-validated, byte-bounded, signed/fresh/replay-protected bridge message validator with an injected exact-byte signature verifier.
- An isolated Android companion with a native fixture contract, explicit consent states,
  bounded normalization, Keystore pseudonyms, and device-bound bridge signing.
- A lightweight Connections preview and `GET /api/device-atlas` fixture endpoint.

The fixture demonstrates one Govee light seen through both Google Home and Govee. Those observations merge through an explicit provider link. A second local device with the same name remains separate because a name is weak evidence.

## Permission sequence

Google Home, Govee, and local services are three independent grants. Declining one does not block the others. Local discovery defaults off in the companion. A person may select a specific advertised service without granting broad network visibility where the Android version supports it.

Orbit never guesses a password, probes arbitrary ports, or permits network addresses in the normalized model. A transient discovery implementation must discard its endpoint before creating an observation and cannot promote discovery into a control path without an approved adapter.

## Path scoring

The maximum score is 100: explicit consent 30, current availability 20, local transport 15 (hybrid 10), authoritative readback 15, reversibility 10, and event-driven updates 10. A path must also expose at least one controllable capability to become preferred. Scores explain selection; they do not grant authority.

## Native qualification checkpoint

The companion now has a compiled provider seam and a fail-closed unprovisioned
client. Live Google Home work still requires:

- the official partner-provisioned Google Home SDK artifacts;
- an Android 10 or newer physical test device;
- Google Home SDK project/app registration access;
- a consent run against a private test home;
- device count and capability reconciliation against what Google Home visibly shows;
- a pinned local transport and physical-device revocation review.

The JDK 17 / Android SDK 35 gate now passes locally. The private live-consent
checkpoint remains unqualified because SDK partner access and a physical device
require the person to be present. See
[Google Home private qualification](google-home-live-qualification.md) and the
[mobile bridge threat model](../security/google-home-mobile-bridge-threat-model.md).
