# Scripts

Repository maintenance and validation scripts may be added here when they have
a documented, repeatable purpose.

`qualify-google-calendar.mjs` performs the privacy-preserving preflight and
connected/disconnected checks for the private Calendar live qualification. It
prints connector health and counts only; it never prints OAuth values, event
content, normalized records, or vault ciphertext.
