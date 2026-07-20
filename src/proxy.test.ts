import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config, isTrustedOrbitLoopbackHost, proxy } from "./proxy";

describe("Orbit local request boundary", () => {
  it.each(["/", "/connections", "/api/orbit/snapshot", "/?__rsc=probe"])(
    "runs before the personal route %s",
    (url) => {
      expect(
        unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }),
      ).toBe(true);
    },
  );

  it.each([
    "attacker.example:3000",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:0",
    "127.0.0.1:65536",
    "127.0.0.1:3000@attacker.example",
    "[::1]:3000",
    "",
  ])("rejects an untrusted Host value: %s", (host) => {
    expect(isTrustedOrbitLoopbackHost(host)).toBe(false);
  });

  it("accepts only the explicit IPv4 loopback host with a bounded port", () => {
    expect(isTrustedOrbitLoopbackHost("127.0.0.1:3000")).toBe(true);
    expect(isTrustedOrbitLoopbackHost("127.0.0.1:65535")).toBe(true);
  });

  it("blocks a rebinding request before a personal route can execute", () => {
    const response = proxy(
      new NextRequest("http://127.0.0.1:3000/api/orbit/snapshot", {
        headers: {
          host: "attacker.example:3000",
          origin: "http://attacker.example:3000",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("allows an exact loopback request and hardens the response", () => {
    const response = proxy(
      new NextRequest("http://127.0.0.1:3000/connections", {
        headers: { host: "127.0.0.1:3000" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("referrer-policy")).toBe("same-origin");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});
