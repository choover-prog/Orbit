import { describe, expect, it, vi } from "vitest";
import {
  GMAIL_MAX_MESSAGES,
  GMAIL_MESSAGES_ENDPOINT,
  syncGmail,
} from "./client";

const NOW = new Date("2026-07-19T16:00:00.000Z");

function json(value: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("syncGmail", () => {
  it("performs a bounded unread-Inbox read and normalizes only allowed fields", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ messages: [{ id: "provider-message-1" }] }))
      .mockResolvedValueOnce(
        json({
          id: "provider-message-1",
          threadId: "provider-thread-1",
          labelIds: ["INBOX", "UNREAD", "IMPORTANT"],
          snippet: "Preview\u202e text",
          internalDate: String(NOW.getTime() - 60_000),
          payload: { headers: [{ name: "Subject", value: "Project Review" }] },
        }),
      );

    const result = await syncGmail(
      { now: NOW, accessToken: "access-token" },
      { fetchImpl },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.completeness).toBe("complete");
    expect(result.batch.records).toHaveLength(1);
    expect(result.batch.records[0]).toMatchObject({
      connectorId: "email.google",
      externalReference: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      provenance: { sourceLabel: "Gmail (read only)" },
      payload: {
        subject: "Project Review",
        snippet: "Preview text",
        unread: true,
        inbox: true,
        important: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain("provider-message-1");
    expect(JSON.stringify(result)).not.toContain("provider-thread-1");

    const listUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(listUrl.origin + listUrl.pathname).toBe(GMAIL_MESSAGES_ENDPOINT);
    expect(listUrl.searchParams.getAll("labelIds")).toEqual([
      "INBOX",
      "UNREAD",
    ]);
    expect(listUrl.searchParams.get("maxResults")).toBe(
      String(GMAIL_MAX_MESSAGES),
    );
    expect(listUrl.searchParams.get("includeSpamTrash")).toBe("false");
    expect(listUrl.searchParams.get("q")).toBe("newer_than:7d");

    const detailUrl = new URL(String(fetchImpl.mock.calls[1]?.[0]));
    expect(detailUrl.searchParams.get("format")).toBe("metadata");
    expect(detailUrl.searchParams.getAll("metadataHeaders")).toEqual([
      "Subject",
    ]);
    expect(detailUrl.searchParams.get("fields")).toBe(
      "id,threadId,labelIds,snippet,internalDate,payload(headers(name,value))",
    );
    expect(String(fetchImpl.mock.calls[1]?.[0])).not.toMatch(
      /raw|attachment|body|to|from|cc/iu,
    );
  });

  it("marks a capped list incomplete so it cannot create attention", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(
      json({ messages: [], nextPageToken: "more-private-data" }),
    );

    const result = await syncGmail(
      { now: NOW, accessToken: "access-token" },
      { fetchImpl },
    );
    expect(result).toMatchObject({
      ok: true,
      batch: { completeness: "message_cap", records: [] },
    });
  });

  it("fails closed on messages outside the unread Inbox boundary", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ messages: [{ id: "id-1" }] }))
      .mockResolvedValueOnce(
        json({
          id: "id-1",
          labelIds: ["INBOX"],
          snippet: "Fixture preview",
          internalDate: String(NOW.getTime()),
          payload: { headers: [{ name: "Subject", value: "Fixture subject" }] },
        }),
      );

    await expect(
      syncGmail({ now: NOW, accessToken: "access-token" }, { fetchImpl }),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "invalid_response" },
    });
  });

  it("exposes bounded provider backoff without provider response content", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      json({ error: { message: "private provider detail" } }, 429, {
        "retry-after": "90",
      }),
    );
    const result = await syncGmail(
      { now: NOW, accessToken: "access-token" },
      { fetchImpl },
    );
    expect(result).toEqual({
      ok: false,
      failure: {
        code: "rate_limited",
        message: "Gmail temporarily limited synchronization.",
        retryable: true,
        retryAfterSeconds: 90,
      },
    });
    expect(JSON.stringify(result)).not.toContain("private provider detail");
  });

  it("rejects oversized responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": String(128 * 1_024 + 1),
        },
      }),
    );
    await expect(
      syncGmail({ now: NOW, accessToken: "access-token" }, { fetchImpl }),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "invalid_response" },
    });
  });
});
