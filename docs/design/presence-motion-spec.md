# Orbit Presence Motion Specification

Motion is semantic, state-driven, and subordinate to comprehension. Continuous linear rotation is not used as a default behavior. Timing changes with the selected speed control; the values below describe the 1× baseline.

| State | Visual behavior | Baseline timing | Easing | Reduced-motion representation |
| --- | --- | --- | --- | --- |
| Idle | Almost-still vertical drift with no active path traversal | 9 s alternate | `cubic-bezier(0.45, 0, 0.55, 1)` | Stable core and faint open path |
| Noticing | Satellite gently turns toward a newly relevant signal | 2.8 s | `cubic-bezier(0.22, 1, 0.36, 1)` | Slightly brighter satellite and path |
| Listening | Soft field and core breathe with simulated amplitude; no orbit | 3.2 s, audio-adjusted | `cubic-bezier(0.37, 0, 0.63, 1)` | Stronger static receptive field |
| Thinking | Satellite follows a measured temporary path; relationships form | 5.2 s | `cubic-bezier(0.65, 0, 0.35, 1)` | Defined dashed path or links |
| Speaking | Satellite makes a conversational sweep; tapered trail and core respond to amplitude | 2.6 s sweep, 2 s tail | `cubic-bezier(0.16, 1, 0.3, 1)` | Visible static speaking trail |
| Attention | Receptive field settles into restrained focus | 3.4 s | `cubic-bezier(0.22, 1, 0.36, 1)` | Accent orientation plus accessible label |
| Completed | Particles briefly converge and resolve | 1.2 s once | `cubic-bezier(0.22, 1, 0.36, 1)` | Static success color plus result text |
| Error | Calm broken path; no shake or loop | none | none | Static broken path plus error text |

## Sequence

The replayable studio sequence is:

`idle → noticing → listening → thinking → speaking → completed → idle`

Transitions remain long enough to be perceived without implying indefinite loading. The sequence is demonstrative only and does not alter product state.

## Performance

Motion is implemented with transforms, opacity, and stroke dash properties. Layout dimensions remain stable during animation. No animation dependency, GIF, expensive blur loop, or per-frame JavaScript is used. Timed sequence orchestration uses bounded browser timers and clears them on unmount.

## Accessibility

`prefers-reduced-motion`, the product motion preference, and the Lab reduced-motion simulation all disable continuous motion. Every state retains a static shape change and an accessible status label, so color and motion are never the sole communication channels.
