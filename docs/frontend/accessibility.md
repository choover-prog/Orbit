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

## Motion

`prefers-reduced-motion` stops continuous movement globally. The locally persisted Presence motion setting also controls the main shell, while Presence supports explicit `motionEnabled` and `reducedMotion` props so the lab can compare static state treatments. SVG variants resolve to static geometry; Morph mounts only the relevant state-specific WebP still and no animation frames. Static error and completion remain distinguishable through the exposed status text as well as their visual treatments.

## Validation

Vitest runs `jest-axe` against Presence and the resting shell. Playwright runs `axe-core` smoke checks across every route. Automated checks do not replace keyboard, screen-reader, zoom, contrast, and responsive manual review.
