import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { GMAIL_READONLY_SCOPE } from "./config";

const CREDENTIAL_SCHEMA_VERSION = 1;
const MAX_CREDENTIAL_BYTES = 128 * 1_024;
const POWERSHELL_TIMEOUT_MS = 5_000;
const DPAPI_ENTROPY_BASE64 = Buffer.from(
  "Orbit.Gmail.Credentials.v1",
  "utf8",
).toString("base64");

export const GMAIL_CREDENTIAL_RELATIVE_PATH = path.join(
  "Orbit",
  "gmail.credentials.dpapi",
);

export const GMAIL_DPAPI_PROTECT_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$inputBase64 = [Console]::In.ReadToEnd().Trim()
$plainBytes = [Convert]::FromBase64String($inputBase64)
$entropy = [Convert]::FromBase64String('${DPAPI_ENTROPY_BASE64}')
$cipherBytes = [System.Security.Cryptography.ProtectedData]::Protect(
  $plainBytes,
  $entropy,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
[Console]::Out.Write([Convert]::ToBase64String($cipherBytes))
`;

export const GMAIL_DPAPI_UNPROTECT_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$inputBase64 = [Console]::In.ReadToEnd().Trim()
$cipherBytes = [Convert]::FromBase64String($inputBase64)
$entropy = [Convert]::FromBase64String('${DPAPI_ENTROPY_BASE64}')
$plainBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
  $cipherBytes,
  $entropy,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
[Console]::Out.Write([Convert]::ToBase64String($plainBytes))
`;

export interface GmailCredential {
  version: 1;
  refreshToken: string;
  grantedScopes: string[];
  connectedAt: string;
}

export interface GmailCredentialStore {
  load(): Promise<GmailCredential | null>;
  save(credential: GmailCredential): Promise<void>;
  delete(): Promise<void>;
}

export interface GmailSecretProtector {
  protect(plaintext: Uint8Array): Promise<Buffer>;
  unprotect(ciphertext: Uint8Array): Promise<Buffer>;
}

export class GmailCredentialStoreError extends Error {
  constructor(
    public readonly code:
      "storage_unavailable" | "invalid_credentials" | "io_error",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GmailCredentialStoreError";
  }
}

export type GmailPowerShellStdinRunner = (
  script: string,
  stdin: string,
) => Promise<string>;

function runPowerShellWithStdin(
  script: string,
  stdin: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderrSize = 0;
    let settled = false;
    const finish = (operation: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      operation();
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(() =>
        reject(
          new GmailCredentialStoreError(
            "io_error",
            "The Windows credential protector timed out.",
          ),
        ),
      );
    }, POWERSHELL_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > MAX_CREDENTIAL_BYTES * 2) child.kill();
    });
    child.stderr.on("data", (chunk: string) => {
      stderrSize += chunk.length;
      if (stderrSize > MAX_CREDENTIAL_BYTES) child.kill();
    });
    child.on("error", () => {
      finish(() =>
        reject(
          new GmailCredentialStoreError(
            "io_error",
            "The Windows credential protector could not start.",
          ),
        ),
      );
    });
    child.on("close", (code) => {
      finish(() => {
        if (code !== 0 || stdout.length > MAX_CREDENTIAL_BYTES * 2) {
          reject(
            new GmailCredentialStoreError(
              "io_error",
              "The Windows credential protector failed.",
            ),
          );
          return;
        }
        resolve(stdout.trim());
      });
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(stdin);
  });
}

export interface WindowsGmailDpapiProtectorOptions {
  platform?: NodeJS.Platform;
  runPowerShell?: GmailPowerShellStdinRunner;
}

/** Protects Gmail bytes for the current Windows user via connector-specific DPAPI entropy. */
export class WindowsGmailDpapiCurrentUserProtector implements GmailSecretProtector {
  private readonly platform: NodeJS.Platform;
  private readonly run: GmailPowerShellStdinRunner;

  constructor(options: WindowsGmailDpapiProtectorOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.run = options.runPowerShell ?? runPowerShellWithStdin;
  }

  async protect(plaintext: Uint8Array): Promise<Buffer> {
    this.assertWindows();
    return this.transform(GMAIL_DPAPI_PROTECT_SCRIPT, plaintext);
  }

  async unprotect(ciphertext: Uint8Array): Promise<Buffer> {
    this.assertWindows();
    return this.transform(GMAIL_DPAPI_UNPROTECT_SCRIPT, ciphertext);
  }

  private assertWindows(): void {
    if (this.platform !== "win32") {
      throw new GmailCredentialStoreError(
        "storage_unavailable",
        "Live Gmail credentials require Windows DPAPI in this local-only slice.",
      );
    }
  }

  private async transform(script: string, input: Uint8Array): Promise<Buffer> {
    if (input.byteLength === 0 || input.byteLength > MAX_CREDENTIAL_BYTES) {
      throw new GmailCredentialStoreError(
        "invalid_credentials",
        "Gmail credential data has an invalid size.",
      );
    }
    try {
      const decoded = Buffer.from(
        await this.run(script, Buffer.from(input).toString("base64")),
        "base64",
      );
      if (
        decoded.byteLength === 0 ||
        decoded.byteLength > MAX_CREDENTIAL_BYTES
      ) {
        throw new Error("invalid output size");
      }
      return decoded;
    } catch (error) {
      if (error instanceof GmailCredentialStoreError) throw error;
      throw new GmailCredentialStoreError(
        "io_error",
        "The Windows credential protector returned invalid data.",
        { cause: error },
      );
    }
  }
}

function validateCredential(value: unknown): GmailCredential {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GmailCredentialStoreError(
      "invalid_credentials",
      "Stored Gmail credentials are invalid.",
    );
  }
  const candidate = value as Record<string, unknown>;
  const expectedKeys = [
    "connectedAt",
    "grantedScopes",
    "refreshToken",
    "version",
  ];
  const actualKeys = Object.keys(candidate).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    candidate.version !== CREDENTIAL_SCHEMA_VERSION ||
    typeof candidate.refreshToken !== "string" ||
    candidate.refreshToken.length === 0 ||
    candidate.refreshToken.length > 16_384 ||
    typeof candidate.connectedAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.connectedAt)) ||
    !Array.isArray(candidate.grantedScopes) ||
    candidate.grantedScopes.length !== 1 ||
    candidate.grantedScopes[0] !== GMAIL_READONLY_SCOPE
  ) {
    throw new GmailCredentialStoreError(
      "invalid_credentials",
      "Stored Gmail credentials are invalid.",
    );
  }
  return {
    version: CREDENTIAL_SCHEMA_VERSION,
    refreshToken: candidate.refreshToken,
    grantedScopes: [GMAIL_READONLY_SCOPE],
    connectedAt: new Date(candidate.connectedAt).toISOString(),
  };
}

export function gmailCredentialPath(
  localAppData = process.env.LOCALAPPDATA,
): string {
  const root = localAppData?.trim();
  if (!root || !path.isAbsolute(root)) {
    throw new GmailCredentialStoreError(
      "storage_unavailable",
      "Live Gmail credentials require a local Windows application-data directory.",
    );
  }
  return path.join(root, GMAIL_CREDENTIAL_RELATIVE_PATH);
}

export class FileGmailCredentialStore implements GmailCredentialStore {
  constructor(
    private readonly protector: GmailSecretProtector,
    private readonly filePath = gmailCredentialPath(),
  ) {}

  async load(): Promise<GmailCredential | null> {
    try {
      const metadata = await lstat(this.filePath);
      if (metadata.isSymbolicLink() || !metadata.isFile()) {
        throw new GmailCredentialStoreError(
          "io_error",
          "The Gmail credential path is not a regular file.",
        );
      }
      if (metadata.size === 0 || metadata.size > MAX_CREDENTIAL_BYTES) {
        throw new GmailCredentialStoreError(
          "invalid_credentials",
          "Stored Gmail credentials have an invalid size.",
        );
      }
      const plaintext = await this.protector.unprotect(
        await readFile(this.filePath),
      );
      return validateCredential(JSON.parse(plaintext.toString("utf8")));
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }
      if (error instanceof GmailCredentialStoreError) throw error;
      throw new GmailCredentialStoreError(
        "invalid_credentials",
        "Stored Gmail credentials could not be read.",
        { cause: error },
      );
    }
  }

  async save(credential: GmailCredential): Promise<void> {
    const plaintext = Buffer.from(
      JSON.stringify(validateCredential(credential)),
      "utf8",
    );
    const ciphertext = await this.protector.protect(plaintext);
    if (
      ciphertext.byteLength === 0 ||
      ciphertext.byteLength > MAX_CREDENTIAL_BYTES
    ) {
      throw new GmailCredentialStoreError(
        "io_error",
        "Encrypted Gmail credentials have an invalid size.",
      );
    }
    const directory = path.dirname(this.filePath);
    const temporaryPath = `${this.filePath}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await writeFile(temporaryPath, ciphertext, { flag: "wx", mode: 0o600 });
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw new GmailCredentialStoreError(
        "io_error",
        "Gmail credentials could not be stored securely.",
        { cause: error },
      );
    }
  }

  async delete(): Promise<void> {
    try {
      await rm(this.filePath, { force: true });
      const directory = path.dirname(this.filePath);
      const temporaryPrefix = `${path.basename(this.filePath)}.tmp-`;
      const entries = await readdir(directory, { withFileTypes: true }).catch(
        (error: unknown) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT"
          )
            return [];
          throw error;
        },
      );
      await Promise.all(
        entries
          .filter((entry) => entry.name.startsWith(temporaryPrefix))
          .map((entry) =>
            rm(path.join(directory, entry.name), { force: true }),
          ),
      );
    } catch (error) {
      throw new GmailCredentialStoreError(
        "io_error",
        "Gmail credentials could not be deleted.",
        { cause: error },
      );
    }
  }
}

export class MemoryGmailCredentialStore implements GmailCredentialStore {
  private credential: GmailCredential | null = null;

  async load(): Promise<GmailCredential | null> {
    return this.credential
      ? {
          ...this.credential,
          grantedScopes: [...this.credential.grantedScopes],
        }
      : null;
  }

  async save(credential: GmailCredential): Promise<void> {
    const validated = validateCredential(credential);
    this.credential = {
      ...validated,
      grantedScopes: [...validated.grantedScopes],
    };
  }

  async delete(): Promise<void> {
    this.credential = null;
  }
}

export interface CreateGmailCredentialStoreOptions {
  mode: "fixture" | "live";
  platform?: NodeJS.Platform;
  localAppData?: string;
  runPowerShell?: GmailPowerShellStdinRunner;
}

export function createGmailCredentialStore(
  options: CreateGmailCredentialStoreOptions,
): GmailCredentialStore {
  if (options.mode === "fixture") return new MemoryGmailCredentialStore();
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") {
    throw new GmailCredentialStoreError(
      "storage_unavailable",
      "Live Gmail credentials require Windows DPAPI in this local-only slice.",
    );
  }
  return new FileGmailCredentialStore(
    new WindowsGmailDpapiCurrentUserProtector({
      platform,
      runPowerShell: options.runPowerShell,
    }),
    gmailCredentialPath(options.localAppData),
  );
}
