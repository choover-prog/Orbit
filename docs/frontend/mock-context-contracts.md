# Context Contracts and Fixtures

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

Stage 2a adds provider-neutral connector contracts in `src/domain/orbit/connectors.ts`:

- `ContextConnector` and `ConnectorSyncResult`
- `ConnectorFailure` and connector health
- versioned `SourceRecord` and `SyncCursor`
- normalized `WeatherReading`
- `AttentionBundle`
- `WeatherContextSnapshot`
- versioned `OrbitSnapshot`

Open-Meteo response types remain inside the server adapter. Routes and product components receive only the normalized snapshot. Live evidence preserves Open-Meteo attribution, transformed status, observed time, and freshness.

## Mock calendar boundary

The mock calendar adapter accepts a provider-neutral proposal and approval. It enforces the exact plan hash, returns a fictional provider receipt, performs a simulated authoritative readback, creates audit events, and prepares a bounded undo result.

Fixtures use Maya Chen and fictional attendees. The demonstration scenario is:

- OA 218 arrives at 2:20 PM.
- Project Review begins at 2:30 PM.
- The airport-to-office estimate is 35–50 minutes.
- Orbit proposes 4:30 PM.
- Approval permits one exact mocked update.
- Readback verifies 4:30 PM or intentionally demonstrates a mismatch.
- Undo restores 2:30 PM in the mock and explains that delivered notifications cannot be recalled.

This scheduling scenario remains the default focal concern and is not connected to a real calendar.

## Stage 2a weather boundary

The server connector registry selects deterministic fixture weather by default or live Open-Meteo weather when `ORBIT_WEATHER_MODE=live`. Both modes pass through the same normalized record, freshness, evidence, and attention contracts. Fixture mode performs no network request. Live mode uses a fixed fictional coarse test location and requires no key.

The snapshot builder combines weather with the existing travel bundle. Weather is explicitly `read_only`; it has no recommendation or action proposal. Stale weather is retained only as marked evidence and is suppressed from attention. `GET /api/orbit/snapshot` exposes the normalized no-store contract for inspection.

## Remaining Stage 2 work

The fictional scheduling-action contract remains a fixture. A separate Stage 2b
Google Calendar context contract can now accept one local user's read-only
primary-calendar events through server-owned PKCE, Windows DPAPI storage,
bounded synchronization, and revocation. The two contracts never share action
authority. Hosted authenticated ownership, durable background synchronization,
model calls, and live write actions remain deferred.
