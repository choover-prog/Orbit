# Mock Context Contracts

## Contracts implemented

Stage 1 defines TypeScript interfaces for:

- `ContextRecord`
- `PersonReference`
- `SourceEvidence`
- `AttentionItem`
- `Recommendation`
- `ActionProposal`
- `ApprovalRequest`
- `ActionResult`
- `VerificationResult`
- `UndoResult`
- `AuditEvent`
- `ConnectionStatus`

The contracts live in `src/domain/orbit/types.ts` and contain no provider SDK types.

## Adapter boundary

The mock calendar adapter accepts a provider-neutral proposal and approval. It enforces the exact plan hash, returns a fictional provider receipt, performs a simulated authoritative readback, creates audit events, and prepares a bounded undo result.

Fixtures use Maya Chen and fictional attendees. The demonstration scenario is:

- OA 218 arrives at 2:20 PM.
- Project Review begins at 2:30 PM.
- The airport-to-office estimate is 35–50 minutes.
- Orbit proposes 4:30 PM.
- Approval permits one exact mocked update.
- Readback verifies 4:30 PM or intentionally demonstrates a mismatch.
- Undo restores 2:30 PM in the mock and explains that delivered notifications cannot be recalled.

## Stage 2 preparation

Future read-only adapters may implement connect, synchronize, normalize, and health interfaces around these records. Stage 1 does not include OAuth, sync cursors, network calls, token storage, or provider-specific payload examples.
