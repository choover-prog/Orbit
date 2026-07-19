# Frontend Accessibility

## Target

Implemented interfaces target WCAG 2.2 AA.

## Foundation behavior

- Semantic landmarks, headings, forms, labels, buttons, links, lists, descriptions, and times.
- A skip link and visible focus ring.
- Keyboard access to every disclosure, option, approval, cancel, history, undo, setting, and lab control.
- Polite live-region announcements for experience and action-state changes.
- Presence exposes a meaningful status label and hides decorative SVG and raster artwork. The Morph notification card exposes its visible event text only while the card is active; its icon remains decorative.
- Error and completion states use text and structure in addition to color.
- Minimum interactive target height is approximately 44 CSS pixels.
- Text input remains available even when Presence is visually primary.

## Weather trust cues

- Weather condition, freshness, connection health, and read-only status are communicated in text rather than color alone.
- A stale forecast is suppressed from attention and the quiet state explains why it was not surfaced.
- Live evidence includes a descriptive Open-Meteo attribution link, licence text, and a transformed-data label in the reading flow.
- Fixture and live modes use the same semantic evidence disclosure; live mode does not request browser geolocation or introduce a permission prompt.
- Weather has no action control, so keyboard or voice input cannot accidentally enter the mocked calendar approval path from a weather concern.

## Motion

`prefers-reduced-motion` stops continuous movement globally. The locally persisted Presence motion setting also controls the main shell, while Presence supports explicit `motionEnabled` and `reducedMotion` props so the lab can compare static state treatments. SVG variants resolve to static geometry; Morph mounts only the relevant state-specific WebP still and no animation frames. Static error and completion remain distinguishable through the exposed status text as well as their visual treatments.

## Validation

Vitest runs `jest-axe` against Presence and the resting shell and exercises attributed weather evidence without an action path. Playwright runs `axe-core` smoke checks across every route and verifies the fixture weather disclosure. Automated checks do not replace keyboard, screen-reader, zoom, contrast, and responsive manual review.
