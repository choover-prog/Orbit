# Orbit Presence Morph Design QA

## Review scope

- Source visual: `design/concepts/presence/notification-morph.png`.
- Final live screenshot: `design/review/presence-liquid/44-morph-frame-loop-live.png`.
- Source-vs-live comparison: `design/review/presence-liquid/40-source-vs-live-morph-stage.png`.
- Frame-loop contact sheet: `design/review/presence-liquid/43-morph-frame-sequences.png`.
- Route: `http://127.0.0.1:3000/design-lab/presence?presence=morph&state=attention`.
- Viewport: 1440 by 1000 desktop.
- State reviewed: Morph Core `attention`.

## Assessment

The previous SVG, canvas, and procedural WebGL attempts did not match the desired melted-metal/flubber material. They read as flat, cloudy, or amateur because they attempted to synthesize refraction, metallic rim lighting, translucent mass, internal colored signal paths, and content-pulled deformation with code primitives.

The current implementation uses a source-derived raster Morph asset for the attention state:

- `public/presence/morph/attention.png`
- `public/presence/morph/project-review-bell.png`
- `public/presence/morph/frame-loops/idle/*.webp`
- `public/presence/morph/frame-loops/attention/*.webp`
- `public/presence/morph/frame-loops/speaking/*.webp`

The shared `OrbitPresence` API remains intact. Morph bypasses SVG rendering and uses `OrbitLiquidMetalAsset` with real image stills and frame loops. The Presence Lab gives Morph a dedicated wide preview stage so the notification-pulled form is not forced into the generic square icon slot.

## Findings

| Severity | Finding | Resolution |
| --- | --- | --- |
| P1 | The live Morph looked amateur because SVG/canvas/WebGL primitives were trying to fake melted metal. | Replaced Morph with raster image assets and removed the SVG Morph component. |
| P1 | The Morph notification concept was constrained inside a square Presence slot. | Added Morph-specific wide stage behavior in the Presence Lab while keeping the shared Presence API. |
| P1 | Opening `?presence=morph` showed the idle frame instead of the relevant notification morph. | Added URL state handling so `?state=attention` opens the correct frame, and Morph defaults to attention after hydration when selected without an explicit state. |
| P1 | The first URL/state implementation caused a Next hydration mismatch. | Moved query/localStorage state synchronization into client effects after hydration. |
| P2 | The notification icon was a CSS placeholder. | Added `project-review-bell.png` as a real PNG asset inspired by the source card treatment. |
| P2 | The initial final pass clipped the Morph body in the first viewport. | Reduced the Morph-only stage/header scale so the active asset fits in the first viewport. |
| P2 | The first generated frame-loop pass tore the material into visible tiles. | Corrected the mesh transform coordinate order and regenerated the frame loops. |
| P2 | The Morph motion was only transform/crossfade based. | Added source-derived WebP frame loops for idle, attention, and speaking while keeping static PNG reduced-motion fallbacks. |

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
- The Morph animation is frame-based mesh deformation, not true fluid simulation.
- Listening/thinking/completed/error still map to the idle visual family and need dedicated final art if Morph advances.
- The frame loops add about 2.0 MB of WebP assets and should be budgeted before production default selection.

## Validation notes

- Final browser check reported no Next dev overlay.
- Final browser check reported no console errors or warnings.
- Final active frame-loop asset advanced from `attention-00.webp` to `attention-02.webp`.
- Final active asset loaded successfully at natural size 818 by 635.
- The final desktop viewport did not have horizontal overflow.
- `npm run format:check` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test -- --pool=forks --maxWorkers=1` passed: 6 files, 18 tests. One earlier full-suite run hit a Vitest worker startup timeout before running `PresenceLab.test.tsx`; the file passed directly and the full suite passed on rerun.
- `npm run build` passed.
- `git diff --check` passed with expected Windows CRLF warnings only.

## Final result

passed
