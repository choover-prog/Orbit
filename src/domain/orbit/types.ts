export type IsoDateTime = string;

export type EpistemicStatus =
  "fact" | "derived" | "inference" | "user_asserted" | "verified_result";

export interface PersonReference {
  id: string;
  displayName: string;
  initials: string;
  relationshipScope: "self" | "household" | "contact";
}

export interface SourceEvidence {
  id: string;
  sourceLabel: string;
  summary: string;
  observedAt: IsoDateTime;
  freshnessLabel: string;
  epistemicStatus: EpistemicStatus;
}

export interface ContextRecord {
  id: string;
  domain: "calendar" | "travel" | "email" | "weather" | "home" | "contact";
  kind: string;
  occurredAt: IsoDateTime;
  summary: string;
  evidenceIds: string[];
}

export interface AttentionItem {
  id: string;
  title: string;
  reason: string;
  evidenceIds: string[];
  status: "active" | "snoozed" | "resolved";
  otherEligibleCount: number;
}

export interface Recommendation {
  id: string;
  attentionItemId: string;
  rationale: string;
  options: Array<{
    id: string;
    label: string;
    available: boolean;
  }>;
}

export interface ActionProposal {
  id: string;
  recommendationId: string;
  capability: "calendar.event.update";
  summary: string;
  affectedPeople: PersonReference[];
  expectedEffect: string;
  previousValue: string;
  nextValue: string;
  planHash: string;
  reversible: boolean;
}

export interface ApprovalRequest {
  id: string;
  proposalId: string;
  planHash: string;
  riskClass: "R3";
  permissionLabel: string;
  expiresAt: IsoDateTime;
  state: "pending" | "approved" | "declined" | "expired";
}

export interface ActionResult {
  id: string;
  proposalId: string;
  state: "accepted" | "failed";
  providerReceipt: string;
  completedAt: IsoDateTime;
}

export interface VerificationResult {
  id: string;
  actionResultId: string;
  expected: string;
  observed: string;
  status: "verified" | "mismatch";
  verifiedAt: IsoDateTime;
}

export interface UndoResult {
  id: string;
  actionResultId: string;
  status: "available" | "verified" | "failed";
  summary: string;
  expiresAt: IsoDateTime;
}

export interface AuditEvent {
  id: string;
  eventType:
    | "proposal_created"
    | "approval_granted"
    | "execution_accepted"
    | "verification_succeeded"
    | "verification_failed"
    | "undo_verified";
  occurredAt: IsoDateTime;
  summary: string;
}

export interface ActionAuditRecord {
  proposal: ActionProposal;
  approval: ApprovalRequest;
  result: ActionResult;
  verification: VerificationResult;
  undo: UndoResult;
  events: AuditEvent[];
}

export interface ConnectionStatus {
  id: string;
  displayName: string;
  category:
    "calendar" | "email" | "contacts" | "weather" | "home" | "developer";
  mode: "mock";
  health: "connected" | "attention" | "paused";
  capabilities: Array<{
    id: string;
    label: string;
    access: "read" | "draft" | "write";
  }>;
  lastSyncLabel: string;
}

export type OrbitExperienceState =
  | "resting"
  | "attention"
  | "conversation"
  | "action"
  | "executing"
  | "completed"
  | "error"
  | "undone";

export type ConversationStep = "overview" | "reason" | "evidence" | "options";
