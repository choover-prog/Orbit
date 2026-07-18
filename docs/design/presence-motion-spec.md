# Orbit Presence Motion Specification

Motion is semantic, state-driven, and subordinate to comprehension. Continuous linear rotation is not used as a default behavior. Timing changes with the selected speed control; the values below describe the 1x baseline.

| State | Visual behavior | Baseline timing | Easing | Reduced-motion representation |
| --- | --- | --- | --- | --- |
| Idle | Almost-still vertical drift with no active path traversal | 9 s alternate | `cubic-bezier(0.45, 0, 0.55, 1)` | Stable open gesture or soft field |
| Noticing | Satellite gently turns toward a newly relevant signal | 2.8 s | `cubic-bezier(0.22, 1, 0.36, 1)` | Slightly brighter satellite and path |
| Listening | Soft fields and gestural strokes breathe with simulated amplitude; no orbit | 3.2 s, audio-adjusted | `cubic-bezier(0.37, 0, 0.63, 1)` | Stronger static receptive field or stroke |
| Thinking | Satellite follows a measured temporary path; relationships form | 5.2 s | `cubic-bezier(0.65, 0, 0.35, 1)` | Defined dashed path or links |
| Speaking | Satellite or Ribbon destination makes a conversational sweep; tapered trails respond to amplitude | 2.6 s sweep, 2 s tail | `cubic-bezier(0.16, 1, 0.3, 1)` | Visible static speaking trail |
| Attention | Receptive field settles into restrained focus | 3.4 s | `cubic-bezier(0.22, 1, 0.36, 1)` | Accent orientation plus accessible label |
| Completed | Particles briefly converge and resolve | 1.2 s once | `cubic-bezier(0.22, 1, 0.36, 1)` | Static success color plus result text |
| Error | Calm broken path; no shake or loop | none | none | Static broken path plus error text |

## Sequence

The replayable studio sequence is:

`idle -> noticing -> listening -> thinking -> speaking -> completed -> idle`

Transitions remain long enough to be perceived without implying indefinite loading. The sequence is demonstrative only and does not alter product state.

## Performance

Most variants use transforms, opacity, and stroke dash properties. Layout dimensions remain stable during animation. No animation dependency, GIF, or expensive blur loop is used. Timed sequence orchestration uses bounded browser timers and clears them on unmount.

Morph is the exception by design. The SVG and procedural canvas/WebGL implementations were removed because they could not reach the desired melted-metal fidelity. Morph now uses source-derived WebP stills and alpha WebP frame loops for live motion. A small client-side scheduler crossfades state frames, while a decoded still remains underneath to prevent a blank first paint. No Rive, Spline, Lottie, GIF, video, or WebGL runtime is added in this pass. The Lab gives Morph a wide stage so the pulled notification shape is not constrained by the generic square Presence slot.

Every Morph state has an explicit sequence and static fallback:

| State | Frames | Baseline duration | Material behavior |
| --- | ---: | ---: | --- |
| Idle | 14 | 6.4 s | Nearly still breathing and a slow specular drift |
| Noticing | 18 | 3.0 s | The source-derived body leans toward the content tether |
| Listening | 20 | 3.4 s | Receptive mesh expansion and a stronger center pressure field |
| Thinking | 22 | 3.0 s | Deliberate internal tension and a measured light sweep |
| Speaking | 24 | 2.4 s | The widest elastic silhouette and fastest material response |
| Attention | 20 | 3.2 s | Notification-pulled shape with restrained warm emphasis |
| Completed | 16 | 1.8 s once | One resolving pass into the stable compact form |
| Error | 14 | 5.2 s | Calm low-energy deformation with a restrained warm state tint |

The generated state-frame library is about 19 MB, while all public Morph assets—including source material, stills, the notification icon, and frame loops—total about 22 MB. Any one active state uses about 1.7–3.0 MB of frames plus a roughly 120–180 KB still. That is acceptable for the isolated Lab and local experiment, but it is intentionally a promotion gate: a production default must lazy-load inactive states, validate decoding memory on low-end phones, and either reduce the frame budget or move to an authored animation format without lowering visible fidelity. Reduced-motion mode mounts only the relevant static WebP.

Ribbon uses the same timing contract as the other variants: the front stroke breathes while listening, dash rhythm travels while thinking, the flare becomes most expressive while speaking, and the two paths resolve into a continuous gesture on completion.

The liquid-metal variants use the same state contract with different primitives:

- Listening breathes the liquid body and center pressure field with simulated audio amplitude.
- Thinking gently tensions the material while the specular path travels.
- Speaking uses the strongest elastic deformation and fastest frame cadence.
- Attention uses the source-derived notification-pulled shape without alarm behavior.
- Completed plays once and resolves to a stable silhouette.
- Error uses a warmer, lower-confidence material treatment without shaking.

The middle pulse should remain translucent and pressure-like. It is a state field, not a solid center object, pupil, planet, or logo. The Morph variant also exposes a notification bead and tether during `noticing` and `attention`, making the presence appear to bend toward one relevant content item.

## Accessibility

`prefers-reduced-motion`, the product motion preference, and the Lab reduced-motion simulation all disable continuous motion. Every state retains a static shape change and an accessible status label, so color and motion are never the sole communication channels.
