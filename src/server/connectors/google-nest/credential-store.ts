import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { GOOGLE_NEST_SCOPE } from "./config";

const MAX_BYTES = 128 * 1024;
const ENTROPY = Buffer.from("Orbit.GoogleNest.Credentials.v1", "utf8").toString(
  "base64",
);
export const GOOGLE_NEST_CREDENTIAL_RELATIVE_PATH = path.join(
  "Orbit",
  "google-nest.credentials.dpapi",
);

export interface GoogleNestCredential {
  version: 1;
  refreshToken: string;
  grantedScopes: [typeof GOOGLE_NEST_SCOPE];
  connectedAt: string;
}

export interface GoogleNestCredentialStore {
  load(): Promise<GoogleNestCredential | null>;
  save(value: GoogleNestCredential): Promise<void>;
  delete(): Promise<void>;
}

export class GoogleNestCredentialStoreError extends Error {
  constructor(
    public readonly code:
      "storage_unavailable" | "invalid_credentials" | "io_error",
    message: string,
  ) {
    super(message);
    this.name = "GoogleNestCredentialStoreError";
  }
}

function validate(value: unknown): GoogleNestCredential {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new GoogleNestCredentialStoreError(
      "invalid_credentials",
      "Stored Google Nest credentials are invalid.",
    );
  const item = value as Record<string, unknown>;
  if (
    item.version !== 1 ||
    typeof item.refreshToken !== "string" ||
    !item.refreshToken ||
    item.refreshToken.length > 16_384 ||
    typeof item.connectedAt !== "string" ||
    !Number.isFinite(Date.parse(item.connectedAt)) ||
    !Array.isArray(item.grantedScopes) ||
    item.grantedScopes.length !== 1 ||
    item.grantedScopes[0] !== GOOGLE_NEST_SCOPE
  )
    throw new GoogleNestCredentialStoreError(
      "invalid_credentials",
      "Stored Google Nest credentials are invalid.",
    );
  return {
    version: 1,
    refreshToken: item.refreshToken,
    grantedScopes: [GOOGLE_NEST_SCOPE],
    connectedAt: new Date(item.connectedAt).toISOString(),
  };
}

const protectScript = (protect: boolean) => String.raw`
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$inputBytes=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
$entropy=[Convert]::FromBase64String('${ENTROPY}')
$output=[System.Security.Cryptography.ProtectedData]::${protect ? "Protect" : "Unprotect"}($inputBytes,$entropy,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[Console]::Out.Write([Convert]::ToBase64String($output))`;

function dpapi(input: Buffer, protect: boolean): Promise<Buffer> {
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
        protectScript(protect),
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] },
    );
    let output = "";
    const timeout = setTimeout(() => child.kill(), 5000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (output.length > MAX_BYTES * 2) child.kill();
    });
    child.on("error", () =>
      reject(
        new GoogleNestCredentialStoreError(
          "io_error",
          "The Windows credential protector could not start.",
        ),
      ),
    );
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 || !output)
        reject(
          new GoogleNestCredentialStoreError(
            "io_error",
            "The Windows credential protector failed.",
          ),
        );
      else resolve(Buffer.from(output.trim(), "base64"));
    });
    child.stdin.end(input.toString("base64"));
  });
}

export function googleNestCredentialPath(
  localAppData = process.env.LOCALAPPDATA,
): string {
  if (!localAppData?.trim() || !path.win32.isAbsolute(localAppData))
    throw new GoogleNestCredentialStoreError(
      "storage_unavailable",
      "Live Google Nest credentials require a local Windows application-data directory.",
    );
  return path.join(localAppData, GOOGLE_NEST_CREDENTIAL_RELATIVE_PATH);
}

export class FileGoogleNestCredentialStore implements GoogleNestCredentialStore {
  constructor(private readonly filePath: string) {}
  async load(): Promise<GoogleNestCredential | null> {
    try {
      const info = await lstat(this.filePath);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size < 1 ||
        info.size > MAX_BYTES
      )
        throw new GoogleNestCredentialStoreError(
          "invalid_credentials",
          "Stored Google Nest credentials are invalid.",
        );
      return validate(
        JSON.parse(
          (await dpapi(await readFile(this.filePath), false)).toString("utf8"),
        ),
      );
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
        return null;
      if (error instanceof GoogleNestCredentialStoreError) throw error;
      throw new GoogleNestCredentialStoreError(
        "invalid_credentials",
        "Stored Google Nest credentials could not be read.",
      );
    }
  }
  async save(value: GoogleNestCredential): Promise<void> {
    const encoded = await dpapi(
      Buffer.from(JSON.stringify(validate(value)), "utf8"),
      true,
    );
    if (encoded.length < 1 || encoded.length > MAX_BYTES)
      throw new GoogleNestCredentialStoreError(
        "io_error",
        "Encrypted Google Nest credentials have an invalid size.",
      );
    const directory = path.dirname(this.filePath);
    const temporary = `${this.filePath}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await writeFile(temporary, encoded, { flag: "wx", mode: 0o600 });
      await rename(temporary, this.filePath);
    } catch {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw new GoogleNestCredentialStoreError(
        "io_error",
        "Google Nest credentials could not be stored securely.",
      );
    }
  }
  async delete(): Promise<void> {
    await rm(this.filePath, { force: true }).catch(() => {
      throw new GoogleNestCredentialStoreError(
        "io_error",
        "Google Nest credentials could not be deleted.",
      );
    });
  }
}

export class MemoryGoogleNestCredentialStore implements GoogleNestCredentialStore {
  private value: GoogleNestCredential | null = null;
  async load() {
    return this.value
      ? {
          ...this.value,
          grantedScopes: [GOOGLE_NEST_SCOPE] as [typeof GOOGLE_NEST_SCOPE],
        }
      : null;
  }
  async save(value: GoogleNestCredential) {
    this.value = validate(value);
  }
  async delete() {
    this.value = null;
  }
}

export function createGoogleNestCredentialStore(options: {
  mode: "fixture" | "live";
  platform?: NodeJS.Platform;
  localAppData?: string;
}): GoogleNestCredentialStore {
  if (options.mode === "fixture") return new MemoryGoogleNestCredentialStore();
  if ((options.platform ?? process.platform) !== "win32")
    throw new GoogleNestCredentialStoreError(
      "storage_unavailable",
      "Live Google Nest credentials require Windows DPAPI in this local-only slice.",
    );
  return new FileGoogleNestCredentialStore(
    googleNestCredentialPath(options.localAppData),
  );
}
