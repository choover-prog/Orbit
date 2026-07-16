import { describe, expect, it } from "vitest";
import { canExecute, isVerified } from "./action-policy";
import { moveReviewProposal } from "@/mocks/fixtures";

const now = new Date("2026-07-16T12:00:00.000Z");
const approval = {
  id: "approval_test",
  proposalId: moveReviewProposal.id,
  planHash: moveReviewProposal.planHash,
  riskClass: "R3" as const,
  permissionLabel: "Update once",
  expiresAt: "2026-07-16T12:05:00.000Z",
  state: "approved" as const,
};

describe("action policy", () => {
  it("requires current approval for the exact plan", () => {
    expect(canExecute(moveReviewProposal, approval, now)).toBe(true);
    expect(
      canExecute(moveReviewProposal, { ...approval, planHash: "changed" }, now),
    ).toBe(false);
    expect(
      canExecute(moveReviewProposal, { ...approval, state: "declined" }, now),
    ).toBe(false);
    expect(
      canExecute(
        moveReviewProposal,
        approval,
        new Date("2026-07-16T12:06:00.000Z"),
      ),
    ).toBe(false);
  });

  it("treats only matching readback as verified", () => {
    expect(
      isVerified({
        id: "verify",
        actionResultId: "result",
        expected: "4:30 PM",
        observed: "4:30 PM",
        status: "verified",
        verifiedAt: now.toISOString(),
      }),
    ).toBe(true);
    expect(
      isVerified({
        id: "verify",
        actionResultId: "result",
        expected: "4:30 PM",
        observed: "2:30 PM",
        status: "mismatch",
        verifiedAt: now.toISOString(),
      }),
    ).toBe(false);
  });
});
