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
import { GOOGLE_CALENDAR_READONLY_SCOPE } from "./config";

const CREDENTIAL_SCHEMA_VERSION = 1;
const MAX_CREDENTIAL_BYTES = 128 * 1_024;
const POWERSHELL_TIMEOUT_MS = 5_000;
const DPAPI_ENTROPY_BASE64 = Buffer.from(
  "Orbit.GoogleCalendar.Credentials.v1",
  "utf8",
).toString("base64");

export const GOOGLE_CALENDAR_CREDENTIAL_RELATIVE_PATH = path.join(
  "Orbit",
  "google-calendar.credentials.dpapi",
);

export const DPAPI_PROTECT_SCRIPT = String.raw`
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

export const DPAPI_UNPROTECT_SCRIPT = String.raw`
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

export interface GoogleCalendarCredential {
  version: 1;
  refreshToken: string;
  grantedScopes: string[];
  connectedAt: string;
}

export interface GoogleCalendarCredentialStore {
  load(): Promise<GoogleCalendarCredential | null>;
  save(credential: GoogleCalendarCredential): Promise<void>;
  delete(): Promise<void>;
}

export interface SecretProtector {
  protect(plaintext: Uint8Array): Promise<Buffer>;
  unprotect(ciphertext: Uint8Array): Promise<Buffer>;
}

export class GoogleCalendarCredentialStoreError extends Error {
  constructor(
    public readonly code:
      "storage_unavailable" | "invalid_credentials" | "io_error",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GoogleCalendarCredentialStoreError";
  }
}

export type PowerShellStdinRunner = (
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
          new GoogleCalendarCredentialStoreError(
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
          new GoogleCalendarCredentialStoreError(
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
            new GoogleCalendarCredentialStoreError(
              "io_error",
              "The Windows credential protector failed.",
            ),
          );
          return;
        }
        resolve(stdout.trim());
      });
    });

    child.stdin.on("error", () => {
      // The close/error handler returns the sanitized failure.
    });
    child.stdin.end(stdin);
  });
}

export interface WindowsDpapiSecretProtectorOptions {
  platform?: NodeJS.Platform;
  runPowerShell?: PowerShellStdinRunner;
}

/** Protects bytes for the current Windows user via DPAPI. */
export class WindowsDpapiCurrentUserProtector implements SecretProtector {
  private readonly platform: NodeJS.Platform;
  private readonly run: PowerShellStdinRunner;

  constructor(options: WindowsDpapiSecretProtectorOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.run = options.runPowerShell ?? runPowerShellWithStdin;
  }

  async protect(plaintext: Uint8Array): Promise<Buffer> {
    this.assertWindows();
    return this.transform(DPAPI_PROTECT_SCRIPT, plaintext);
  }

  async unprotect(ciphertext: Uint8Array): Promise<Buffer> {
    this.assertWindows();
    return this.transform(DPAPI_UNPROTECT_SCRIPT, ciphertext);
  }

  private assertWindows(): void {
    if (this.platform !== "win32") {
      throw new GoogleCalendarCredentialStoreError(
        "storage_unavailable",
        "Live Google Calendar credentials require Windows DPAPI in this local-only slice.",
      );
    }
  }

  private async transform(script: string, input: Uint8Array): Promise<Buffer> {
    if (input.byteLength === 0 || input.byteLength > MAX_CREDENTIAL_BYTES) {
      throw new GoogleCalendarCredentialStoreError(
        "invalid_credentials",
        "Google Calendar credential data has an invalid size.",
      );
    }

    const output = await this.run(
      script,
      Buffer.from(input).toString("base64"),
    );
    try {
      const decoded = Buffer.from(output, "base64");
      if (
        decoded.byteLength === 0 ||
        decoded.byteLength > MAX_CREDENTIAL_BYTES
      ) {
        throw new Error("invalid output size");
      }
      return decoded;
    } catch (error) {
      throw new GoogleCalendarCredentialStoreError(
        "io_error",
        "The Windows credential protector returned invalid data.",
        { cause: error },
      );
    }
  }
}

function validateCredential(value: unknown): GoogleCalendarCredential {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GoogleCalendarCredentialStoreError(
      "invalid_credentials",
      "Stored Google Calendar credentials are invalid.",
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
  const connectedAt = candidate.connectedAt;
  const refreshToken = candidate.refreshToken;
  const grantedScopes = candidate.grantedScopes;

  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    candidate.version !== CREDENTIAL_SCHEMA_VERSION ||
    typeof refreshToken !== "string" ||
    refreshToken.length === 0 ||
    refreshToken.length > 16_384 ||
    typeof connectedAt !== "string" ||
    !Number.isFinite(Date.parse(connectedAt)) ||
    !Array.isArray(grantedScopes) ||
    grantedScopes.length !== 1 ||
    grantedScopes[0] !== GOOGLE_CALENDAR_READONLY_SCOPE
  ) {
    throw new GoogleCalendarCredentialStoreError(
      "invalid_credentials",
      "Stored Google Calendar credentials are invalid.",
    );
  }

  return {
    version: CREDENTIAL_SCHEMA_VERSION,
    refreshToken,
    grantedScopes: [GOOGLE_CALENDAR_READONLY_SCOPE],
    connectedAt: new Date(connectedAt).toISOString(),
  };
}

function serializeCredential(credential: GoogleCalendarCredential): Buffer {
  return Buffer.from(JSON.stringify(validateCredential(credential)), "utf8");
}

export function googleCalendarCredentialPath(
  localAppData = process.env.LOCALAPPDATA,
): string {
  const root = localAppData?.trim();
  if (!root || !path.isAbsolute(root)) {
    throw new GoogleCalendarCredentialStoreError(
      "storage_unavailable",
      "Live Google Calendar credentials require a local Windows application-data directory.",
    );
  }
  return path.join(root, GOOGLE_CALENDAR_CREDENTIAL_RELATIVE_PATH);
}

export class FileGoogleCalendarCredentialStore implements GoogleCalendarCredentialStore {
  constructor(
    private readonly protector: SecretProtector,
    private readonly filePath = googleCalendarCredentialPath(),
  ) {}

  async load(): Promise<GoogleCalendarCredential | null> {
    try {
      const metadata = await lstat(this.filePath);
      if (metadata.isSymbolicLink() || !metadata.isFile()) {
        throw new GoogleCalendarCredentialStoreError(
          "io_error",
          "The Google Calendar credential path is not a regular file.",
        );
      }
      if (metadata.size === 0 || metadata.size > MAX_CREDENTIAL_BYTES) {
        throw new GoogleCalendarCredentialStoreError(
          "invalid_credentials",
          "Stored Google Calendar credentials have an invalid size.",
        );
      }

      const ciphertext = await readFile(this.filePath);
      const plaintext = await this.protector.unprotect(ciphertext);
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
      if (error instanceof GoogleCalendarCredentialStoreError) throw error;
      throw new GoogleCalendarCredentialStoreError(
        "invalid_credentials",
        "Stored Google Calendar credentials could not be read.",
        { cause: error },
      );
    }
  }

  async save(credential: GoogleCalendarCredential): Promise<void> {
    const plaintext = serializeCredential(credential);
    const ciphertext = await this.protector.protect(plaintext);
    if (
      ciphertext.byteLength === 0 ||
      ciphertext.byteLength > MAX_CREDENTIAL_BYTES
    ) {
      throw new GoogleCalendarCredentialStoreError(
        "io_error",
        "Encrypted Google Calendar credentials have an invalid size.",
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
      throw new GoogleCalendarCredentialStoreError(
        "io_error",
        "Google Calendar credentials could not be stored securely.",
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
          ) {
            return [];
          }
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
      throw new GoogleCalendarCredentialStoreError(
        "io_error",
        "Google Calendar credentials could not be deleted.",
        { cause: error },
      );
    }
  }
}

export class MemoryGoogleCalendarCredentialStore implements GoogleCalendarCredentialStore {
  private credential: GoogleCalendarCredential | null = null;

  async load(): Promise<GoogleCalendarCredential | null> {
    return this.credential
      ? {
          ...this.credential,
          grantedScopes: [...this.credential.grantedScopes],
        }
      : null;
  }

  async save(credential: GoogleCalendarCredential): Promise<void> {
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

export interface CreateGoogleCalendarCredentialStoreOptions {
  mode: "fixture" | "live";
  platform?: NodeJS.Platform;
  localAppData?: string;
  runPowerShell?: PowerShellStdinRunner;
}

export function createGoogleCalendarCredentialStore(
  options: CreateGoogleCalendarCredentialStoreOptions,
): GoogleCalendarCredentialStore {
  if (options.mode === "fixture") {
    return new MemoryGoogleCalendarCredentialStore();
  }

  const platform = options.platform ?? process.platform;
  if (platform !== "win32") {
    throw new GoogleCalendarCredentialStoreError(
      "storage_unavailable",
      "Live Google Calendar credentials require Windows DPAPI in this local-only slice.",
    );
  }

  return new FileGoogleCalendarCredentialStore(
    new WindowsDpapiCurrentUserProtector({
      platform,
      runPowerShell: options.runPowerShell,
    }),
    googleCalendarCredentialPath(options.localAppData),
  );
}
