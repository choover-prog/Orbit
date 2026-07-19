import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GMAIL_READONLY_SCOPE } from "./config";
import {
  FileGmailCredentialStore,
  GMAIL_DPAPI_PROTECT_SCRIPT,
  GMAIL_DPAPI_UNPROTECT_SCRIPT,
  GmailCredentialStoreError,
  MemoryGmailCredentialStore,
  WindowsGmailDpapiCurrentUserProtector,
  createGmailCredentialStore,
  gmailCredentialPath,
  type GmailCredential,
  type GmailSecretProtector,
} from "./credential-store";

const credential: GmailCredential = {
  version: 1,
  refreshToken: "test-gmail-refresh-token",
  grantedScopes: [GMAIL_READONLY_SCOPE],
  connectedAt: "2026-07-19T12:00:00.000Z",
};
const temporaryDirectories: string[] = [];

async function temporaryPath(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "orbit-gmail-vault-test-"),
  );
  temporaryDirectories.push(directory);
  return path.join(directory, "nested", "gmail.dpapi");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const xorProtector: GmailSecretProtector = {
  async protect(plaintext) {
    return Buffer.from(plaintext.map((byte) => byte ^ 0x5a));
  },
  async unprotect(ciphertext) {
    return Buffer.from(ciphertext.map((byte) => byte ^ 0x5a));
  },
};

describe("FileGmailCredentialStore", () => {
  it("atomically stores encrypted credentials and deletes them", async () => {
    const filePath = await temporaryPath();
    const store = new FileGmailCredentialStore(xorProtector, filePath);
    await store.save(credential);
    expect((await readFile(filePath)).toString("utf8")).not.toContain(
      "test-gmail-refresh-token",
    );
    await expect(store.load()).resolves.toEqual(credential);
    await store.delete();
    await expect(store.load()).resolves.toBeNull();
  });

  it("enforces the exact Gmail-only schema and refuses access-token persistence", async () => {
    const filePath = await temporaryPath();
    const identity: GmailSecretProtector = {
      async protect(value) {
        return Buffer.from(value);
      },
      async unprotect(value) {
        return Buffer.from(value);
      },
    };
    const store = new FileGmailCredentialStore(identity, filePath);
    await expect(
      store.save({
        ...credential,
        grantedScopes: ["https://www.googleapis.com/auth/gmail.modify"],
      }),
    ).rejects.toMatchObject({ code: "invalid_credentials" });
    await expect(
      store.save({
        ...credential,
        accessToken: "must-never-be-persisted",
      } as GmailCredential),
    ).rejects.toMatchObject({ code: "invalid_credentials" });
    await store.save(credential);
    await writeFile(filePath, Buffer.from("not-json", "utf8"));
    await expect(store.load()).rejects.toMatchObject({
      code: "invalid_credentials",
    });
  });

  it("deletes encrypted temporary files left by an interrupted atomic write", async () => {
    const filePath = await temporaryPath();
    const store = new FileGmailCredentialStore(xorProtector, filePath);
    await store.save(credential);
    const orphan = `${filePath}.tmp-interrupted`;
    await writeFile(orphan, Buffer.from("encrypted-orphan", "utf8"));
    await store.delete();
    await expect(stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(orphan)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("WindowsGmailDpapiCurrentUserProtector", () => {
  it("uses Gmail-specific constant scripts and stdin", async () => {
    const run = vi.fn(async (script: string, stdin: string) => {
      if (script === GMAIL_DPAPI_PROTECT_SCRIPT)
        return Buffer.from(`wrapped:${stdin}`, "utf8").toString("base64");
      return Buffer.from(stdin, "base64")
        .toString("utf8")
        .slice("wrapped:".length);
    });
    const protector = new WindowsGmailDpapiCurrentUserProtector({
      platform: "win32",
      runPowerShell: run,
    });
    const plaintext = Buffer.from("gmail-sensitive-refresh-token", "utf8");
    const ciphertext = await protector.protect(plaintext);
    await expect(protector.unprotect(ciphertext)).resolves.toEqual(plaintext);
    expect(run).toHaveBeenNthCalledWith(
      1,
      GMAIL_DPAPI_PROTECT_SCRIPT,
      plaintext.toString("base64"),
    );
    expect(GMAIL_DPAPI_PROTECT_SCRIPT).not.toContain("GoogleCalendar");
    expect(GMAIL_DPAPI_UNPROTECT_SCRIPT).not.toContain("GoogleCalendar");
  });

  it("fails closed outside Windows", async () => {
    await expect(
      new WindowsGmailDpapiCurrentUserProtector({ platform: "linux" }).protect(
        Buffer.from("secret"),
      ),
    ).rejects.toEqual(expect.objectContaining({ code: "storage_unavailable" }));
  });
});

describe("Gmail credential-store factory", () => {
  it("uses memory for fixtures, refuses live storage off Windows, and has a distinct path", () => {
    expect(createGmailCredentialStore({ mode: "fixture" })).toBeInstanceOf(
      MemoryGmailCredentialStore,
    );
    expect(() =>
      createGmailCredentialStore({ mode: "live", platform: "linux" }),
    ).toThrow(GmailCredentialStoreError);
    expect(gmailCredentialPath("C:\\LocalAppData")).toBe(
      path.join("C:\\LocalAppData", "Orbit", "gmail.credentials.dpapi"),
    );
  });
});
