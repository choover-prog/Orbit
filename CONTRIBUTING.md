# Contributing to Orbit

Orbit welcomes thoughtful contributions that preserve its consumer-first and privacy-first boundaries.

## Before contributing

1. Read `AGENTS.md` and the relevant documents under `docs/`.
2. Open or reference an issue before substantial work.
3. Keep changes small, provider-neutral, and testable.
4. Use fictional data in examples, tests, and screenshots.

## Development expectations

- Keep provider APIs behind adapters.
- Treat model output as untrusted input.
- Use deterministic code for authorization, approval, execution state, verification, and audit.
- Default new capabilities to read-only.
- Add tests for behavior and policy changes.
- Never commit secrets, private records, or personal data.

## Pull requests

Explain the user problem, scope, risk, validation, and any privacy implications. A pull request should not mix unrelated product, architecture, and formatting changes.
