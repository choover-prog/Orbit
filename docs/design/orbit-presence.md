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

Variants: `mark`, `pulse`, `trail`, `constellation`, and `hybrid`.

States: `idle`, `noticing`, `listening`, `thinking`, `speaking`, `attention`, `completed`, and `error`.

Sizes: `small`, `medium`, and `large`.

## Architecture

One wrapper owns accessible labels, state, size, intensity, audio level, speed, motion settings, and reduced-motion behavior. Variant files provide only the SVG primitives. CSS reads shared data attributes so every variant uses the same semantic state model.

The current selection is stored in `localStorage` under `orbit.presence.variant`. In development, `?presence=trail` can select a shell variant and the Presence Lab can update it. No winner is permanent.

## Open the lab

Run `npm run dev` and open `/design-lab/presence`. The route is intentionally unavailable in production builds.
