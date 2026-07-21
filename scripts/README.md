# Scripts

Repository maintenance and validation scripts may be added here when they have
a documented, repeatable purpose.

`qualify-google-calendar.mjs` performs the privacy-preserving preflight and
connected/disconnected checks for the private Calendar live qualification. It
prints connector health and counts only; it never prints OAuth values, event
content, normalized records, or vault ciphertext.

`bootstrap-macos.sh` is the staged, interactive Apple-silicon Mac mini
bootstrap for a Home Assistant OS VM, Codex, Node 24, and an Orbit development
checkout. Its Stage 2c phase also installs JDK 17, Android SDK 35, Android
Studio, and checks the external Nest, Google Home SDK, and physical-device
gates. It is safe to rerun and supports phase-specific and dry-run modes. See
`docs/setup/mac-mini-home-assistant.md` before using it.
