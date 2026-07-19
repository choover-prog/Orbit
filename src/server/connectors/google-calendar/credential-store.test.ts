import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GOOGLE_CALENDAR_READONLY_SCOPE } from "./config";
import {
  DPAPI_PROTECT_SCRIPT,
  DPAPI_UNPROTECT_SCRIPT,
  FileGoogleCalendarCredentialStore,
  GoogleCalendarCredentialStoreError,
  MemoryGoogleCalendarCredentialStore,
  WindowsDpapiCurrentUserProtector,
  createGoogleCalendarCredentialStore,
  googleCalendarCredentialPath,
  type GoogleCalendarCredential,
  type SecretProtector,
} from "./credential-store";

const credential: GoogleCalendarCredential = {
  version: 1,
  refreshToken: "test-refresh-token",
  grantedScopes: [GOOGLE_CALENDAR_READONLY_SCOPE],
  connectedAt: "2026-07-19T12:00:00.000Z",
};

const temporaryDirectories: string[] = [];

async function temporaryPath(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "orbit-vault-test-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "nested", "calendar.dpapi");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const xorProtector: SecretProtector = {
  async protect(plaintext) {
    return Buffer.from(plaintext.map((byte) => byte ^ 0x5a));
  },
  async unprotect(ciphertext) {
    return Buffer.from(ciphertext.map((byte) => byte ^ 0x5a));
  },
};

describe("FileGoogleCalendarCredentialStore", () => {
  it("atomically stores encrypted credentials and deletes them", async () => {
    const filePath = await temporaryPath();
    const store = new FileGoogleCalendarCredentialStore(xorProtector, filePath);

    await store.save(credential);
    const storedBytes = await readFile(filePath);

    expect(storedBytes.toString("utf8")).not.toContain("test-refresh-token");
    await expect(store.load()).resolves.toEqual(credential);

    await store.delete();
    await expect(store.load()).resolves.toBeNull();
  });

  it("validates decrypted data and refuses accidental access-token persistence", async () => {
    const filePath = await temporaryPath();
    const identityProtector: SecretProtector = {
      async protect(value) {
        return Buffer.from(value);
      },
      async unprotect(value) {
        return Buffer.from(value);
      },
    };
    const store = new FileGoogleCalendarCredentialStore(
      identityProtector,
      filePath,
    );

    await expect(
      store.save({
        ...credential,
        accessToken: "must-never-be-persisted",
      } as GoogleCalendarCredential),
    ).rejects.toMatchObject({ code: "invalid_credentials" });

    await store.save(credential);
    await writeFile(filePath, Buffer.from("not-json", "utf8"));
    await expect(store.load()).rejects.toMatchObject({
      code: "invalid_credentials",
    });
  });

  it("deletes encrypted temporary files left by an interrupted atomic write", async () => {
    const filePath = await temporaryPath();
    const store = new FileGoogleCalendarCredentialStore(xorProtector, filePath);
    await store.save(credential);
    const orphan = `${filePath}.tmp-interrupted`;
    await writeFile(orphan, Buffer.from("encrypted-orphan", "utf8"));

    await store.delete();

    await expect(stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(orphan)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("WindowsDpapiCurrentUserProtector", () => {
  it.runIf(process.platform === "win32")(
    "round-trips bytes through the real CurrentUser DPAPI helper",
    async () => {
      const protector = new WindowsDpapiCurrentUserProtector();
      const plaintext = Buffer.from(
        `orbit-dpapi-probe-${process.pid}-${Date.now()}`,
        "utf8",
      );

      const ciphertext = await protector.protect(plaintext);

      expect(ciphertext).not.toEqual(plaintext);
      await expect(protector.unprotect(ciphertext)).resolves.toEqual(plaintext);
    },
    15_000,
  );

  it("sends sensitive bytes only over stdin to constant DPAPI scripts", async () => {
    const run = vi.fn(async (script: string, stdin: string) => {
      if (script === DPAPI_PROTECT_SCRIPT) {
        return Buffer.from(`wrapped:${stdin}`, "utf8").toString("base64");
      }
      const wrapped = Buffer.from(stdin, "base64").toString("utf8");
      return wrapped.slice("wrapped:".length);
    });
    const protector = new WindowsDpapiCurrentUserProtector({
      platform: "win32",
      runPowerShell: run,
    });
    const plaintext = Buffer.from("sensitive-refresh-token", "utf8");

    const ciphertext = await protector.protect(plaintext);
    const recovered = await protector.unprotect(ciphertext);

    expect(recovered).toEqual(plaintext);
    expect(run).toHaveBeenNthCalledWith(
      1,
      DPAPI_PROTECT_SCRIPT,
      plaintext.toString("base64"),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      DPAPI_UNPROTECT_SCRIPT,
      ciphertext.toString("base64"),
    );
    expect(DPAPI_PROTECT_SCRIPT).not.toContain("sensitive-refresh-token");
    expect(DPAPI_UNPROTECT_SCRIPT).not.toContain("sensitive-refresh-token");
  });

  it("fails closed outside Windows", async () => {
    const protector = new WindowsDpapiCurrentUserProtector({
      platform: "linux",
    });

    await expect(protector.protect(Buffer.from("secret"))).rejects.toEqual(
      expect.objectContaining({ code: "storage_unavailable" }),
    );
  });
});

describe("Google Calendar credential-store factory", () => {
  it("uses memory for fixtures and refuses live storage off Windows", () => {
    expect(
      createGoogleCalendarCredentialStore({ mode: "fixture" }),
    ).toBeInstanceOf(MemoryGoogleCalendarCredentialStore);

    expect(() =>
      createGoogleCalendarCredentialStore({
        mode: "live",
        platform: "linux",
      }),
    ).toThrow(GoogleCalendarCredentialStoreError);
  });

  it("keeps live credentials under local app data and fails closed without it", () => {
    expect(googleCalendarCredentialPath("C:\\LocalAppData")).toBe(
      path.join(
        "C:\\LocalAppData",
        "Orbit",
        "google-calendar.credentials.dpapi",
      ),
    );
    expect(() => googleCalendarCredentialPath("")).toThrow(
      expect.objectContaining({ code: "storage_unavailable" }),
    );
  });
});
