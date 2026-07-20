import { describe, expect, it, vi } from "vitest";
import { GOOGLE_NEST_SCOPE } from "./config";
import { MemoryGoogleNestCredentialStore } from "./credential-store";
import { completeGoogleNestAuthorization } from "./oauth";

describe("Google Nest OAuth exchange", () => {
  it("keeps code and verifier in the server token exchange", async () => {
    const fetchImpl = vi.fn(async (_input, init?: RequestInit) => {
      const params = new URLSearchParams(String(init?.body));
      expect(params.get("code")).toBe("authorization-code");
      expect(params.get("code_verifier")).toBe("server-verifier");
      return Response.json({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
        scope: GOOGLE_NEST_SCOPE,
        token_type: "Bearer",
      });
    });
    const credentials = new MemoryGoogleNestCredentialStore();
    const token = await completeGoogleNestAuthorization(
      { code: "authorization-code", state: "state", cookieBinding: "binding" },
      {
        clientId: "client",
        clientSecret: "secret",
        projectId: "project",
        redirectUri: "http://127.0.0.1:3000",
      },
      { consume: () => "server-verifier" } as never,
      credentials,
      fetchImpl as typeof fetch,
    );
    expect(token.accessToken).toBe("access");
    expect(await credentials.load()).toMatchObject({ refreshToken: "refresh" });
  });
});
