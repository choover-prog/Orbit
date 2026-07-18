# Orbit Presence Morph Design QA

## Review scope

- Source visual: `design/concepts/presence/notification-morph.png`.
- Final live screenshot: `design/review/presence-liquid/42-morph-stage-attention-final.png`.
- Source-vs-live comparison: `design/review/presence-liquid/40-source-vs-live-morph-stage.png`.
- Route: `http://127.0.0.1:3000/design-lab/presence?presence=morph&state=attention`.
- Viewport: 1440 by 1000 desktop.
- State reviewed: Morph Core `attention`.

## Assessment

The previous SVG, canvas, and procedural WebGL attempts did not match the desired melted-metal/flubber material. They read as flat, cloudy, or amateur because they attempted to synthesize refraction, metallic rim lighting, translucent mass, internal colored signal paths, and content-pulled deformation with code primitives.

The current implementation uses a source-derived raster Morph asset for the attention state:

- `public/presence/morph/attention.png`
- `public/presence/morph/project-review-bell.png`

The shared `OrbitPresence` API remains intact. Morph bypasses SVG rendering and uses `OrbitLiquidMetalAsset` with real image frames. The Presence Lab gives Morph a dedicated wide preview stage so the notification-pulled form is not forced into the generic square icon slot.

## Findings

| Severity | Finding | Resolution |
| --- | --- | --- |
| P1 | The live Morph looked amateur because SVG/canvas/WebGL primitives were trying to fake melted metal. | Replaced Morph with raster image assets and removed the SVG Morph component. |
| P1 | The Morph notification concept was constrained inside a square Presence slot. | Added Morph-specific wide stage behavior in the Presence Lab while keeping the shared Presence API. |
| P1 | Opening `?presence=morph` showed the idle frame instead of the relevant notification morph. | Added URL state handling so `?state=attention` opens the correct frame, and Morph defaults to attention after hydration when selected without an explicit state. |
| P1 | The first URL/state implementation caused a Next hydration mismatch. | Moved query/localStorage state synchronization into client effects after hydration. |
| P2 | The notification icon was a CSS placeholder. | Added `project-review-bell.png` as a real PNG asset inspired by the source card treatment. |
| P2 | The initial final pass clipped the Morph body in the first viewport. | Reduced the Morph-only stage/header scale so the active asset fits in the first viewport. |

## Current visual comparison

The live result is not a pixel clone of the full product concept. That is intentional for this pass because the target is the reusable Presence Lab, not a replacement of the entire Orbit home shell. The key material qualities now survive in the live implementation:

- translucent melted-metal body
- refractive outer rim
- internal teal and tangerine light paths
- soft central pulse
- asymmetric notification pull
- one attached content notification
- sparse white surrounding composition

Remaining P3 polish:

- Card typography/icon alignment can be tightened closer to the source concept.
- The Morph animation is still transform/crossfade based, not true fluid simulation.
- Idle/listening/thinking/completed/error reuse the idle frame and need dedicated final art if Morph advances.
- PNG assets should be evaluated for WebP conversion before production default selection.

## Validation notes

- Final browser check reported no Next dev overlay.
- Final browser check reported no console errors or warnings.
- Final active asset loaded successfully at natural size 818 by 635.
- The final desktop viewport did not have horizontal overflow.

## Final result

passed
