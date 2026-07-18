# Frontend Route Model

| Route                  | Purpose                                                          | Rendering and state                                                                                                          |
| ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/`                    | Quiet Orbit daily experience                                     | One client feature shell; supports resting, attention, conversation, action, executing, completed, error, and undone states. |
| `/history`             | Audit, verification, and recovery                                | Server route with a browser-local client history view.                                                                       |
| `/connections`         | Connection health and capability permissions                     | Server-rendered fictional connection records.                                                                                |
| `/settings`            | Voice, attention, motion, privacy, and accessibility preferences | Server route with local-only preference controls.                                                                            |
| `/design-lab/presence` | Compare Presence variants and states                             | Development-only client lab; not linked or rendered as a product route in production.                                        |

Calendar, email, health, weather, home, and contacts are not top-level daily routes. Requested domain context appears temporarily within the active conversation.
