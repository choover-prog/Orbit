# Next Codex Goal — Orbit Presence Lab

Paste the following after `/goal` when the selected frontend shell exists and the repository is ready for an isolated motion experiment.

---

## Goal

Build an Orbit Presence Lab that implements the recent assistant-presence and motion concepts as live, switchable frontend variants.

The purpose is not to select the final animation. Implement the concepts in one controlled design-lab environment so they can be experienced, compared, and refined before one becomes Orbit's default presence.

## Core requirement

Create one reusable Orbit Presence system with:

- multiple visual variants
- shared interaction states
- a live variant toggle
- a live state toggle
- configurable motion settings
- reduced-motion support
- minimal impact on the existing Orbit application

Do not build each concept as a separate application or duplicate the surrounding page architecture.

## Presence variants

### Orbit Mark

The original minimal black Orbit logo: simple circle, small satellite point, nearly static idle state, subtle active movement, restrained and graphic.

### Orbit Pulse

A soft circular presence with a luminous center and restrained radial breathing. No rainbow effects or excessive glow. Suitable for the most minimal interface direction.

### Orbit Trail

A small satellite travels along a circular or gently elliptical path. Speaking creates a graceful trailing arc; thinking uses a continuous measured orbit; listening slows or subtly leans toward simulated audio input; idle becomes nearly still. Never depict a literal Earth or planet.

### Orbit Constellation

A central presence with a low particle count. Particles gather while listening, form relationships while thinking, flow outward or around the center while speaking, and settle while idle. Avoid screensaver, galaxy, and science-fiction effects.

### Hybrid Presence

Combine the strongest parts of Pulse and Trail: soft center, one satellite, subtle speaking trail, and restrained listening pulse. Treat this as a likely production candidate, not a predetermined winner.

## Shared states

```ts
type OrbitPresenceState =
  | "idle"
  | "noticing"
  | "listening"
  | "thinking"
  | "speaking"
  | "attention"
  | "completed"
  | "error";
```

- **Idle:** calm, almost motionless, present without demanding attention.
- **Noticing:** subtle indication of relevant context without alarm behavior.
- **Listening:** gently responds to the user and may react to simulated audio amplitude.
- **Thinking:** deliberate continuous motion, distinct from listening and speaking, without implying failure.
- **Speaking:** most expressive but still calm; Trail emphasizes its tail, Pulse expands rhythmically, and Constellation flows.
- **Attention:** restrained use of Orbit's accent; no aggressive warning animation.
- **Completed:** brief resolved state followed by a natural return to idle.
- **Error:** calm, clear, and always accompanied by accessible text; avoid shaking.

## Shared component architecture

Build one component API rather than independent implementations scattered across the application.

```tsx
<OrbitPresence
  variant="trail"
  state="speaking"
  size="medium"
  intensity={0.6}
  audioLevel={0.35}
  motionEnabled={true}
/>
```

```ts
type OrbitPresenceVariant =
  "mark" | "pulse" | "trail" | "constellation" | "hybrid";

type OrbitPresenceSize = "small" | "medium" | "large";
```

Adapt this approximate structure to existing repository conventions:

```text
src/components/orbit-presence/
├── OrbitPresence.tsx
├── OrbitPresence.types.ts
├── OrbitPresence.module.css
├── variants/
│   ├── OrbitMark.tsx
│   ├── OrbitPulse.tsx
│   ├── OrbitTrail.tsx
│   ├── OrbitConstellation.tsx
│   └── OrbitHybrid.tsx
├── motion/
│   ├── presenceMotion.ts
│   ├── useReducedMotion.ts
│   └── useSimulatedAudio.ts
└── index.ts
```

The important decision is one component with variants. Final selection should eventually be a one-line change:

```tsx
<OrbitPresence variant="hybrid" state={assistantState} />
```

## Animation technology

Prefer semantic inline SVG, CSS transforms and opacity, CSS custom properties, and the existing animation library if one is already installed. Use `requestAnimationFrame` only when genuinely needed. Do not add a large animation dependency without strong justification.

Production comparison must use SVG/CSS animation, not GIFs. Prefer animating `transform`, `opacity`, `stroke-dashoffset`, and `stroke-dasharray`. Avoid frequent layout-dimension animation, expensive blur filters, and properties that cause unnecessary layout or paint work.

## Presence Lab

Create an isolated development route such as `/design-lab/presence`, following the repository's existing demo-route convention when one exists.

The lab must include:

- variant controls for all five variants
- state controls for all eight states
- animation on/off
- intensity
- speed
- simulated audio level
- presence size
- light/dark preview when supported by the theme
- reduced-motion simulation

Show the selected presence in at least three realistic Orbit contexts:

1. quiet resting screen
2. single-attention screen
3. conversation or action screen

Lab controls may be utilitarian. Orbit previews must preserve the minimalist product direction and must not become a dense dashboard.

## Comparison and sequence modes

Comparison mode displays all five variants simultaneously in the same selected state so personality, motion, and visual weight can be judged under identical conditions.

Sequence mode automatically and replayably demonstrates:

```text
idle → noticing → listening → thinking → speaking → completed → idle
```

## Temporary integration

Add a development-only selector or feature flag so the existing Orbit shell can use any presence variant. Prefer the least invasive compatible approach: a URL query such as `?presence=trail`, a local development setting, local storage, or an environment-backed development flag.

Persist the design-lab selection locally after refresh. Do not add backend persistence or expose the selector to ordinary production users.

If “Ask Orbit” remains, allow the selected presence to sit above it, replace the microphone affordance, or become the invocation target without removing keyboard-accessible text entry.

## Refactoring protection

Before implementation:

1. Inspect the existing Orbit frontend.
2. Identify the current logo, assistant identity, voice input, and state components.
3. Determine what can be reused.
4. Produce a short implementation plan.
5. Avoid modifying unrelated architecture.

Preserve existing routes, context models, attention logic, action flow, permissions logic, typography, tokens, and mock providers. Do not rewrite the frontend shell merely to add Presence variants.

## Accessibility

- Honor `prefers-reduced-motion`.
- Provide a no-motion representation for every state.
- Communicate state through text or ARIA status, not color alone.
- Hide decorative SVG elements from assistive technology.
- Expose labels such as “Orbit is listening,” “Orbit is thinking,” “Orbit is speaking,” and “Orbit needs your attention.”
- Avoid flicker and unsafe animation frequencies.
- Maintain sufficient contrast and keyboard-accessible controls.
- Replace continuous reduced-motion behavior with restrained opacity or static-state changes.

## Visual constraints

- No literal globe, Earth, planet, or realistic satellite.
- Do not imitate Siri.
- No rainbow gradient or generic voice waveform as the primary identity.
- No excessive glow, particles, or decorative trails.
- Do not turn Orbit into a space-themed interface.
- Motion must communicate listening, thinking, speaking, attention, completion, or failure.
- The presence should feel like a living brand mark, not an illustration.

## Documentation

Create or update:

- `docs/design/orbit-presence.md`
- `docs/design/presence-motion-spec.md`
- `docs/design/presence-comparison.md`

Document the component API, variants, state behavior, timing and easing, reduced-motion behavior, performance considerations, strengths and weaknesses, recommendation criteria, and how to open the Presence Lab.

Include a comparison table covering warmth, recognizability, distraction, speaking clarity, listening clarity, scalability, accessibility, performance, brand distinctiveness, and minimalist fit. Do not choose a permanent winner unless live comparison provides a clear result; a provisional recommendation is acceptable.

## Validation

Use the appropriate frontend and design workflows, including `$get-context`, `$frontend-design`, `$design-qa`, and `/review`. Use `$image-to-code` only if it helps translate supplied concept boards into primitives; never blindly reproduce generated artifacts or generated text.

Validate:

- responsive layouts
- all state transitions
- reduced-motion mode
- keyboard interaction
- no significant layout shift
- no console errors
- animation performance
- comparison mode
- replayable sequence mode
- persisted selection
- unchanged existing application behavior

## Required deliverables

Return:

1. current frontend assessment
2. implementation approach
3. files created and modified
4. Presence Lab route
5. five live variants
6. all shared states
7. comparison mode
8. automatic sequence mode
9. reduced-motion implementation
10. how to switch the variant in the existing shell
11. screenshots or recordings where available
12. design comparison and provisional recommendation
13. remaining refinements before final selection

## Stop condition

Stop after the live Presence Lab, shared component system, temporary integration, documentation, tests, and review are complete.

Do not redesign unrelated screens, add real voice integrations, connect a microphone stream beyond simulated audio, make the experiment permanent, remove any variant, deploy, or open a pull request without explicit instruction.
