import { describe, expect, it } from "vitest";
import { isTrustedLocalMutation } from "./same-origin";

function request(
  url: string,
  origin?: string,
  fetchSite = (() => {
    try {
      return origin && new URL(origin).origin === new URL(url).origin
        ? "same-origin"
        : "cross-site";
    } catch {
      return "cross-site";
    }
  })(),
) {
  return new Request(url, {
    method: "POST",
    headers: {
      host: new URL(url).host,
      ...(origin ? { origin } : {}),
      "sec-fetch-site": fetchSite,
    },
  });
}

describe("isTrustedLocalMutation", () => {
  it("accepts the exact loopback origin", () => {
    expect(
      isTrustedLocalMutation(
        request(
          "http://127.0.0.1:3000/api/connectors/calendar/sync",
          "http://127.0.0.1:3000",
        ),
      ),
    ).toBe(true);
  });

  it.each([
    ["missing origin", undefined],
    ["different port", "http://127.0.0.1:4000"],
    ["localhost alias", "http://localhost:3000"],
    ["remote host", "https://example.com"],
    ["opaque origin", "null"],
  ])("rejects %s", (_label, origin) => {
    expect(
      isTrustedLocalMutation(
        request("http://127.0.0.1:3000/api/connectors/calendar/sync", origin),
      ),
    ).toBe(false);
  });

  it("rejects a non-loopback request URL even with a loopback Origin", () => {
    const candidate = new Request(
      "http://attacker.example:3000/api/connectors/calendar/sync",
      {
        method: "POST",
        headers: {
          host: "attacker.example:3000",
          origin: "http://127.0.0.1:3000",
          "sec-fetch-site": "same-origin",
        },
      },
    );
    expect(isTrustedLocalMutation(candidate)).toBe(false);
  });

  it("accepts Next's internal localhost normalization only with exact 127 Origin and port", () => {
    expect(
      isTrustedLocalMutation(
        request(
          "http://localhost:3000/api/connectors/calendar/sync",
          "http://127.0.0.1:3000",
          "same-origin",
        ),
      ),
    ).toBe(true);
  });

  it("rejects a non-same-origin Fetch Metadata signal", () => {
    expect(
      isTrustedLocalMutation(
        request(
          "http://localhost:3000/api/connectors/calendar/sync",
          "http://127.0.0.1:3000",
          "same-site",
        ),
      ),
    ).toBe(false);
  });
});
