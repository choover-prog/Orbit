# Orbit Repository Guidance

## Product purpose

Orbit is a personal orchestration platform that helps everyday people benefit from AI without requiring them to understand prompts, agents, connectors, workflow builders, or infrastructure.

The user is the center. Email, calendar, contacts, health, smart home, notes, files, tasks, location, weather, and future services orbit around the user.

Orbit should answer four questions:

1. What changed?
2. What matters?
3. What should I do?
4. Can Orbit safely help?

## Product principles

- Build for normal consumers, not only developers.
- Setup should feel like onboarding a phone, not configuring a server.
- Hide infrastructure such as MCP, Home Assistant, workflow engines, and API credentials wherever possible.
- Begin read-only and earn permission to act.
- Prefer existing connectors and platforms over rebuilding integrations.
- Treat ChatGPT or another LLM as a replaceable reasoning provider, not the product itself.
- Orbit owns onboarding, context normalization, prioritization, permissions, approval, audit, and undo.
- Voice is a primary interface, but the wake word is user-configurable.
- Health is a first-class context domain, but Orbit must not diagnose or present medical guesses as facts.
- Consequential actions require explicit permission and appropriate confirmation.
- Every action should be explainable, auditable, and reversible where possible.
- Do not expose secrets, private records, personal notes, credentials, or real user data in examples, fixtures, screenshots, or commits.
- Avoid science-fiction UI clichés. Orbit should feel calm, modern, trustworthy, useful, and fun.

## Action ladder

Use this progression when designing capabilities:

1. Observe
2. Summarize
3. Recommend
4. Draft
5. Simulate
6. Request approval
7. Execute
8. Verify
9. Offer undo

Do not skip directly from observation to execution for risky actions.

## Architectural boundaries

### Orbit Core

Owns:
- normalized context model
- household and relationship model
- attention and prioritization engine
- permissions and policy
- approval state
- audit history
- action verification
- undo metadata
- provider-neutral interfaces

### Providers and adapters

Examples:
- ChatGPT/OpenAI
- email
- calendar
- contacts
- tasks
- Home Assistant
- health platforms
- notes and knowledge systems
- weather and location
- workflow engines

Adapters should be replaceable. Domain-specific APIs must not leak throughout Orbit Core.

### User experience

Owns:
- onboarding
- connection setup
- permission education
- daily briefings
- voice interactions
- proactive suggestions
- status and trust indicators
- action review
- history and undo

## Engineering guidance

- Inspect existing repository conventions before adding dependencies or structure.
- Prefer small, explicit interfaces and vertical slices.
- Keep provider-specific code behind adapters.
- Separate deterministic policy from probabilistic model output.
- Treat model output as untrusted input.
- Use structured schemas for intents, evidence, recommendations, approvals, actions, and results.
- Preserve an audit trail for every tool invocation.
- Make read-only mode the default.
- Mock external providers during early product and UI work.
- Do not implement broad connector coverage during the initial phase.
- Do not build a custom LLM, speech model, workflow engine, or smart-home platform.
- Do not deploy or publish without explicit instruction.

## Design guidance

- Use Orbit’s visual metaphor carefully: center, paths, relationships, movement, and calm coordination.
- Do not cover every screen in orbital rings.
- Prioritize clarity over visual novelty.
- Show why a recommendation exists.
- Make confidence, permissions, and pending approval obvious.
- Spoken responses should be brief by default and expandable on request.
- Generate multiple structurally distinct concepts before coding the frontend.

## Definition of done for discovery and concept phase

- Repository context and assumptions documented.
- Product requirements and non-goals documented.
- Architecture and provider boundaries documented.
- Initial everyday-user journeys documented.
- Initial design brief documented.
- Three structurally distinct frontend concepts generated.
- One recommended concept identified, but no frontend implementation started.
