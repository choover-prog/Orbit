# Orbit Codex Command Sequence

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
