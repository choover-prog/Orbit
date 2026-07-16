# Superseded Orbit Codex Command Sequence

> Preserved for provenance. The referenced bootstrap prompts are no longer the active product direction. Use the revised design and interaction documents before creating a new implementation goal.

## Current next goal

After a frontend shell exists and is ready for an isolated motion experiment, run `/goal` with the contents of `docs/codex/04-presence-lab-goal.md`. This goal creates one shared Presence component with five live variants inside a development-only comparison lab; it must not duplicate or redesign the surrounding application.

Run from the Orbit repository root.

```text
/worktree
/reasoning
```

Select a high reasoning level appropriate to the task.

Then:

```text
/plan
```

Paste the contents of:

```text
docs/codex/01-plan-prompt.md
```

Review the plan. Then:

```text
/goal
```

Paste the contents of:

```text
docs/codex/02-goal-prompt.md
```

Expected specialist workflow during the goal:

```text
$get-context
$research
$audit       # only when an existing UI is available
$ideate
$imagegen
/review
/status
```

Do not invoke:

```text
$image-to-code
```

until a concept is selected.

## Suggested next goal after concept selection

```text
/goal
```

Implement the selected Orbit concept as a responsive, accessible frontend using mocked context and capability adapters. Preserve the documented provider-neutral architecture. Use `$image-to-code`, then `$design-qa`, then `/review`. Do not implement real provider credentials or consequential action execution in that goal.
