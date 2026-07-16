# Orbit frontend source

- `app/`: Next.js routes and global presentation tokens.
- `components/`: reusable product primitives, including the shared Orbit Presence API.
- `domain/`: provider-neutral contracts and deterministic policy helpers.
- `features/`: bounded daily-shell and design-lab feature components.
- `mocks/`: fictional fixtures, adapters, and browser-local demo history.

Provider response objects must be translated before reaching product components. Real credentials, external calls, and persistence do not belong in this mocked foundation.
