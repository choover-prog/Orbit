# Frontend Foundation Implementation Plan

## Approved target

Build Quiet Orbit as a responsive daily shell. Use the centered-person composition only to show the active relationship between Maya and one relevant concern. Use Focus-style rows and progressive disclosure for questions, evidence, options, and action review. All context and execution remain fictional and mocked.

## Requirement map

| Requirement               | Planned implementation                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily experience          | `src/app/page.tsx` mounts one state-driven `QuietOrbitShell` for resting, attention, conversation, action, completed, error, and undo states.              |
| Centered-person attention | `src/features/orbit/components/CenteredAttention.tsx` renders Maya as initials with one focal concern and restrained supporting facts.                     |
| Progressive conversation  | `src/features/orbit/components/ConversationScene.tsx` reveals reason, evidence, options, and proposal without accumulating a chat transcript.              |
| Safe action lifecycle     | `src/domain/orbit/` defines provider-neutral contracts and deterministic transitions; `src/mocks/` supplies fictional context and a mock calendar adapter. |
| History                   | `src/app/history/page.tsx` presents mocked audit, verification, and undo status.                                                                           |
| Connections               | `src/app/connections/page.tsx` presents mocked connection health and capability scopes.                                                                    |
| Settings                  | `src/app/settings/page.tsx` presents local-only motion, voice, privacy, and accessibility preferences.                                                     |
| Orbit Presence            | `src/components/orbit-presence/` owns one component API, five variants, eight states, reduced motion, and local selection.                                 |
| Presence Lab              | `src/app/design-lab/presence/page.tsx` provides controls, comparison, contexts, and replayable sequence mode.                                              |
| Visual system             | `src/app/globals.css` and colocated CSS Modules define warm neutral tokens, responsive type, focus, layout, and motion.                                    |
| Validation                | `src/**/*.test.ts(x)` covers domain and components; `e2e/` covers routes, accessibility smoke checks, responsive views, and the full scheduling journey.   |

## Route behavior

- `/`: one focal experience; conventional navigation remains visually quiet.
- `/history`: resolved observations, verification, audit events, and undo entry.
- `/connections`: mocked provider connections and capability-level permissions.
- `/settings`: local preferences only; no account or backend persistence.
- `/design-lab/presence`: development comparison surface; it is omitted from primary navigation outside development.

## Commit sequence

1. Stack, tokens, contracts, and mocked action lifecycle.
2. Quiet Orbit shell and scheduling journey.
3. Presence component system and lab.
4. Administrative routes, documentation, and tests.
5. QA and review repairs.

## Validation gates

- Format, lint, type checking, unit/component tests, production build, and Playwright pass.
- Desktop, tablet, and phone screenshots preserve one focal concern and reachable input.
- Keyboard-only scheduling flow, live-region announcements, reduced motion, and no-color-only states are verified.
- Reference and rendered screenshots pass Product Design QA with no P0, P1, or P2 findings.
- No production credentials, provider calls, microphone stream, authentication, database, or deployment code is introduced.
