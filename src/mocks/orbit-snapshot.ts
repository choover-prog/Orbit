import type { AttentionBundle, OrbitSnapshot } from "@/domain/orbit/connectors";
import {
  connections,
  contextRecords,
  evidence,
  maya,
  moveReviewProposal,
  travelConflict,
  travelRecommendation,
} from "./fixtures";

export const travelAttentionBundle: AttentionBundle = {
  id: "bundle_travel_conflict",
  kind: "travel_conflict",
  label: "Travel conflict",
  explanation:
    "There is only a ten-minute gap. The usual airport-to-office trip takes at least 35 minutes.",
  item: travelConflict,
  contextRecords,
  evidence,
  recommendation: travelRecommendation,
  actionProposal: moveReviewProposal,
  actionability: "mocked_action",
};

export function createClientFixtureSnapshot(): OrbitSnapshot {
  return {
    schemaVersion: "1",
    generatedAt: "2026-07-18T14:00:00.000Z",
    requestedContext: null,
    person: maya,
    selectedAttentionId: travelAttentionBundle.id,
    attention: [travelAttentionBundle],
    contextRecords,
    evidence,
    sourceRecords: [],
    connections,
    weather: {
      status: "unavailable",
      mode: "fixture",
      failure: {
        code: "configuration_required",
        message: "Weather is not loaded in this client-only test snapshot.",
        retryable: false,
      },
    },
    calendar: {
      status: "disconnected",
      authorization: "disconnected",
      mode: "fixture",
      records: [],
      complete: true,
      eventCount: 0,
    },
    email: {
      status: "disconnected",
      authorization: "disconnected",
      mode: "fixture",
      records: [],
      complete: true,
      messageCount: 0,
    },
  };
}
