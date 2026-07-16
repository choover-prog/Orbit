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
4. Present a daily briefing with the three things that matter most.
5. Explain the evidence behind every recommendation.
6. Draft low-risk actions and request approval when required.
7. Execute through an adapter, verify the result, and offer undo when possible.

## Discovery scope

The first phase focuses on onboarding, calendar, email, contacts, tasks, weather, optional Home Assistant and health summaries, the daily briefing, conversational follow-up, and permission-aware action review.

Orbit reuses mature integrations rather than recreating every connector. The current phase defines the product foundation and design direction; it does not implement the frontend or production integrations.

## Project status

Orbit is in its product-discovery and frontend-concept phase. Start with the [product requirements](docs/product-requirements.md), [architecture](docs/architecture.md), [user journeys](docs/user-journeys.md), and [concept comparison](docs/concept-comparison.md).

## Contributing and security

Contributions are welcome after reading [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md). Never commit credentials, private records, or real personal data.

## License

MIT License. See [LICENSE](LICENSE).
