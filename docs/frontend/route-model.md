# Frontend Route Model

| Route                  | Purpose                                                          | Rendering and state                                                                                                          |
| ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/`                    | Quiet Orbit daily experience                                     | Server builds an `OrbitSnapshot`, then one client feature shell supports resting, attention, conversation, mocked action, executing, completed, error, and undone states. `?context=weather` requests the fresh read-only weather focus. |
| `/history`             | Audit, verification, and recovery                                | Server route with a browser-local client history view.                                                                       |
| `/connections`         | Connection health and capability permissions                     | Server-rendered snapshot health. Calendar, email, and home are fixtures; weather reports fixture/live mode plus connected, stale, unavailable, or misconfigured health. |
| `/settings`            | Voice, attention, motion, privacy, and accessibility preferences | Server route with local-only preference controls.                                                                            |
| `/design-lab/presence` | Compare Presence variants and states                             | Development-only client lab; not linked or rendered as a product route in production.                                        |
| `/api/orbit/snapshot`  | Inspect normalized provider-neutral context                       | Dynamic GET-only Route Handler with `cache-control: no-store`; accepts optional `context=weather`, exposes no provider proxy or mutation. |

Calendar, email, health, weather, home, and contacts are not top-level daily routes. Requested domain context appears temporarily within the active conversation.

Fixture weather is the default and makes no network request. Live mode is selected only through server configuration, uses a fixed fictional coarse test location, and returns Open-Meteo attribution with transformed evidence. The client cannot select an endpoint, coordinate, credential, or write capability.
