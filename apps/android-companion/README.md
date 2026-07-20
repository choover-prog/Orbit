# Orbit Android Companion

This isolated shell establishes the native boundary required by Google Home APIs without duplicating Orbit Core. Sprint 1 includes only provider-neutral contracts and a fictional inventory source. It does not include the Google Home SDK dependency, production app registration, real device access, local-network scanning, or command execution.

The checked-in manifest intentionally requests no broad local-network, location, camera, microphone, or background permissions. Future service selection should use Android's privacy-preserving network service picker where supported. Broad LAN access requires a separate consent and threat-review checkpoint.

Native build prerequisites are Android Studio 2024.2.1 or newer, JDK 17, Android SDK 35, and an Android 10 or newer test device. This workstation does not currently have that toolchain, so the shell has not been compiled here.
