import { describe, expect, it } from "vitest";
import { moveReviewProposal } from "./fixtures";
import { createMockCalendarAdapter } from "./calendar-adapter";

const fixedNow = new Date("2026-07-16T12:00:00.000Z");
const approval = {
  id: "approval_test",
  proposalId: moveReviewProposal.id,
  planHash: moveReviewProposal.planHash,
  riskClass: "R3" as const,
  permissionLabel: "Update once",
  expiresAt: "2026-07-16T12:05:00.000Z",
  state: "approved" as const,
};

describe("mock calendar adapter", () => {
  it("executes, verifies, audits, and offers undo", async () => {
    const adapter = createMockCalendarAdapter(() => fixedNow);
    const record = await adapter.execute(moveReviewProposal, approval);

    expect(record.verification.status).toBe("verified");
    expect(record.undo.status).toBe("available");
    expect(record.events.map((event) => event.eventType)).toEqual([
      "proposal_created",
      "approval_granted",
      "execution_accepted",
      "verification_succeeded",
    ]);

    const undone = await adapter.undo(record);
    expect(undone.undo.status).toBe("verified");
    expect(undone.events.at(-1)?.eventType).toBe("undo_verified");
  });

  it("does not claim success when readback mismatches", async () => {
    const adapter = createMockCalendarAdapter(() => fixedNow);
    const record = await adapter.execute(moveReviewProposal, approval, {
      forceVerificationFailure: true,
    });

    expect(record.result.state).toBe("accepted");
    expect(record.verification.status).toBe("mismatch");
    expect(record.undo.status).toBe("failed");
  });

  it("rejects execution without matching approval", async () => {
    const adapter = createMockCalendarAdapter(() => fixedNow);
    await expect(
      adapter.execute(moveReviewProposal, { ...approval, planHash: "wrong" }),
    ).rejects.toThrow(/exact proposed action/i);
  });
});
