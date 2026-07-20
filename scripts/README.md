# Scripts

Repository maintenance and validation scripts may be added here when they have
a documented, repeatable purpose.

`qualify-google-calendar.mjs` performs the privacy-preserving preflight and
connected/disconnected checks for the private Calendar live qualification. It
prints connector health and counts only; it never prints OAuth values, event
content, normalized records, or vault ciphertext.

`bootstrap-macos.sh` is the staged, interactive Apple-silicon Mac mini
bootstrap for a Home Assistant OS VM, Codex, Node 24, and an Orbit development
checkout. It is safe to rerun and supports phase-specific and dry-run modes.
See `docs/setup/mac-mini-home-assistant.md` before using it.
