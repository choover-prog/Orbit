import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const envPath = path.join(repositoryRoot, ".env.local");
const origin = "http://127.0.0.1:3000";
const snapshotUrl = `${origin}/api/orbit/snapshot?context=calendar`;
const credentialRelativePath = path.join(
  "Orbit",
  "google-calendar.credentials.dpapi",
);
const maximumCredentialBytes = 128 * 1024;

let failed = false;

function pass(message) {
  process.stdout.write(`[PASS] ${message}\n`);
}

function fail(message) {
  failed = true;
  process.stderr.write(`[FAIL] ${message}\n`);
}

function parseEnvFile(contents) {
  const values = new Map();
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

function isIgnoredLocalEnvironment() {
  try {
    execFileSync("git", ["check-ignore", "--quiet", ".env.local"], {
      cwd: repositoryRoot,
      stdio: "ignore",
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

function readConfiguration() {
  if (!existsSync(envPath)) {
    fail("This local Orbit build has not been publisher-provisioned.");
    return null;
  }
  if (!isIgnoredLocalEnvironment()) {
    fail(".env.local is not ignored by Git.");
  } else {
    pass(".env.local is protected by Git ignore rules.");
  }

  const values = parseEnvFile(readFileSync(envPath, "utf8"));
  const mode = values.get("ORBIT_GOOGLE_CALENDAR_MODE");
  const clientId = values.get("ORBIT_GOOGLE_CALENDAR_CLIENT_ID") ?? "";
  const clientSecret = values.get("ORBIT_GOOGLE_CALENDAR_CLIENT_SECRET") ?? "";
  const redirectUri = values.get("ORBIT_GOOGLE_CALENDAR_REDIRECT_URI");

  if (mode !== "live") {
    fail("ORBIT_GOOGLE_CALENDAR_MODE must be live.");
  } else {
    pass("Calendar connector is configured for live mode.");
  }
  if (!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/u.test(clientId)) {
    fail("The publisher-provisioned Google sign-in identity is unavailable.");
  } else {
    pass(
      "Orbit's publisher Google sign-in identity is configured (value hidden).",
    );
  }
  if (!clientSecret || clientSecret.length > 2_048) {
    fail("The publisher-provisioned Google token identity is unavailable.");
  } else {
    pass("Orbit's publisher token identity is configured (value hidden).");
  }
  if (redirectUri !== origin) {
    fail(`The Calendar redirect URI must be exactly ${origin}.`);
  } else {
    pass("The Desktop loopback redirect URI is exact.");
  }
  if (process.platform !== "win32") {
    fail("Live qualification requires Windows DPAPI.");
  } else {
    pass("Windows DPAPI is available for this local qualification.");
  }

  return { clientIdConfigured: clientId.length > 0 };
}

function credentialPath() {
  const root = process.env.LOCALAPPDATA?.trim();
  if (!root || !path.isAbsolute(root)) {
    fail("LOCALAPPDATA is unavailable or not absolute.");
    return null;
  }
  return path.join(root, credentialRelativePath);
}

function inspectVault(expected) {
  const filePath = credentialPath();
  if (!filePath) return;
  const present = existsSync(filePath);

  if (expected === "present" && !present) {
    fail("The encrypted Calendar credential vault was not created.");
    return;
  }
  if (expected === "absent" && present) {
    fail("The encrypted Calendar credential vault still exists.");
    return;
  }
  if (!present) {
    pass("The encrypted Calendar credential vault is absent.");
    return;
  }

  const metadata = lstatSync(filePath);
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    metadata.size <= 0 ||
    metadata.size > maximumCredentialBytes
  ) {
    fail("The Calendar credential vault is not a bounded regular file.");
    return;
  }
  pass("A bounded DPAPI ciphertext vault exists (contents not read).");
}

async function readSafeCalendarSummary() {
  let response;
  try {
    response = await fetch(snapshotUrl, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    fail(`Orbit is not reachable at ${origin}.`);
    return null;
  }
  if (!response.ok) {
    fail(`Orbit returned HTTP ${response.status} for the local snapshot.`);
    return null;
  }

  let snapshot;
  try {
    snapshot = await response.json();
  } catch {
    fail("Orbit returned an invalid local snapshot.");
    return null;
  }
  const calendar = snapshot?.calendar;
  if (!calendar || typeof calendar !== "object") {
    fail("The local snapshot has no Calendar health summary.");
    return null;
  }

  return {
    mode: calendar.mode,
    status: calendar.status,
    authorization: calendar.authorization,
    complete: calendar.complete,
    eventCount: calendar.eventCount,
    attentionPresent: Boolean(calendar.attention),
    lastSyncedAt: calendar.lastSyncedAt,
  };
}

function validateConnectedSummary(summary) {
  if (summary.mode !== "live")
    fail("The running connector is not in live mode.");
  else pass("The running connector reports live mode.");
  if (summary.authorization !== "connected") {
    fail("Calendar authorization is not connected.");
  } else pass("Calendar authorization is connected.");
  if (summary.status !== "fresh" || summary.complete !== true) {
    fail("The bounded Calendar read is not fresh and complete.");
  } else pass("The bounded Calendar read is fresh and complete.");
  if (!Number.isInteger(summary.eventCount) || summary.eventCount < 0) {
    fail("Calendar did not return a valid normalized event count.");
  } else pass(`Calendar normalized ${summary.eventCount} event records.`);
  if (
    typeof summary.lastSyncedAt !== "string" ||
    !Number.isFinite(Date.parse(summary.lastSyncedAt))
  ) {
    fail("Calendar freshness provenance is missing.");
  } else pass("Calendar freshness provenance is present.");
  if (!summary.attentionPresent) {
    fail(
      "No deterministic Calendar attention item is present. Create two temporary overlapping owned events, choose Refresh now, and retry; event details are never printed.",
    );
  } else pass("A deterministic read-only Calendar attention item is present.");
}

function validateDisconnectedSummary(summary) {
  if (summary.mode !== "live")
    fail("The running connector is not in live mode.");
  else pass("The running connector still reports live mode.");
  if (
    summary.authorization !== "disconnected" ||
    summary.status !== "disconnected"
  ) {
    fail("Calendar is not fully disconnected.");
  } else pass("Calendar reports a fully disconnected state.");
  if (summary.eventCount !== 0 || summary.attentionPresent) {
    fail("Calendar records or attention remain after disconnect.");
  } else pass("Calendar records and attention were cleared from memory.");
}

async function main() {
  const phase = process.argv[2] ?? "preflight";
  if (!new Set(["preflight", "connected", "disconnected"]).has(phase)) {
    fail("Use: preflight, connected, or disconnected.");
  } else {
    readConfiguration();
    if (phase === "preflight") {
      inspectVault("absent");
    } else {
      const summary = await readSafeCalendarSummary();
      if (summary && phase === "connected") {
        validateConnectedSummary(summary);
        inspectVault("present");
      }
      if (summary && phase === "disconnected") {
        validateDisconnectedSummary(summary);
        inspectVault("absent");
      }
    }
  }

  if (failed) process.exitCode = 1;
  else process.stdout.write("Calendar qualification phase passed.\n");
}

await main();
