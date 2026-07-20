import { describe, expect, it, vi } from "vitest";

import {
  GOOGLE_CALENDAR_EVENTS_ENDPOINT,
  GOOGLE_CALENDAR_MAX_PAGES,
  GOOGLE_CALENDAR_PAGE_SIZE,
  syncGoogleCalendar,
} from "./client";
import { GOOGLE_CALENDAR_CONNECTOR_ID } from "./config";

const NOW = new Date("2026-07-19T16:00:00.000Z");

function providerEvent(
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    status: "confirmed",
    summary: `Event ${id}`,
    start: { dateTime: "2026-07-20T14:00:00-04:00" },
    end: { dateTime: "2026-07-20T14:30:00-04:00" },
    transparency: "opaque",
    updated: "2026-07-19T15:00:00Z",
    attendees: [
      { self: true, responseStatus: "accepted" },
      { responseStatus: "declined" },
    ],
    ...overrides,
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("Google Calendar bounded client", () => {
  it("requests only the primary calendar with a bounded read-only projection", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        items: [
          providerEvent("private-id", {
            summary: "Private appointment",
            description: "Do not collect this note",
            location: "Do not collect this location",
            conferenceData: { entryPoints: [{ uri: "https://secret.test" }] },
          }),
        ],
      }),
    );

    const result = await syncGoogleCalendar(
      { now: NOW, accessToken: "secret-access-token" },
      { fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [input, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(input));
    expect(`${url.origin}${url.pathname}`).toBe(
      GOOGLE_CALENDAR_EVENTS_ENDPOINT,
    );
    expect(url.pathname).toContain("/calendars/primary/events");
    expect(url.searchParams.get("timeMin")).toBe("2026-07-18T16:00:00.000Z");
    expect(url.searchParams.get("timeMax")).toBe("2026-08-02T16:00:00.000Z");
    expect(url.searchParams.get("singleEvents")).toBe("true");
    expect(url.searchParams.get("orderBy")).toBe("startTime");
    expect(url.searchParams.get("showDeleted")).toBe("false");
    expect(url.searchParams.get("maxResults")).toBe("50");
    expect(url.searchParams.get("fields")).not.toMatch(
      /description|location|conferenceData|email/u,
    );
    expect(init).toMatchObject({
      method: "GET",
      cache: "no-store",
      redirect: "error",
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(url.toString()).not.toContain("secret-access-token");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a successful sync");
    expect(result.batch).toMatchObject({
      pageCount: 1,
      completeness: "complete",
      records: [
        {
          connectorId: GOOGLE_CALENDAR_CONNECTOR_ID,
          externalReference: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          payload: {
            title: "Private appointment",
            startAt: "2026-07-20T18:00:00.000Z",
            endAt: "2026-07-20T18:30:00.000Z",
            allDay: false,
            status: "confirmed",
            transparency: "opaque",
            selfResponseStatus: "accepted",
            updatedAt: "2026-07-19T15:00:00.000Z",
          },
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('private-id"');
    expect(JSON.stringify(result)).not.toMatch(
      /Do not collect|secret\.test|description|location|conferenceData/u,
    );
  });

  it("normalizes all-day events without retaining attendee identities", async () => {
    const body = {
      items: [
        providerEvent("all-day", {
          summary: "",
          start: { date: "2026-07-20" },
          end: { date: "2026-07-21" },
          transparency: undefined,
          attendees: [
            { email: "person@example.test", responseStatus: "accepted" },
          ],
        }),
      ],
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(body));

    const result = await syncGoogleCalendar(
      { now: NOW, accessToken: "token" },
      { fetchImpl },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a successful sync");
    expect(result.batch.records[0].payload).toEqual({
      title: "Busy event",
      startAt: "2026-07-20T00:00:00.000Z",
      endAt: "2026-07-21T00:00:00.000Z",
      allDay: true,
      status: "confirmed",
      transparency: "opaque",
      selfResponseStatus: "unknown",
      updatedAt: "2026-07-19T15:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toContain("person@example.test");
  });

  it("omits zero-duration point events without inventing scheduling time", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        items: [
          providerEvent("point", {
            end: { dateTime: "2026-07-20T14:00:00-04:00" },
          }),
          providerEvent("interval"),
        ],
      }),
    );

    const result = await syncGoogleCalendar(
      { now: NOW, accessToken: "token" },
      { fetchImpl },
    );

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("Expected a successful sync");
    expect(result.batch.records).toHaveLength(1);
    expect(result.batch.records[0]?.payload.title).toBe("Event interval");
  });

  it("removes line, control, and bidi spoofing characters from titles", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        items: [
          providerEvent("unsafe-title", {
            summary: "Project\r\nReview\u0000 \u202Eevil\u2066 note",
          }),
        ],
      }),
    );

    const result = await syncGoogleCalendar(
      { now: NOW, accessToken: "token" },
      { fetchImpl },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a successful sync");
    const title = result.batch.records[0].payload.title;
    expect(title).toBe("Project Review evil note");
    expect(title).not.toContain("\n");
    expect(title).not.toContain("\u0000");
    expect(title).not.toContain("\u202e");
    expect(title).not.toContain("\u2066");
  });

  it("paginates until the final page and never varies the bounded window", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ items: [providerEvent("one")], nextPageToken: "p2" }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [providerEvent("two")] }));

    const result = await syncGoogleCalendar(
      { now: NOW, accessToken: "token" },
      { fetchImpl },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a successful sync");
    expect(result.batch).toMatchObject({
      pageCount: 2,
      completeness: "complete",
    });
    expect(result.batch.records).toHaveLength(2);
    const urls = fetchImpl.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls[0].searchParams.get("pageToken")).toBeNull();
    expect(urls[1].searchParams.get("pageToken")).toBe("p2");
    expect(urls[1].searchParams.get("timeMin")).toBe(
      urls[0].searchParams.get("timeMin"),
    );
  });

  it("marks a fourth page with a continuation token as incomplete", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    for (let page = 0; page < GOOGLE_CALENDAR_MAX_PAGES; page += 1) {
      fetchImpl.mockResolvedValueOnce(
        jsonResponse({
          items: Array.from({ length: GOOGLE_CALENDAR_PAGE_SIZE }, (_, index) =>
            providerEvent(`event-${page}-${index}`),
          ),
          nextPageToken: `page-${page + 2}`,
        }),
      );
    }

    const result = await syncGoogleCalendar(
      { now: NOW, accessToken: "token" },
      { fetchImpl },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a bounded partial sync");
    expect(result.batch).toMatchObject({
      pageCount: 4,
      completeness: "page_cap",
    });
    expect(result.batch.records).toHaveLength(200);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("rejects repeated page tokens rather than looping", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ items: [providerEvent("one")], nextPageToken: "same" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [providerEvent("two")], nextPageToken: "same" }),
      );

    const result = await syncGoogleCalendar(
      { now: NOW, accessToken: "token" },
      { fetchImpl },
    );

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "invalid_response", retryable: false },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, "authentication_required", false],
    [403, "insufficient_scope", false],
    [503, "provider_unavailable", true],
  ] as const)(
    "maps HTTP %i without a retry loop",
    async (status, code, retryable) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse({}, status));

      const result = await syncGoogleCalendar(
        { now: NOW, accessToken: "token" },
        { fetchImpl },
      );

      expect(result).toMatchObject({ ok: false, failure: { code, retryable } });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it("distinguishes a quota-related 403 and caps Retry-After", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse(
          { error: { errors: [{ reason: "userRateLimitExceeded" }] } },
          403,
          { "retry-after": "999999" },
        ),
      );

    const result = await syncGoogleCalendar(
      { now: NOW, accessToken: "token" },
      { fetchImpl },
    );

    expect(result).toMatchObject({
      ok: false,
      failure: {
        code: "rate_limited",
        retryable: true,
        retryAfterSeconds: 3600,
      },
    });
  });

  it("maps HTTP 429 and an HTTP-date Retry-After", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({}, 429, {
        "retry-after": new Date(NOW.getTime() + 120_000).toUTCString(),
      }),
    );

    const result = await syncGoogleCalendar(
      { now: NOW, accessToken: "token" },
      { fetchImpl },
    );

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "rate_limited", retryAfterSeconds: 120 },
    });
  });

  it("classifies timeouts without retrying", async () => {
    const timeout = Object.assign(new Error("timed out"), {
      name: "TimeoutError",
    });
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(timeout);

    const result = await syncGoogleCalendar(
      { now: NOW, accessToken: "token" },
      { fetchImpl },
    );

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "timeout", retryable: true },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed event data and oversized responses", async () => {
    const malformedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ items: [providerEvent("bad", { end: {} })] }),
      );
    const oversizedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ padding: "x".repeat(300_000) }));

    await expect(
      syncGoogleCalendar(
        { now: NOW, accessToken: "token" },
        { fetchImpl: malformedFetch },
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "invalid_response" },
    });
    await expect(
      syncGoogleCalendar(
        { now: NOW, accessToken: "token" },
        { fetchImpl: oversizedFetch },
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "invalid_response" },
    });
  });

  it("rejects duplicate provider identifiers before normalization", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ items: [providerEvent("same"), providerEvent("same")] }),
      );

    const result = await syncGoogleCalendar(
      { now: NOW, accessToken: "token" },
      { fetchImpl },
    );

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "invalid_response" },
    });
  });
});
