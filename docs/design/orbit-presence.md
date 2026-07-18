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

One wrapper owns accessible labels, state, size, intensity, audio level, speed, motion settings, and reduced-motion behavior. Variant files provide only the SVG primitives. CSS reads shared data attributes so every variant uses the same semantic state model.

The current selection is stored in `localStorage` under `orbit.presence.variant`. In development, `?presence=trail` can select a shell variant and the Presence Lab can update it. No winner is permanent.

## Liquid-metal concept family

The current lab includes three higher-impact voice-presence concepts derived from the recent concept exploration:

- `mercury` / Mercury Loop: a polished asymmetric liquid-metal loop with warm signal color and a soft center pulse.
- `elastic` / Elastic Halo: a stretched, tactile halo with more playful magenta and lime signal energy.
- `morph` / Morph Core: the most expressive direction, with elastic lobes, a separated notification bead, embedded tangerine/teal signal paths, and a translucent middle pulse.

These concepts intentionally push beyond the original minimal SVG family. They are for live evaluation of whether Orbit's core voice interface should become more tactile, memorable, and animated while the surrounding application remains sparse and glanceable.

The Morph Core direction includes the notification-morph thought experiment: in `noticing` and `attention`, the bead and tether can bend toward a single relevant content notification. The visual reference is saved at `design/concepts/presence/notification-morph.png`. The live implementation now uses a larger open liquid-metal membrane, a visual notification card in the Lab hero, and a constrained SVG material filter to avoid the previous flat/cartoon result while remaining a live SVG/CSS primitive.

## Open the lab

Run `npm run dev` and open `/design-lab/presence`. The route is intentionally unavailable in production builds.
