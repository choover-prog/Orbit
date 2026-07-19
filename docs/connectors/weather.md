# Weather Connector Sandbox

- Status: Experimental, read-only
- Provider: Open-Meteo
- Default mode: Fixture
- Live mode: Explicit local opt-in

## Purpose

Weather is Orbit's first live-context connector because it can exercise the server boundary, normalization, provenance, freshness, attention policy, and degraded states without introducing OAuth or write authority. The experiment is deliberately impersonal: it uses a fixed, coarse test location and never requests browser geolocation.

This connector is not a production weather service and is not a safety alerting system. It demonstrates how provider data becomes trustworthy Orbit evidence.

## User outcome

In fixture mode, Orbit presents a deterministic weather example suitable for tests and demos. In live mode, Orbit may surface one calm, read-only weather concern when a deterministic threshold is crossed. Ordinary conditions produce no weather attention item. The existing fictional travel and meeting scenario remains the default focal demonstration.

Weather cannot propose, approve, execute, verify, or undo an external action.

## Modes

| Mode      | Network | Location                    | Intended use                         |
| --------- | ------- | --------------------------- | ------------------------------------ |
| `fixture` | None    | Fictional fixture data      | Default, tests, builds, contributors |
| `live`    | Server  | Fixed coarse public test point | Local evaluation only             |

`ORBIT_WEATHER_MODE` accepts `fixture` or `live` and defaults to `fixture`. Any unsupported value fails closed instead of silently enabling network access.

Live mode uses the server-owned test label `Harbor City test area` and the coarse test point `40.0, -83.0`. These values are not derived from a person, device, account, IP address, or browser signal. The client cannot override them.

## Provider request boundary

The adapter calls only Open-Meteo's fixed Forecast API origin:

```text
https://api.open-meteo.com/v1/forecast
```

The server constructs an allowlisted query for current conditions and a bounded hourly forecast. The requested fields are limited to the values needed for the experiment, including temperature, apparent temperature, humidity, precipitation, precipitation probability, WMO weather code, wind speed, wind gusts, and day/night state. Units are selected explicitly.

The endpoint URL, forecast horizon, fields, units, and coordinates are not accepted from a browser request. The adapter uses a four-second request timeout, caps the streamed provider response at 128 KiB, and does not perform foreground retry loops.

## Normalization

Open-Meteo responses remain inside the adapter. The adapter validates the response before creating provider-neutral records containing:

- the fictional location label;
- observed and retrieved times;
- normalized current conditions;
- a bounded forecast window;
- source provenance and attribution;
- freshness deadline;
- connector health and typed error state.

Open-Meteo describes its current conditions as modeled values based on 15-minute weather model data. Orbit labels them as modeled conditions rather than direct station observations. Unknown WMO weather codes map to the neutral label `Unrecognized conditions` instead of being guessed.

## Freshness and cache behavior

- A successful response is fresh for at most 15 minutes and never beyond 30 minutes after its modeled observation time.
- The cache is held in process memory only and is keyed to the single fixed test request.
- A fresh cached result may satisfy repeated requests without contacting the provider.
- If a refresh fails and a previously validated result exists, Orbit may return it with an explicit `stale` health and freshness state.
- Stale evidence may be inspected, but it cannot create a new attention candidate or support an action.
- If no validated result exists, Orbit reports the connector as unavailable or misconfigured.
- Process restart clears the cache. There is no background synchronization or durable provider store in this experiment.

Rate limits, timeouts, non-success responses, and invalid payloads are translated into stable Orbit failure codes. Numeric and HTTP-date `Retry-After` values are normalized into a bounded local backoff. Provider response bodies are not copied into user-facing errors or logs.

On managed Windows networks that install a trusted TLS inspection certificate, Node 24 may need `NODE_USE_SYSTEM_CA=1` for local live-mode evaluation. Do not disable TLS verification. Fixture mode requires no network or certificate configuration.

## Deterministic attention policy

Attention eligibility is evaluated from normalized, fresh values without a model call. The policy may create at most one weather candidate from the bounded forecast. Examples include a high probability of precipitation, an extreme apparent temperature, or strong wind gusts. If no threshold is crossed, weather remains quiet.

The policy must not infer personal plans, travel, health effects, or urgency from weather alone. A later connector-backed journey may combine weather with separately authorized context through an explicit, tested policy.

## Attribution and licensing

Weather evidence displays the attribution **Weather data by [Open-Meteo.com](https://open-meteo.com/)** near the transformed result. Open-Meteo publishes weather data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); Orbit indicates that the provider values have been normalized and transformed.

The Open-Meteo open-access endpoint is intended for non-commercial evaluation and publishes fair-use limits without a service-level agreement. It is appropriate for this local sandbox, not a production commitment. Provider terms, capacity, licensing, and support must be reviewed before commercial or hosted use.

Official provider references:

- [Forecast API documentation](https://open-meteo.com/en/docs)
- [API pricing and limits](https://open-meteo.com/en/pricing)
- [Terms and privacy](https://open-meteo.com/en/terms)
- [Data licence](https://open-meteo.com/en/licence)

## Privacy and logging

- No browser geolocation is requested.
- No exact or personal location is collected, retained, or sent to Open-Meteo.
- No user account, API key, OAuth grant, or token is required for the sandbox.
- Raw provider payloads are not persisted.
- Logs contain stable connector identifiers and typed outcomes, not response bodies or personal records.
- Weather values are not inserted into prompts or sent to a reasoning provider.

## Explicitly deferred

- user-selected or device-derived locations;
- severe-weather alerts or safety-critical notifications;
- OAuth and secret storage;
- background synchronization and durable cache;
- production quotas, billing, and service-level guarantees;
- personalization that combines weather with calendar, health, home, or location history;
- any write action or autonomous execution.

See [ADR: Connector Server Boundary](../adr/ADR-connector-server-boundary.md) and the [live-context threat model](../security/live-context-threat-model.md).
