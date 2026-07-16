# Presence Motion Specification

## State behavior

| State     | Motion intent                                             | Static or reduced-motion treatment             |
| --------- | --------------------------------------------------------- | ---------------------------------------------- |
| Idle      | Nearly still; very slow satellite travel where applicable | Stable mark with normal contrast               |
| Noticing  | One restrained shift toward accent                        | Accent state without movement                  |
| Listening | Gentle pulse or measured gathering                        | State label and stronger inner form            |
| Thinking  | Continuous, deliberate orbit                              | Stable path with explicit status text          |
| Speaking  | Most expressive trail, pulse, or particle flow            | Stronger trail or arrangement without movement |
| Attention | Accent enters once, never alarms                          | Accent plus “needs attention” label            |
| Completed | Brief resolved emphasis                                   | Success color plus completion text             |
| Error     | No shake; calm discontinuity                              | Error color and broken path plus error text    |

## Timing and easing

- Base orbit: approximately 4 seconds at `1×`; idle slows to approximately 12 seconds.
- Speaking orbit: approximately 2.2 seconds.
- Pulse: approximately 2.6–3.6 seconds depending on simulated audio.
- Trail: approximately 1.7–3 seconds.
- Sequence timing is deliberately long enough for each semantic state to be recognized.
- Easing uses linear travel for orientation and ease-in-out for pulse, trail opacity, and particle settling.

## Performance

Motion uses `transform`, `opacity`, and stroke dash properties. No JavaScript animation loop, blur filter, layout animation, GIF, or animation dependency is used. The replay sequence uses bounded timeouts only to change semantic state.
