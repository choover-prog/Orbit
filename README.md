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

Orbit reuses mature integrations rather than recreating every connector. The frontend foundation keeps its scheduling journey mocked. Stage 2a adds one narrowly scoped exception: an optional, read-only Open-Meteo weather sandbox behind Orbit's provider-neutral server boundary. Personal connectors and production integrations remain deferred.

## Project status

Orbit has completed its initial product-discovery and frontend-concept phase. Quiet Orbit, the centered-person attention pattern, and Focus-style progressive disclosure are implemented as a frontend foundation. Fixture-default weather context now exercises normalization, provenance, freshness, connection health, and stale suppression; live mode uses only a fixed fictional coarse location and requires no credential. Start with the [product requirements](docs/product-requirements.md), [frontend architecture](docs/frontend/frontend-architecture.md), [interaction model](docs/interaction-model.md), [architecture](docs/architecture.md), and [roadmap](docs/roadmap.md).

The assistant-motion experiment is documented as the [Orbit Presence Lab goal](docs/codex/04-presence-lab-goal.md) and implemented as an isolated, development-only comparison surface. No permanent Presence winner has been selected.

## Local development

Requires Node.js 24. The repository includes an `.nvmrc` for selecting
the supported runtime with a compatible Node version manager.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The development-only Presence Lab is available at `http://localhost:3000/design-lab/presence`.

Weather uses deterministic fixtures by default and performs no network request. To evaluate the read-only Open-Meteo sandbox, opt in when starting the development server:

```bash
ORBIT_WEATHER_MODE=live npm run dev
```

In PowerShell:

```powershell
$env:ORBIT_WEATHER_MODE = "live"
npm run dev
```

Open `http://localhost:3000/?context=weather` to focus the weather example, or inspect the normalized no-store response at `http://localhost:3000/api/orbit/snapshot?context=weather`. Live mode uses the fixed fictional `Harbor City test area`, displays [Open-Meteo](https://open-meteo.com/) attribution with transformed results, and is for local evaluation only. It is not a safety-alert service and the free endpoint has no production service-level agreement. See the [weather sandbox](docs/connectors/weather.md) and [live-context threat model](docs/security/live-context-threat-model.md).

Run the full local validation bundle with:

```bash
npm run check
npm run test:e2e
```

## Contributing and security

Contributions are welcome after reading [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md). Never commit credentials, private records, or real personal data.

## License

MIT License. See [LICENSE](LICENSE).
