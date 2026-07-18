# Minimal Migration Plan

## Current implementation assessment

As of July 16, 2026, Orbit has no implemented frontend framework, application routes, UI components, design tokens, conversation runtime, or runnable product shell. `src/README.md` is the only file under `src/`. The current product work consists of provider-neutral documentation and three generated concept images.

Because no live UI exists, the requested product-flow audit could not capture a runnable flow. The visual assessment is limited to the current concept artifacts in `design/concepts/`.

## Why the current concepts feel like dashboards

- Daily Orbit permanently exposes three ranked items even when only one needs attention.
- Orbit Map makes the context graph itself the interface and displays domains because they exist.
- Orbit Guide exposes a persistent workflow model instead of a temporary approval moment.
- All three treat information containers as stable page architecture rather than transient responses.
- Read-only, source, status, voice, navigation, and action controls compete simultaneously.

## Reusable inventory

### Preserve without change

- `docs/architecture.md`: provider-neutral core and adapter boundaries
- `docs/context-model.md`: evidence, observations, recommendations, actions, verification, and audit schemas
- `docs/permissions-and-trust.md`: deterministic permissions and focused approval rules
- `docs/integration-strategy.md`: mock adapters and provider isolation
- `docs/product-requirements.md`: consumer-first, read-only, evidence-backed product constraints
- `docs/user-journeys.md`: scenario and acceptance-criteria material, after presentation wording is revised
- `.github/`, contribution, security, and repository governance files

### Preserve as historical evidence

- `design/concepts/daily-orbit.png`
- `design/concepts/orbit-map.png`
- `design/concepts/orbit-guide.png`

These artifacts should be labeled superseded but retained until a revised concept is approved.

### Not yet implemented

The repository contains no typography utilities, accessibility helpers, responsive primitives, theme-token package, navigation plumbing, conversation infrastructure, action components, or mocked adapter code. The architecture for several of these exists only in documentation.

## Patterns to retire or simplify

- persistent three-item briefing as the home composition
- daily domain graph
- permanent lifecycle rail
- equal visual weight for secondary concerns
- visible domain navigation in the daily shell
- always-present evidence panels and action affordances
- status chips used to explain background system state

## Routes affected

No current frontend routes exist. After approval, introduce the smallest route set supported by the selected framework:

- `/`: resting, attention, conversation, and focused action states in one shell
- `/history`: completed, failed, verified, and undoable actions
- `/connections`: provider connections and capability permissions
- `/settings`: voice, interruption, privacy, and retention preferences

Do not create permanent daily routes for Calendar, Email, Health, or Home. Contextual domain views should render inside the main shell unless user research proves a dedicated route is necessary.

## Recommended migration strategy

**Introduce a new presentation shell while retaining the documented internals.** There is no existing implementation to restyle or refactor. Build the chosen concept as the first shell around mocked provider-neutral state rather than translating the prior dashboard images into components.

## Exact files likely to change after approval

The exact paths depend on the framework selected in the implementation goal. The current repository has no authoritative frontend path beyond `src/README.md`; therefore inventing exact component filenames now would create false certainty. The approved implementation goal should first select the stack, then replace or expand `src/README.md` and add only:

- one application entry and root shell
- one state-driven daily surface
- one focused action surface
- one conversation input primitive
- history, connections, and settings route entries
- provider-neutral mock fixtures and state adapters
- shared typography, focus, reduced-motion, and responsive tokens
- tests for the four-state experience and approval boundaries

No existing source file needs deletion.

## Risk estimate

| Area                    | Risk   | Reason                                                                        |
| ----------------------- | ------ | ----------------------------------------------------------------------------- |
| Current source code     | Low    | No frontend exists to regress                                                 |
| Product semantics       | Medium | Existing “three things” wording appears in requirements and journeys          |
| Trust architecture      | Low    | The focused action model already aligns with the revised direction            |
| Visual direction        | Medium | Calmness can become vague or conceal evidence without strong disclosure rules |
| Future framework choice | Medium | Premature file architecture would create unnecessary migration work           |

## Approval gate — satisfied

Quiet Orbit, the centered-person attention composition, and Focus-style progressive disclosure were approved on July 16, 2026. The implementation goal should build a new shell, reuse the documented models, record the stack decision in an ADR, and leave production providers mocked.
