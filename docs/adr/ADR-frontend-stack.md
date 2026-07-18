# ADR: Frontend Stack

- Status: Accepted
- Date: 2026-07-16
- Decision owners: Orbit maintainers

## Context

Orbit needs a TypeScript-first frontend that can begin as a fully mocked, local application while preserving a credible path to authenticated routes, OAuth callbacks, connector APIs, and installable-app behavior. The repository has no existing application framework or package conventions.

The foundation must support five routes, a stateful mocked scheduling flow, responsive and accessible interaction, semantic SVG/CSS Presence animation, an isolated high-fidelity raster Presence experiment, component tests, and browser-level end-to-end tests. It must not introduce a production backend or provider credentials.

## Decision

Use the current stable Next.js App Router with React and TypeScript.

- Next.js App Router for file-based routes, layouts, metadata, and future server-side boundaries.
- React client components only where live interaction requires them; keep domain contracts and deterministic policy independent of React.
- CSS Modules plus a small global token layer. Do not add Tailwind or a component framework.
- Vitest, React Testing Library, and `jest-axe` for unit/component/accessibility tests.
- Playwright for route coverage, the complete mocked scheduling journey, responsive checks, and console-error inspection.
- ESLint and Prettier for contributor-friendly static checks.

Initial dependency versions are pinned by `package-lock.json`. The implementation requires Node.js 20.9 or newer.

## Why this fits Orbit

- TypeScript and file-system routing are first-class.
- A client-only mocked experience can ship now without inventing a backend.
- Route Handlers provide a later boundary for OAuth callbacks, connector webhooks, and authenticated APIs without changing the presentation framework.
- Next.js supports SPA and installable-app patterns, leaving deployment topology open.
- React, CSS, and inline SVG are sufficient for the core Presence family; the experimental Morph variant may use state-specific alpha WebP sequences when that is necessary to preserve approved material fidelity. No animation runtime dependency is required, and the larger raster budget is a lab-only promotion constraint rather than a production-default commitment.
- Vitest and Playwright cover deterministic state logic, components, routes, and full journeys with familiar open-source tooling.

## Alternatives considered

### Vite with React Router

Smaller as a pure client application, but Orbit would need to select and integrate a server boundary later for OAuth callbacks and authenticated connector APIs. That creates a foreseeable architecture decision the Next.js route model already accommodates.

### Remix / React Router framework mode

Strong routing and server boundaries, but it offers no material advantage for this mocked foundation and would give early contributors a less conventional path for the expected Next.js-style route-handler use cases.

### Tailwind or a component framework

Rejected for the foundation. Orbit's visual system is small, bespoke, and token-driven; another styling abstraction would add vocabulary before repetition justifies it.

## Consequences

- The main experience is interactive and therefore uses a bounded client feature shell.
- Administrative pages can remain server-rendered until they need local interactivity.
- Provider-neutral contracts live outside `src/app` so future adapters do not couple to route components.
- Real authentication, connector APIs, persistence, and deployment remain explicitly deferred.

## Sources

- [Next.js App Router documentation](https://nextjs.org/docs/app)
- [Next.js installation and system requirements](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js testing guide](https://nextjs.org/docs/app/guides/testing)
- [Next.js backend-for-frontend and callback guidance](https://nextjs.org/docs/app/guides/backend-for-frontend)
