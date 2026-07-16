# Frontend State Model

## Experience states

```text
resting
  → attention
  → conversation
  → action
  → executing
  → completed
  → undone
```

An execution or verification problem enters `error`. Cancel returns to `attention`; resolving or completing recovery can return to `resting`.

## Progressive conversation

Conversation content uses four bounded steps: `overview`, `reason`, `evidence`, and `options`. These replace one another rather than accumulating a chatbot transcript. The same travel-conflict identity persists across the flow.

## Action invariants

- Execution requires an approved, unexpired request whose proposal ID and plan hash match the exact proposal.
- Transport acceptance is distinct from readback verification.
- Verification mismatch produces an error state and no success claim.
- Undo is available only after verified execution and is itself verified.
- All state and data in this foundation are fictional and local.

## Presence mapping

| Experience              | Presence state |
| ----------------------- | -------------- |
| Resting                 | `idle`         |
| Attention               | `attention`    |
| Conversation            | `speaking`     |
| Action review           | `noticing`     |
| Executing and verifying | `thinking`     |
| Completed or undone     | `completed`    |
| Failure or mismatch     | `error`        |
