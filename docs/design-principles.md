# Orbit Design Principles

## Direction

Orbit is a calm conversational environment, not a dashboard. Relevant information temporarily enters the user's attention and recedes when it is resolved. The interface should disappear when it has nothing useful to contribute.

## Core principles

### Relevance over completeness

Nothing appears merely because Orbit knows it. A fact enters the daily experience only when it is relevant now, requires attention, supports a requested answer, enables a permission decision, or reports an action outcome.

### Conversation over navigation

Voice and text are the primary ways to move through context. Calendar, Email, Health, and Home are not permanent daily tabs. Conventional navigation remains available for history, connections, settings, and other administrative work.

### One focal concern at a time

One concern owns the viewport. Secondary concerns remain collapsed behind plain language such as “There are two other things” or “What else needs attention?”

### Context on demand

Evidence, source content, alternatives, and domain views expand only in response to the current concern or an explicit request.

### Calm by default

The resting state is nearly empty: a greeting, the Orbit mark, input, and at most one quiet contextual line. Empty space is functional; it signals that nothing requires attention.

### Actions require focused moments

Drafts, approvals, execution, verification, failures, and undo use a temporary focused scene. Action controls do not live in general-purpose cards or grids.

### Administrative complexity stays outside the daily experience

Connections, permissions, history, retention, and settings may use conventional screens because users visit them intentionally. Their information architecture must not leak into the ambient daily surface.

### Orbit should recede

Resolved items fade into history. Completed explanations collapse. Listening and thinking indicators stop when work ends. The interface does not continuously prove that it is monitoring.

## Visual system

The direction synthesizes two supplied design analyses as mood and systems references, not templates.

- Use very low density, confident system typography, generous whitespace, flat surfaces, and nearly invisible chrome.
- Use warm neutral canvases, simple geometry, content-led hierarchy, and one restrained accent for actions.
- Use `system-ui` or an open alternative such as Inter; do not use proprietary branded fonts.
- Use near-black ink, warm parchment, true white, muted gray, and one Orbit blue action color.
- Use 16px radii for normal focused surfaces, 32px only for a single large moment, and pills for primary actions.
- Prefer spacing, scale, and transitions over borders, badges, or shadows.
- Use an open circular path, center point, or subtle arc only when it communicates listening, relevance, or a relationship.

## Do not adopt

- Pinterest masonry layouts or red brand actions
- Apple product-marketing tiles, black global navigation, or product photography composition
- branded logos, proprietary typography, or direct visual imitation
- decorative gradients, star fields, planets, or science-fiction control surfaces
- context graphs as a default daily view
- grids of equal cards, metric rows, persistent sidebars, integration logos, or status-chip collections

## Motion principles

Motion communicates state:

- a relevant concern gently resolves into focus
- evidence expands from the concern that requested it
- an approval creates a temporary focused layer
- a resolved concern recedes into history
- a slow partial orbit may indicate listening, thinking, or connecting context

Motion must be brief, interruptible, and removed or reduced when `prefers-reduced-motion` is active. No looping ambient motion is required to make the resting state feel alive.

Before selecting a permanent assistant-presence animation, use the isolated experiment defined in `docs/codex/04-presence-lab-goal.md`. All presence explorations must share one component API, common semantic states, reduced-motion behavior, and a live comparison environment. Do not build separate application shells for each motion concept.

## Evaluation questions

1. Can the user identify the single thing requiring attention within five seconds?
2. Does the interface become quieter after the concern is resolved?
3. Is hidden context available through clear conversational or disclosure paths?
4. Can the user distinguish a fact, a recommendation, a draft, and an executed result?
5. Would the screen still make sense with all provider logos and domain navigation removed?
