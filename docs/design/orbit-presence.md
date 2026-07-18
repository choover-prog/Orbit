# Orbit Presence

## Component API

```tsx
<OrbitPresence
  variant="trail"
  state="speaking"
  size="medium"
  intensity={0.6}
  audioLevel={0.35}
  speed={1}
  motionEnabled
/>
```

Variants: `mark`, `pulse`, `trail`, `constellation`, `hybrid`, `ribbon`, `mercury`, `elastic`, and `morph`.

States: `idle`, `noticing`, `listening`, `thinking`, `speaking`, `attention`, `completed`, and `error`.

Sizes: `small`, `medium`, and `large`.

## Architecture

One wrapper owns accessible labels, state, size, intensity, audio level, speed, motion settings, and reduced-motion behavior. Most variant files provide SVG primitives. `morph` is intentionally different: it renders high-fidelity raster assets so the liquid-metal direction can preserve dimensional material quality instead of falling back to flat SVG or amateur procedural drawing. CSS reads shared data attributes so every variant uses the same semantic state model.

The current selection is stored in `localStorage` under `orbit.presence.variant`. In development, `?presence=trail` can select a shell variant and the Presence Lab can update it. No winner is permanent.

## Liquid-metal concept family

The current lab includes three higher-impact voice-presence concepts derived from the recent concept exploration:

- `mercury` / Mercury Loop: a polished asymmetric liquid-metal loop with warm signal color and a soft center pulse.
- `elastic` / Elastic Halo: a stretched, tactile halo with more playful magenta and lime signal energy.
- `morph` / Morph Core: the most expressive direction, with elastic lobes, a separated notification bead, embedded tangerine/teal signal paths, and a translucent middle pulse.

These concepts intentionally push beyond the original minimal SVG family. They are for live evaluation of whether Orbit's core voice interface should become more tactile, memorable, and animated while the surrounding application remains sparse and glanceable.

The Morph Core direction includes the notification-morph thought experiment: in `noticing` and `attention`, the liquid surface bends toward a single relevant content notification. The visual reference is saved at `design/concepts/presence/notification-morph.png`. The live implementation now uses source-derived/state-backed raster assets in `public/presence/morph/`:

- `idle.png`, `attention.png`, and `speaking.png` as the high-resolution material sources.
- `stills/{state}.webp` as a distinct no-motion representation for every semantic state.
- `frame-loops/{state}/*.webp` as distinct motion loops for all eight states.
- `project-review-bell.png` for the live notification card icon.

The loops are reproducible with `python scripts/generate-morph-frames.py`. The design-build utility trims empty source padding, applies continuous mesh deformation, moves a restrained specular sweep through the material, modulates the warm/teal pressure field, and exports high-quality alpha WebP frames. The component keeps the state still beneath the active loop so there is no blank first paint while animated frames decode.

The frame loops are generated from the high-fidelity raster material rather than redrawn in code. This gives the voice interface visible liquid movement without adding Rive, Spline, Lottie, video, or a WebGL shader runtime yet. The Presence Lab gives Morph a dedicated wide stage because the notification-pulled material form should not be squeezed into the generic square icon slot. The notification card is present only for `noticing` and `attention`, when the material silhouette includes the matching tether. The previous SVG and procedural canvas/WebGL Morph implementations were removed because they could not convincingly represent melted metal at the required fidelity. Morph remains an experiment. It should be judged as the high-impact voice interface direction, not as the baseline minimal mark. A future production pass may replace the frame pipeline with professionally authored Rive, alpha-video, or a serious shader, but only if the replacement demonstrably preserves the current material quality, state clarity, accessibility, and responsive behavior.

## Open the lab

Run `npm run dev` and open `/design-lab/presence`. The route is intentionally unavailable in production builds.
