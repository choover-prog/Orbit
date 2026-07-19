import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it } from "vitest";
import type { AttentionBundle, OrbitSnapshot } from "@/domain/orbit/connectors";
import { createClientFixtureSnapshot } from "@/mocks/orbit-snapshot";
import { QuietOrbitShell } from "./QuietOrbitShell";

function createWeatherSnapshot(): OrbitSnapshot {
  const base = createClientFixtureSnapshot();
  const evidence = {
    id: "evidence_weather_live",
    sourceLabel: "Open-Meteo forecast",
    summary: "Rain, 68°F, with an 82% peak precipitation probability.",
    observedAt: "2026-07-18T14:00:00.000Z",
    freshnessLabel: "Modeled forecast is current",
    epistemicStatus: "derived" as const,
    freshnessStatus: "fresh" as const,
    attribution: {
      label: "Weather data by Open-Meteo.com",
      url: "https://open-meteo.com/",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      transformed: true,
    },
  };
  const contextRecord = {
    id: "context_weather_live",
    domain: "weather" as const,
    kind: "modeled_forecast",
    occurredAt: evidence.observedAt,
    summary: evidence.summary,
    evidenceIds: [evidence.id],
  };
  const bundle: AttentionBundle = {
    id: "bundle_weather_live",
    kind: "weather",
    label: "Weather update",
    explanation:
      "Orbit surfaced this because modeled precipitation probability crosses the attention threshold.",
    item: {
      id: "attention_weather_live",
      title: "Rain is likely within six hours in Harbor City.",
      reason: "The modeled probability reaches 82%.",
      evidenceIds: [evidence.id],
      status: "active",
      otherEligibleCount: 0,
    },
    contextRecords: [contextRecord],
    evidence: [evidence],
    actionability: "read_only",
  };

  return {
    ...base,
    selectedAttentionId: bundle.id,
    attention: [bundle],
    contextRecords: [contextRecord],
    evidence: [evidence],
    weather: {
      status: "fresh",
      mode: "live",
      attention: bundle,
    },
  };
}

function createCalendarSnapshot(): OrbitSnapshot {
  const base = createClientFixtureSnapshot();
  const evidence = [
    {
      id: "evidence_calendar_first",
      sourceLabel: "Fictional Google Calendar fixture",
      summary: "Project Review runs from 2:30 PM to 3:15 PM.",
      observedAt: "2026-07-19T13:55:00.000Z",
      freshnessLabel: "Calendar data is current",
      epistemicStatus: "fact" as const,
      freshnessStatus: "fresh" as const,
    },
    {
      id: "evidence_calendar_second",
      sourceLabel: "Fictional Google Calendar fixture",
      summary: "Design Critique runs from 3:00 PM to 4:00 PM.",
      observedAt: "2026-07-19T13:56:00.000Z",
      freshnessLabel: "Calendar data is current",
      epistemicStatus: "fact" as const,
      freshnessStatus: "fresh" as const,
    },
  ];
  const contextRecords = evidence.map((item, index) => ({
    id: `context_calendar_${index}`,
    domain: "calendar" as const,
    kind: "scheduled_event",
    occurredAt: `2026-07-19T${index === 0 ? "14:30" : "15:00"}:00.000Z`,
    summary: item.summary,
    evidenceIds: [item.id],
  }));
  const bundle: AttentionBundle = {
    id: "bundle_calendar_conflict_test",
    kind: "calendar_conflict",
    label: "Calendar timing conflict",
    explanation:
      "Orbit found a direct overlap in fresh read-only Calendar data.",
    item: {
      id: "attention_calendar_conflict_test",
      title: "Project Review overlaps Design Critique.",
      reason: "The events overlap by 15 minutes.",
      evidenceIds: evidence.map((item) => item.id),
      status: "active",
      otherEligibleCount: 0,
    },
    contextRecords,
    evidence,
    actionability: "read_only",
  };

  return {
    ...base,
    selectedAttentionId: bundle.id,
    attention: [bundle],
    contextRecords,
    evidence,
    calendar: {
      status: "fresh",
      authorization: "connected",
      mode: "fixture",
      records: [],
      complete: true,
      eventCount: 2,
      attention: bundle,
    },
  };
}

describe("QuietOrbitShell", () => {
  beforeEach(() => window.localStorage.clear());

  it("moves from attention through progressive disclosure to verified completion and undo", async () => {
    const user = userEvent.setup();
    render(
      <QuietOrbitShell
        snapshot={createClientFixtureSnapshot()}
        initialState="attention"
      />,
    );

    expect(
      screen.getByRole("heading", { name: /flight lands ten minutes/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Talk it through" }));
    await user.click(
      screen.getByRole("button", { name: "What are my options?" }),
    );
    await user.click(screen.getByRole("button", { name: "Draft this" }));
    expect(
      screen.getByRole("heading", { name: /Move Project Review to 4:30 PM/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Approve mocked change" }),
    );
    expect(
      await screen.findByRole("heading", { name: /now at 4:30 PM/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Undo mocked change" }),
    );
    expect(
      await screen.findByRole("heading", { name: /back at 2:30 PM/i }),
    ).toBeInTheDocument();
  });

  it("shows a calm error when verification fails", async () => {
    const user = userEvent.setup();
    render(
      <QuietOrbitShell
        snapshot={createClientFixtureSnapshot()}
        initialState="action"
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Simulate a verification problem" }),
    );
    expect(
      await screen.findByRole("heading", { name: /could not confirm/i }),
    ).toBeInTheDocument();
  });

  it("keeps the resting state accessible", async () => {
    const { container } = render(
      <QuietOrbitShell
        snapshot={createClientFixtureSnapshot()}
        initialState="resting"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Nothing needs your attention." }),
    ).toBeInTheDocument();
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("applies the saved motion preference and exposes simulated listening", async () => {
    window.localStorage.setItem(
      "orbit.mock.preferences",
      JSON.stringify({
        proactiveAttention: true,
        voiceReplies: false,
        motionEnabled: false,
        conciseReplies: true,
      }),
    );
    const user = userEvent.setup();
    render(
      <QuietOrbitShell
        snapshot={createClientFixtureSnapshot()}
        initialState="attention"
      />,
    );

    expect(
      screen.getByRole("status", { name: "Orbit needs your attention" }),
    ).toHaveAttribute("data-motion", "off");

    await user.click(screen.getByRole("button", { name: "Listen" }));
    expect(
      screen.getByRole("status", { name: "Orbit is listening" }),
    ).toHaveAttribute("data-motion", "off");
  });

  it("shows attributed weather evidence without exposing an action path", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <QuietOrbitShell
        snapshot={createWeatherSnapshot()}
        initialState="attention"
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Rain is likely within six hours in Harbor City.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Weather data by Open-Meteo.com" }),
    ).toHaveAttribute("href", "https://open-meteo.com/");
    expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by/4.0/",
    );
    await user.click(screen.getByRole("button", { name: "Talk it through" }));
    expect(
      screen.queryByRole("button", { name: "What are my options?" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show the evidence" }));
    expect(screen.getByText("Open-Meteo forecast")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Weather data by Open-Meteo.com" }),
    ).toHaveAttribute("href", "https://open-meteo.com/");
    expect(screen.getByText(/This context is read-only/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Draft this" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve mocked change" }),
    ).not.toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: "Ask Orbit" }),
      "Move this event",
    );
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(container.querySelector("main")).toHaveAttribute(
      "data-experience-state",
      "conversation",
    );
    expect(
      screen.queryByRole("button", { name: "Approve mocked change" }),
    ).not.toBeInTheDocument();
  });

  it("guards action-like initial states for read-only context", () => {
    const { container } = render(
      <QuietOrbitShell
        snapshot={createWeatherSnapshot()}
        initialState="action"
      />,
    );

    expect(container.querySelector("main")).toHaveAttribute(
      "data-experience-state",
      "attention",
    );
    expect(
      screen.queryByRole("button", { name: "Approve mocked change" }),
    ).not.toBeInTheDocument();
  });

  it("keeps authenticated Calendar context read-only even after action-like input", async () => {
    const user = userEvent.setup();
    render(
      <QuietOrbitShell
        snapshot={createCalendarSnapshot()}
        initialState="attention"
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Project Review overlaps Design Critique.",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Talk it through" }));
    await user.click(screen.getByRole("button", { name: "Show the evidence" }));
    expect(screen.getByText(/This context is read-only/i)).toBeVisible();

    await user.type(
      screen.getByRole("textbox", { name: "Ask Orbit" }),
      "Move Project Review",
    );
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(
      screen.queryByRole("button", { name: "Approve mocked change" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Draft this" }),
    ).not.toBeInTheDocument();
  });

  it("falls back to quiet when the selected bundle is missing", () => {
    const snapshot = {
      ...createClientFixtureSnapshot(),
      selectedAttentionId: null,
      attention: [],
    };
    const { container } = render(
      <QuietOrbitShell snapshot={snapshot} initialState="completed" />,
    );

    expect(container.querySelector("main")).toHaveAttribute(
      "data-experience-state",
      "resting",
    );
    expect(
      screen.getByRole("heading", { name: "Nothing needs your attention." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No weather concern was inferred/i),
    ).toBeInTheDocument();
  });
});
