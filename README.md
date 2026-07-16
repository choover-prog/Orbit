# Orbit

**Everything that matters, in Orbit.**

Orbit is an open-source, consumer-friendly personal orchestration platform. It coordinates authorized context from the services people already use, highlights what deserves attention, explains why, and helps with safe actions after clear approval.

Orbit is not another chatbot or workflow builder. The person is the center; models, email, calendars, tasks, health platforms, smart-home systems, and automation tools are replaceable providers around them.

## Product thesis

People already have the information needed for a useful assistant, but it is fragmented across services. Orbit is the coordination layer that normalizes this context and turns it into a small number of trustworthy observations and recommendations.

## First product loop

1. Connect a small set of services through familiar onboarding.
2. Begin in read-only mode.
3. Normalize authorized context into a provider-neutral model.
4. Remain quiet by default and bring one currently relevant concern into attention.
5. Reveal evidence and additional concerns only when requested or decision-relevant.
6. Draft low-risk actions and request approval when required.
7. Execute through an adapter, verify the result, and offer undo when possible.

## Discovery scope

The first phase focuses on onboarding, calendar, email, contacts, tasks, weather, optional Home Assistant and health context, a calm attention surface, conversational follow-up, and permission-aware action review.

Orbit reuses mature integrations rather than recreating every connector. The approved first implementation phase builds a production-quality mocked frontend; production integrations remain deferred.

## Project status

Orbit has completed its initial product-discovery and frontend-concept phase. Quiet Orbit, the centered-person attention pattern, and Focus-style progressive disclosure are approved for the frontend foundation. Start with the [product requirements](docs/product-requirements.md), [design principles](docs/design-principles.md), [interaction model](docs/interaction-model.md), [architecture](docs/architecture.md), and [concept comparison](docs/concept-comparison.md).

The planned assistant-motion experiment is documented as the [Orbit Presence Lab goal](docs/codex/04-presence-lab-goal.md). It should be executed only after a frontend shell exists and must remain an isolated, development-only comparison surface.

## Contributing and security

Contributions are welcome after reading [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md). Never commit credentials, private records, or real personal data.

## License

MIT License. See [LICENSE](LICENSE).
