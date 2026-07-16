# Orbit Architecture Principles

## Conceptual flow

Context providers
→ normalization
→ context graph
→ attention engine
→ reasoning provider
→ policy and approval
→ capability router
→ execution provider
→ verification and audit

## Provider-neutral contracts

Orbit should define structured contracts for:

- ContextEvent
- Person
- Relationship
- Household
- SourceRecord
- Observation
- Evidence
- Recommendation
- Intent
- Capability
- Permission
- ApprovalRequest
- ActionPlan
- ActionResult
- VerificationResult
- UndoPlan
- AuditEvent

## Responsibility split

### Deterministic systems

Use deterministic code for:

- authorization
- permission checks
- risk classification
- required approval
- capability availability
- idempotency
- execution state
- retries
- verification
- auditing
- retention
- deletion
- undo eligibility

### Model-assisted systems

Use models for:

- natural-language interpretation
- summarization
- ranking candidate concerns
- linking context across sources
- explaining recommendations
- drafting communications
- conversational interaction

A model must never be the final authority on whether an action is permitted.

## Execution strategy

Early prototypes should:

- use mocked provider adapters
- use read-only connectors where possible
- support one vertical slice end to end
- store structured evidence with every recommendation
- separate recommendations from actions
- verify actions through the source system
