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

Orbit reuses mature integrations rather than recreating every connector. The
frontend foundation keeps its scheduling action journey mocked. Stage 2a adds
an optional read-only Open-Meteo sandbox. Stage 2b adds a local-only,
read-only Google Calendar vertical slice with explicit consent, PKCE, encrypted
Windows storage, bounded synchronization, and deterministic overlap attention.
It is not a hosted production integration.

## Project status

Orbit has completed its initial product-discovery and frontend-concept phase.
Quiet Orbit, the centered-person attention pattern, and Focus-style progressive
disclosure are implemented as a frontend foundation. Fixture-default weather
and Calendar connectors exercise normalization, provenance, freshness, health,
and stale suppression offline. Google Calendar can be enabled for one local
Windows user with that user's own OAuth client; it remains read-only. Start with
the [product requirements](docs/product-requirements.md), [frontend architecture](docs/frontend/frontend-architecture.md), [interaction model](docs/interaction-model.md), [architecture](docs/architecture.md), and [roadmap](docs/roadmap.md).

The assistant-motion experiment is documented as the [Orbit Presence Lab goal](docs/codex/04-presence-lab-goal.md) and implemented as an isolated, development-only comparison surface. No permanent Presence winner has been selected.

## Local development

Requires Node.js 24. The repository includes an `.nvmrc` for selecting
the supported runtime with a compatible Node version manager.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`. The development-only Presence Lab is available at `http://127.0.0.1:3000/design-lab/presence`.

Weather uses deterministic fixtures by default and performs no network request. To evaluate the read-only Open-Meteo sandbox, opt in when starting the development server:

```bash
ORBIT_WEATHER_MODE=live npm run dev
```

In PowerShell:

```powershell
$env:ORBIT_WEATHER_MODE = "live"
npm run dev
```

Open `http://127.0.0.1:3000/?context=weather` to focus the weather example, or inspect the normalized no-store response at `http://127.0.0.1:3000/api/orbit/snapshot?context=weather`. Live mode uses the fixed fictional `Harbor City test area`, displays [Open-Meteo](https://open-meteo.com/) attribution with transformed results, and is for local evaluation only. It is not a safety-alert service and the free endpoint has no production service-level agreement. See the [weather sandbox](docs/connectors/weather.md) and [live-context threat model](docs/security/live-context-threat-model.md).

Google Calendar is disconnected fixture data by default and makes no Google
request. The offline lifecycle can be exercised from `/connections`. For one
local live evaluation, create a Google Desktop OAuth client, enable Calendar
API, copy `.env.example` to ignored `.env.local`, then set:

```dotenv
ORBIT_GOOGLE_CALENDAR_MODE=live
ORBIT_GOOGLE_CALENDAR_CLIENT_ID=your-local-desktop-client-id
ORBIT_GOOGLE_CALENDAR_REDIRECT_URI=http://127.0.0.1:3000
```

Start Orbit, open `http://127.0.0.1:3000/connections`, and read the disclosure
before connecting. Orbit requests only owned primary-calendar event read access,
stores the refresh token with Windows DPAPI, and never requests Calendar write
access. Only consent completion and an explicit **Refresh now** contact Google;
ordinary pages use the local cache. The app rejects non-`127.0.0.1` Host headers
to protect the unauthenticated local service from browser DNS rebinding. See the [connector guide](docs/connectors/google-calendar.md),
[authorization ADR](docs/adr/ADR-google-calendar-local-auth.md), and
[threat model](docs/security/google-calendar-threat-model.md).

Run the full local validation bundle with:

```bash
npm run check
npm run test:e2e
```

## Contributing and security

Contributions are welcome after reading [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md). Never commit credentials, private records, or real personal data.

## License

MIT License. See [LICENSE](LICENSE).
