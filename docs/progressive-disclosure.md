# Progressive Disclosure

## Principle

Orbit reveals the minimum information needed for the current decision and gives the user a clear path to ask for more. Disclosure follows intent rather than exposing the full context graph.

## Disclosure ladder

| Level | Default content | User trigger |
|---|---|---|
| Rest | Greeting, input, quiet status | A concern becomes eligible or user asks |
| Concern | What changed and why it matters | “Why?”, “Show me”, or select concern |
| Evidence | Specific source facts, freshness, uncertainty | Request source or explanation |
| Options | Two or three bounded alternatives | “What are my options?” |
| Draft | Exact proposed effect without side effect | “Handle it” or choose option |
| Approval | Recipients, timing, permissions, consequences | Attempt consequential action |
| Result | Verified outcome, failure, or unknown state | Execution completes |
| Recovery | Undo or bounded recovery path | Verified eligibility or failure |

## Content rules

- A collapsed label describes what will expand: “Why this matters · 2 sources,” not “More.”
- Evidence appears next to the claim it supports.
- A requested email opens the relevant message, not a general inbox panel.
- A requested calendar view opens around the relevant time window, not an all-purpose dashboard.
- Options exclude unavailable or policy-prohibited actions.
- Approval never hides recipients, affected resources, or irreversible consequences behind disclosure.
- Verification and failure states cannot be dismissed into a generic success toast.

## Conversation examples

**User:** Why does that matter?

**Orbit:** Your flight lands 40 minutes after Project Review begins. The flight update is seven minutes old and the calendar event was confirmed this morning.

**User:** What are my options?

**Orbit:** Move the review to 4:30 PM, join by phone after landing, or leave it unchanged. I can draft the first two options.

**User:** Move it.

Orbit opens a focused action state with the exact new time, attendees, message, approval, and expected verification.

## Visual behavior

Expanded content grows from the concern or response that requested it. When the user finishes, it collapses or recedes rather than accumulating as permanent chrome. Only the active disclosure receives full contrast; surrounding context remains visually quiet.

## Limits

Progressive disclosure must not conceal safety-critical information, material uncertainty, required permission, or an action's full consequence. Calmness is not an excuse for ambiguity.
