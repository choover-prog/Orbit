import path from "node:path";
import { describe, expect, it } from "vitest";
import { GOOGLE_NEST_SCOPE } from "./config";
import {
  createGoogleNestCredentialStore,
  googleNestCredentialPath,
  GoogleNestCredentialStoreError,
} from "./credential-store";

describe("Google Nest credential store", () => {
  it("keeps fixture credentials in an isolated memory store", async () => {
    const store = createGoogleNestCredentialStore({ mode: "fixture" });
    await store.save({
      version: 1,
      refreshToken: "fixture",
      grantedScopes: [GOOGLE_NEST_SCOPE],
      connectedAt: "2026-07-19T12:00:00Z",
    });
    expect(await store.load()).toMatchObject({
      refreshToken: "fixture",
      grantedScopes: [GOOGLE_NEST_SCOPE],
    });
    await store.delete();
    expect(await store.load()).toBeNull();
  });

  it("uses a Nest-only local vault path and fails closed off Windows", () => {
    expect(googleNestCredentialPath("C:\\Local")).toBe(
      path.join("C:\\Local", "Orbit", "google-nest.credentials.dpapi"),
    );
    expect(() =>
      createGoogleNestCredentialStore({
        mode: "live",
        platform: "linux",
        localAppData: "/tmp",
      }),
    ).toThrow(GoogleNestCredentialStoreError);
  });
});
