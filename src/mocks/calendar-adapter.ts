import { assertExecutable } from "@/domain/orbit/action-policy";
import type {
  ActionAuditRecord,
  ActionProposal,
  ActionResult,
  ApprovalRequest,
  AuditEvent,
  UndoResult,
  VerificationResult,
} from "@/domain/orbit/types";

const iso = (date: Date) => date.toISOString();

export interface MockCalendarAdapter {
  execute(
    proposal: ActionProposal,
    approval: ApprovalRequest,
    options?: { forceVerificationFailure?: boolean },
  ): Promise<ActionAuditRecord>;
  undo(record: ActionAuditRecord): Promise<ActionAuditRecord>;
}

export function createMockCalendarAdapter(
  now = () => new Date(),
): MockCalendarAdapter {
  return {
    async execute(proposal, approval, options = {}) {
      const startedAt = now();
      assertExecutable(proposal, approval, startedAt);

      const result: ActionResult = {
        id: "result_move_review",
        proposalId: proposal.id,
        state: "accepted",
        providerReceipt: "mock-calendar-receipt-001",
        completedAt: iso(startedAt),
      };
      const observed = options.forceVerificationFailure
        ? proposal.previousValue
        : proposal.expectedEffect;
      const verification: VerificationResult = {
        id: "verification_move_review",
        actionResultId: result.id,
        expected: proposal.expectedEffect,
        observed,
        status: observed === proposal.expectedEffect ? "verified" : "mismatch",
        verifiedAt: iso(now()),
      };
      const undo: UndoResult = {
        id: "undo_move_review",
        actionResultId: result.id,
        status: verification.status === "verified" ? "available" : "failed",
        summary:
          "Restore Project Review to 2:30 PM. Attendee notifications cannot be recalled.",
        expiresAt: iso(new Date(startedAt.getTime() + 20 * 60 * 1000)),
      };
      const events: AuditEvent[] = [
        {
          id: "audit_proposal",
          eventType: "proposal_created",
          occurredAt: iso(startedAt),
          summary: proposal.summary,
        },
        {
          id: "audit_approval",
          eventType: "approval_granted",
          occurredAt: iso(startedAt),
          summary: "Maya approved the exact mocked plan.",
        },
        {
          id: "audit_execute",
          eventType: "execution_accepted",
          occurredAt: result.completedAt,
          summary: "Mock calendar accepted the update.",
        },
        {
          id: "audit_verify",
          eventType:
            verification.status === "verified"
              ? "verification_succeeded"
              : "verification_failed",
          occurredAt: verification.verifiedAt,
          summary:
            verification.status === "verified"
              ? "Readback matched the approved time."
              : "Readback did not match the approved time.",
        },
      ];

      await Promise.resolve();
      return { proposal, approval, result, verification, undo, events };
    },

    async undo(record) {
      if (record.undo.status !== "available") {
        throw new Error("Undo is not available for this action.");
      }
      const undoneAt = iso(now());
      await Promise.resolve();
      return {
        ...record,
        undo: { ...record.undo, status: "verified" },
        events: [
          ...record.events,
          {
            id: "audit_undo",
            eventType: "undo_verified",
            occurredAt: undoneAt,
            summary:
              "Mock calendar readback confirmed the 2:30 PM time was restored.",
          },
        ],
      };
    },
  };
}
