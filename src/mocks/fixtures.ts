import type {
  ActionProposal,
  AttentionItem,
  ConnectionStatus,
  ContextRecord,
  PersonReference,
  Recommendation,
  SourceEvidence,
} from "@/domain/orbit/types";

export const maya: PersonReference = {
  id: "person_maya",
  displayName: "Maya Chen",
  initials: "MC",
  relationshipScope: "self",
};

export const attendees: PersonReference[] = [
  {
    id: "person_amina",
    displayName: "Amina Patel",
    initials: "AP",
    relationshipScope: "contact",
  },
  {
    id: "person_theo",
    displayName: "Theo Martin",
    initials: "TM",
    relationshipScope: "contact",
  },
  {
    id: "person_luis",
    displayName: "Luis Rivera",
    initials: "LR",
    relationshipScope: "contact",
  },
];

export const evidence: SourceEvidence[] = [
  {
    id: "evidence_flight",
    sourceLabel: "Travel itinerary",
    summary:
      "Flight OA 218 is scheduled to arrive at 2:20 PM at Harbor Airport.",
    observedAt: "2026-07-16T08:17:00-04:00",
    freshnessLabel: "Updated 7 minutes ago",
    epistemicStatus: "fact",
  },
  {
    id: "evidence_meeting",
    sourceLabel: "Work calendar",
    summary: "Project Review begins at 2:30 PM with three attendees.",
    observedAt: "2026-07-16T08:15:00-04:00",
    freshnessLabel: "Confirmed this morning",
    epistemicStatus: "fact",
  },
  {
    id: "evidence_travel_time",
    sourceLabel: "Travel estimate",
    summary:
      "The airport-to-office trip usually takes 35–50 minutes at that time.",
    observedAt: "2026-07-16T08:20:00-04:00",
    freshnessLabel: "Estimated now",
    epistemicStatus: "derived",
  },
];

export const contextRecords: ContextRecord[] = [
  {
    id: "context_flight",
    domain: "travel",
    kind: "arrival",
    occurredAt: "2026-07-16T14:20:00-04:00",
    summary: "OA 218 arrives at 2:20 PM",
    evidenceIds: ["evidence_flight"],
  },
  {
    id: "context_review",
    domain: "calendar",
    kind: "meeting",
    occurredAt: "2026-07-16T14:30:00-04:00",
    summary: "Project Review begins at 2:30 PM",
    evidenceIds: ["evidence_meeting"],
  },
];

export const travelConflict: AttentionItem = {
  id: "attention_travel_conflict",
  title: "Your flight lands ten minutes before Project Review begins.",
  reason: "The usual travel time makes arriving in person impossible.",
  evidenceIds: evidence.map((item) => item.id),
  status: "active",
  otherEligibleCount: 2,
};

export const travelRecommendation: Recommendation = {
  id: "recommendation_move_review",
  attentionItemId: travelConflict.id,
  rationale:
    "Moving the review to 4:30 PM preserves the full meeting and gives you time to reach the office.",
  options: [
    { id: "option_move", label: "Move the review to 4:30 PM", available: true },
    {
      id: "option_phone",
      label: "Join by phone after landing",
      available: true,
    },
    { id: "option_keep", label: "Leave it unchanged", available: true },
  ],
};

export const moveReviewProposal: ActionProposal = {
  id: "proposal_move_review",
  recommendationId: travelRecommendation.id,
  capability: "calendar.event.update",
  summary: "Move Project Review from 2:30 PM to 4:30 PM",
  affectedPeople: attendees,
  expectedEffect: "Project Review · July 16 · 4:30–5:15 PM",
  previousValue: "Project Review · July 16 · 2:30–3:15 PM",
  nextValue: "Project Review · July 16 · 4:30–5:15 PM",
  planHash: "sha256:fictional-orbit-plan-4-30",
  reversible: true,
};

export const connections: ConnectionStatus[] = [
  {
    id: "connection_calendar",
    displayName: "Calendar",
    category: "calendar",
    mode: "mock",
    health: "connected",
    capabilities: [
      {
        id: "calendar_read",
        label: "Read event titles and times",
        access: "read",
      },
      {
        id: "calendar_update",
        label: "Update an event after approval",
        access: "write",
      },
    ],
    lastSyncLabel: "Mock sync · 2 minutes ago",
  },
  {
    id: "connection_email",
    displayName: "Email",
    category: "email",
    mode: "mock",
    health: "connected",
    capabilities: [
      {
        id: "email_read",
        label: "Read matching thread metadata",
        access: "read",
      },
    ],
    lastSyncLabel: "Mock sync · 5 minutes ago",
  },
  {
    id: "connection_weather",
    displayName: "Weather",
    category: "weather",
    mode: "mock",
    health: "connected",
    capabilities: [
      { id: "weather_read", label: "Read local forecast", access: "read" },
    ],
    lastSyncLabel: "Mock sync · 12 minutes ago",
  },
  {
    id: "connection_home",
    displayName: "Home",
    category: "home",
    mode: "mock",
    health: "paused",
    capabilities: [
      { id: "home_read", label: "Read selected device status", access: "read" },
    ],
    lastSyncLabel: "Paused locally",
  },
];
