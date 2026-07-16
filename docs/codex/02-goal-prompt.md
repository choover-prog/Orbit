# Superseded Discovery Goal

> This bootstrap-era goal produced Daily Orbit, Orbit Map, and Orbit Guide. It is preserved for provenance but is superseded by the quiet, conversation-first direction in `docs/design-principles.md`, `docs/interaction-model.md`, and `docs/concept-comparison.md`. Do not execute it as the current product direction.

# Paste after `/goal`

GOAL: Establish Orbit’s product foundation and generate three frontend concepts.

Orbit is a consumer-friendly personal orchestration platform. It connects authorized context such as email, calendar, contacts, tasks, weather, smart home, and health; determines what deserves attention; explains why; and helps the user take safe, approved actions.

The user is the center. Services orbit around them.

## Required outcomes

1. Inspect the repository and preserve all existing instructions.
2. Refine and document:
   - product vision
   - target users
   - everyday pain points
   - jobs to be done
   - product principles
   - initial scope
   - non-goals
   - success metrics
3. Define the initial architecture:
   - context providers
   - normalized context model
   - context graph
   - attention and prioritization
   - model/reasoning provider
   - policy and permissions
   - approval workflow
   - capability routing
   - execution
   - verification
   - audit and undo
4. Define provider-neutral interfaces and schemas for the core entities.
5. Define the first vertical product loop:
   - onboarding
   - connect calendar, email, contacts, tasks, and weather
   - optional Home Assistant and health context
   - read-only daily briefing
   - conversational follow-up
   - draft an action
   - request approval
   - execute through a mock adapter
   - verify result
   - offer undo where applicable
6. Create user journeys and acceptance criteria.
7. Use the Product Design workflow:
   - invoke $get-context
   - invoke $research
   - invoke $audit only if an existing UI is available
   - invoke $ideate
   - invoke $imagegen
8. Generate exactly three polished, structurally distinct frontend concept images:
   - Daily Orbit
   - Orbit Map
   - Orbit Guide
9. Compare the concepts and recommend one direction.
10. Run /review and resolve serious findings within scope.

## Product constraints

- Normal users must never need to use n8n, YAML, MCP configuration, API keys, or developer tools during ordinary onboarding.
- Prefer existing provider integrations and platforms over rebuilding connectors.
- ChatGPT/OpenAI is a reasoning provider, not the durable product boundary.
- Keep provider code behind replaceable adapters.
- Begin read-only and earn action permissions gradually.
- Deterministic policy controls authorization and approval.
- Model output is untrusted until validated.
- Health is first-class context but must not be used for diagnosis.
- Wake word is user-configurable and independent of the Orbit brand.
- Consequential actions require clear confirmation.
- Every recommendation must show evidence and reasoning.
- Every action must be audited and verified.
- Use fictional data in all concepts.
- Do not add real credentials or personal data.
- Avoid generic AI chat layouts and science-fiction visuals.
- Do not start production frontend implementation.
- Do not invoke $image-to-code.
- Do not deploy, publish, push, or open a pull request.

## Required repository artifacts

Create or refine:

- README.md
- AGENTS.md
- docs/product-context.md
- docs/product-requirements.md
- docs/user-journeys.md
- docs/architecture.md
- docs/context-model.md
- docs/permissions-and-trust.md
- docs/integration-strategy.md
- docs/design-brief.md
- docs/concept-comparison.md
- design/concepts/daily-orbit.png
- design/concepts/orbit-map.png
- design/concepts/orbit-guide.png

Use Mermaid diagrams where architecture or flows benefit from visualization.

## Design concepts

### Daily Orbit

A briefing-first home screen focused on the three things that matter today. Include voice entry, evidence, recommended actions, and calm progressive disclosure.

### Orbit Map

A context-centered workspace showing the user and household at the center, connected domains around them, active signals, and a conversational side panel. It must remain understandable rather than becoming a decorative network diagram.

### Orbit Guide

A lifecycle-oriented experience that clearly moves an item through:
observation → recommendation → draft → approval → execution → verification → undo.

## Stop condition

Stop after documentation, schemas, user journeys, three frontend concept images, comparison, recommendation, and review are complete.

Return:

1. Repository assessment
2. Product definition
3. Recommended architecture
4. First vertical slice
5. Created and modified files
6. Three generated concept images
7. Concept comparison
8. Recommended direction
9. Open questions and risks
10. Proposed next `/goal` for implementing the selected concept
