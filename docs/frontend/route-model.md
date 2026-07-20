# Frontend Route Model

| Route                  | Purpose                                                          | Rendering and state                                                                                                          |
| ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/`                    | Quiet Orbit daily experience                                     | Server builds an `OrbitSnapshot`, then one client feature shell supports resting, attention, conversation, mocked action, executing, completed, error, and undone states. `?context=weather` or `?context=calendar` selects eligible read-only context already available to the gateway. |
| `/history`             | Audit, verification, and recovery                                | Server route with a browser-local client history view.                                                                       |
| `/connections`         | Connection health, consent, and deletion                          | Server-rendered weather and fixture rows plus an accessible Google Calendar onboarding, freshness, refresh, reconnect, and disconnect client island. |
| `/settings`            | Voice, attention, motion, privacy, and accessibility preferences | Server route with local-only preference controls.                                                                            |
| `/design-lab/presence` | Compare Presence variants and states                             | Development-only client lab; not linked or rendered as a product route in production.                                        |
| `/api/orbit/snapshot`  | Inspect normalized provider-neutral context                       | Dynamic GET-only Route Handler with `cache-control: no-store`; accepts `context=weather` or `context=calendar`; exposes no token, provider proxy, or mutation. |
| `/api/connectors/google-calendar/connect` | Begin local Calendar authorization | Same-origin POST; fixture connects offline, live redirects to Google's fixed authorization endpoint with one-use state and S256 PKCE. |
| `/` with OAuth protocol query | Receive Google's Desktop-client root loopback response | Immediately forwards only bounded `code`, `state`, or `error` values to the internal callback; renders no provider values. |
| `/api/connectors/google-calendar/callback` | Complete OAuth callback internally | Exact loopback GET; validates state/cookie/PKCE, exchanges server-side, clears transaction cookie, and redirects without code/query values. |
| `/api/connectors/google-calendar/sync` | Request a bounded refresh | Same-origin POST; server rate limiting and cache determine whether a provider read is eligible. |
| `/api/connectors/google-calendar/disconnect` | Delete and revoke | Same-origin POST; local credential/cache deletion precedes best-effort Google revocation. |

Calendar, email, health, weather, home, and contacts are not top-level daily routes. Requested domain context appears temporarily within the active conversation.

Weather and Calendar fixtures are the default and make no network request. Live
modes are selected only through server configuration. The client cannot select
a provider endpoint, callback, credential, scope, calendar, or write capability.
Every dynamic route requires the raw Host `127.0.0.1:<bounded-port>`. Calendar
lifecycle mutations additionally require the exact local loopback Origin.
Ordinary Calendar page, RSC, and snapshot reads never contact Google.
