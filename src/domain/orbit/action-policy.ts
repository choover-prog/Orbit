import type {
  ActionProposal,
  ApprovalRequest,
  VerificationResult,
} from "./types";

export function canExecute(
  proposal: ActionProposal,
  approval: ApprovalRequest,
  now: Date,
): boolean {
  return (
    approval.state === "approved" &&
    approval.proposalId === proposal.id &&
    approval.planHash === proposal.planHash &&
    new Date(approval.expiresAt).getTime() > now.getTime()
  );
}

export function isVerified(result: VerificationResult): boolean {
  return result.status === "verified" && result.expected === result.observed;
}

export function assertExecutable(
  proposal: ActionProposal,
  approval: ApprovalRequest,
  now: Date,
): void {
  if (!canExecute(proposal, approval, now)) {
    throw new Error("The exact proposed action requires a current approval.");
  }
}
