# Orbit Presence Morph Design QA

## Review scope

- Source visual truth: `design/concepts/presence/notification-morph.png`.
- Desktop implementation: `design/review/presence-liquid/46-morph-state-loops-attention.png`.
- Speaking implementation: `design/review/presence-liquid/47-morph-state-loops-speaking.png`.
- Phone implementation: `design/review/presence-liquid/48-morph-state-loops-mobile.png`.
- Tablet implementation: `design/review/presence-liquid/51-morph-state-loops-tablet.png`.
- Full-view comparison: `design/review/presence-liquid/49-morph-source-live-final-comparison.png`.
- Focused material/card comparison: `design/review/presence-liquid/50-morph-source-live-focused-comparison.png`.
- Eight-state material contact sheet: `design/review/presence-liquid/45-morph-state-material-montage.png`.
- Route: `http://127.0.0.1:3000/design-lab/presence?presence=morph&state=attention`.
- Desktop content viewport: 1521 by 885 after a 1536 by 1024 browser override.
- Responsive viewports: 753-pixel tablet content width and 376-pixel phone content width.
- States reviewed visually: `attention` and `speaking`; all eight state assets reviewed in the contact sheet and live DOM.

## Findings

No actionable P0, P1, or P2 findings remain.

The implementation is not a clone of the source product shell because the approved target is the reusable Morph Presence inside the existing Presence Lab. Within that intentional difference, the live component preserves the source material language: refractive metallic rim, translucent mass, teal/tangerine signal light, soft pressure field, asymmetrical pull toward content, and one attached notification.

The five required fidelity surfaces were checked:

- **Fonts and typography:** Orbit's existing Inter/system stack and hierarchy are preserved. The notification label was changed from an all-caps lab treatment to the calmer title-case treatment in the source. Phone headings now use constrained balanced wrapping.
- **Spacing and layout rhythm:** Morph has a dedicated wide stage. Desktop retains the source's whitespace; tablet and phone keep one focal object with no horizontal layout overflow. The mobile card overlays the tether because there is not enough width for the desktop side-by-side composition; the connection and action remain legible.
- **Colors and visual tokens:** The existing warm canvas and blue Lab accent remain unchanged. Teal and tangerine stay inside the material and notification signal instead of becoming page chrome.
- **Image quality and asset fidelity:** Morph uses real source-derived raster assets, not SVG/CSS/canvas approximations. Transparent edges, metallic highlights, source crop, alpha treatment, and native-scale focused comparison were inspected. High-quality WebP and restrained post-sharpening preserve the material during mesh deformation.
- **Copy and content:** The state label, concise personality statement, `Project Review`, and `Starts in 10 min` are coherent in the Lab and match the fictional Orbit scenario.

## Comparison history

| Iteration | Earlier finding | Fix | Post-fix evidence |
| --- | --- | --- | --- |
| 1 | P1: handcrafted SVG/canvas/WebGL attempts read as flat, cloudy, or amateur. | Removed procedural Morph rendering and made raster material the visual source of truth. | `design/review/presence-liquid/49-morph-source-live-final-comparison.png` |
| 2 | P1: the notification-pulled form was constrained to a square Presence slot. | Added Morph-specific wide Lab composition while preserving the shared `OrbitPresence` API. | `design/review/presence-liquid/46-morph-state-loops-attention.png` |
| 3 | P2: only three source families covered eight states, and transform-only motion did not feel alive. | Added distinct stills and source-derived mesh/specular frame loops for every state. | `design/review/presence-liquid/45-morph-state-material-montage.png` |
| 4 | P2: sparse frame swaps could stutter and briefly show a blank image during decoding. | Added stacked frame crossfades plus an always-present high-fidelity still beneath the loop. | Live frame probe advanced `attention-00` to `attention-02` with exactly one active animated frame and a decoded fallback. |
| 5 | P2: untrimmed transparent padding made speaking too small and visually weak. | Trimmed source bounds consistently before deformation and regenerated the library. | `design/review/presence-liquid/47-morph-state-loops-speaking.png` |
| 6 | P2: double drop-shadows, low WebP quality, and uppercase card text softened the source fidelity. | Removed redundant runtime shadow filters, increased export quality/sharpening, and matched title-case card typography. | `design/review/presence-liquid/50-morph-source-live-focused-comparison.png` |
| 7 | P2: the first phone capture exposed poor heading wrapping. | Constrained mobile display copy, balanced the heading, and reduced Morph stage width. | `design/review/presence-liquid/48-morph-state-loops-mobile.png` |

## Interaction and accessibility validation

- Reduced-motion simulation switched Morph to `data-motion="off"`, `data-frame-index="static"`, zero animated images, and `/presence/morph/stills/attention.webp`.
- Replay sequence moved from `idle` to `noticing` on schedule.
- Comparison mode rendered nine variant cards and two Morph instances without errors.
- The attention frame loop exposed 20 frames and advanced during live inspection.
- Desktop, tablet, and phone DOM measurements reported no horizontal overflow.
- The final browser console had no errors or warnings.
- Semantic status labels, keyboard-operable controls, and visible text remain the source of state meaning; color and animation are supplemental.

## Follow-up polish

- P3: the generated state-frame library is about 19 MB and the complete public Morph asset family is about 22 MB. Only one 1.7–3.0 MB state loop is active at a time, but production promotion requires inactive-state lazy loading, decoding-memory measurements, and a smaller delivery strategy.
- P3: frame-based deformation is intentionally not a physical fluid simulation. A professionally authored Rive, alpha-video, or shader pipeline may improve temporal continuity, but it should replace this implementation only after matching the current material fidelity and reduced-motion behavior.
- P3: the attention source is lower resolution than the speaking source, so very large close-up comparison magnifies raster softness. The live stage stays within an acceptable native-scale range.

## Validation status

- `npm run check` passed: formatting, lint, type checking, 6 unit/component files with 19 tests, and the production build.
- `npm run test:e2e` passed in desktop Chromium and mobile WebKit: 7 tests passed and the desktop-only exclusion for the phone-specific assertion was skipped as intended.
- Browser-rendered desktop, tablet, phone, reduced-motion, comparison, sequence, and console checks passed.

## Final result

passed
