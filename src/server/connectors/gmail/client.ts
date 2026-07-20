import { createHash } from "node:crypto";

import type {
  EmailMessageSummary,
  SourceRecord,
} from "@/domain/orbit/connectors";

import { GMAIL_CONNECTOR_ID } from "./config";
import type {
  GmailConnectorFailure,
  GmailSyncBatch,
  GmailSyncOutcome,
} from "./types";

export const GMAIL_MESSAGES_ENDPOINT =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages";
export const GMAIL_REQUEST_TIMEOUT_MS = 10_000;
export const GMAIL_MAX_MESSAGES = 25;
export const GMAIL_MAX_RESPONSE_BYTES = 128 * 1_024;
export const GMAIL_CACHE_MS = 5 * 60 * 1_000;
export const GMAIL_LOOKBACK_DAYS = 7;

const MAX_ID_LENGTH = 1_024;
const MAX_SUBJECT_LENGTH = 512;
const MAX_SNIPPET_LENGTH = 1_024;
const MAX_RETRY_AFTER_SECONDS = 60 * 60;
const MESSAGE_FIELDS =
  "id,threadId,labelIds,snippet,internalDate,payload(headers(name,value))";

type JsonRecord = Record<string, unknown>;

class ResponseLimitError extends Error {}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string" || value.length > maxLength) return null;
  return Array.from(value, (character) => {
    const point = character.codePointAt(0) ?? 0;
    const unsafe =
      point <= 0x1f ||
      (point >= 0x7f && point <= 0x9f) ||
      point === 0x061c ||
      (point >= 0x200b && point <= 0x200f) ||
      (point >= 0x202a && point <= 0x202e) ||
      (point >= 0x2066 && point <= 0x2069) ||
      point === 0xfeff;
    return unsafe ? " " : character;
  })
    .join("")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

async function readBoundedText(response: Response): Promise<string> {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const length = Number(lengthHeader);
    if (
      !Number.isFinite(length) ||
      length < 0 ||
      length > GMAIL_MAX_RESPONSE_BYTES
    ) {
      throw new ResponseLimitError();
    }
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > GMAIL_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ResponseLimitError();
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function parseRetryAfter(value: string | null, now: Date): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  const parsed = Number.isFinite(seconds)
    ? Math.ceil(seconds)
    : Math.ceil((Date.parse(value) - now.getTime()) / 1_000);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.min(parsed, MAX_RETRY_AFTER_SECONDS);
}

function failureFromResponse(
  response: Response,
  now: Date,
): GmailConnectorFailure {
  if (response.status === 401) {
    return {
      code: "authentication_required",
      message: "Gmail authorization has expired or was revoked.",
      retryable: false,
    };
  }
  if (response.status === 429) {
    const retryAfterSeconds = parseRetryAfter(
      response.headers.get("retry-after"),
      now,
    );
    return {
      code: "rate_limited",
      message: "Gmail temporarily limited synchronization.",
      retryable: true,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    };
  }
  if (response.status === 403) {
    return {
      code: "insufficient_scope",
      message: "Gmail did not grant the required read-only access.",
      retryable: false,
    };
  }
  return {
    code: "provider_unavailable",
    message: "Gmail is temporarily unavailable.",
    retryable: response.status >= 500,
  };
}

function invalidResponse(message: string): GmailSyncOutcome {
  return {
    ok: false,
    failure: { code: "invalid_response", message, retryable: false },
  };
}

function parseList(value: unknown): { ids: string[]; capped: boolean } | null {
  if (!isRecord(value)) return null;
  const messages = value.messages ?? [];
  if (!Array.isArray(messages) || messages.length > GMAIL_MAX_MESSAGES) {
    return null;
  }
  const ids: string[] = [];
  for (const message of messages) {
    if (!isRecord(message) || typeof message.id !== "string") return null;
    const id = message.id.trim();
    if (!id || id.length > MAX_ID_LENGTH || ids.includes(id)) return null;
    ids.push(id);
  }
  return { ids, capped: value.nextPageToken !== undefined };
}

function subjectFromPayload(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.headers)) return null;
  if (payload.headers.length > 1) return null;
  if (payload.headers.length === 0) return "";
  const header = payload.headers[0];
  if (
    !isRecord(header) ||
    typeof header.name !== "string" ||
    header.name.toLowerCase() !== "subject"
  ) {
    return null;
  }
  return sanitizeText(header.value, MAX_SUBJECT_LENGTH);
}

function parseMessage(
  value: unknown,
): { providerId: string; message: EmailMessageSummary } | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const providerId = value.id.trim();
  if (!providerId || providerId.length > MAX_ID_LENGTH) return null;
  if (!Array.isArray(value.labelIds)) return null;
  const labels = value.labelIds;
  if (
    labels.some((label) => typeof label !== "string") ||
    !labels.includes("INBOX") ||
    !labels.includes("UNREAD")
  ) {
    return null;
  }
  if (
    typeof value.internalDate !== "string" ||
    !/^\d{1,16}$/u.test(value.internalDate)
  ) {
    return null;
  }
  const receivedAtMs = Number(value.internalDate);
  if (!Number.isSafeInteger(receivedAtMs) || receivedAtMs <= 0) return null;
  const subject = subjectFromPayload(value.payload);
  const snippet = sanitizeText(value.snippet, MAX_SNIPPET_LENGTH);
  if (subject === null || snippet === null) return null;

  return {
    providerId,
    message: {
      subject: subject || "No subject",
      senderLabel: "Gmail",
      receivedAt: new Date(receivedAtMs).toISOString(),
      snippet,
      unread: true,
      inbox: true,
      important: labels.includes("IMPORTANT"),
    },
  };
}

function opaqueReference(providerId: string): string {
  return createHash("sha256")
    .update(`orbit:email.google:message:${providerId}`, "utf8")
    .digest("hex");
}

function sourceRecord(
  providerId: string,
  message: EmailMessageSummary,
  retrievedAt: Date,
): SourceRecord<EmailMessageSummary> {
  const reference = opaqueReference(providerId);
  return {
    id: `email.google.${reference.slice(0, 24)}`,
    connectorId: GMAIL_CONNECTOR_ID,
    schemaVersion: "1",
    externalReference: `sha256:${reference}`,
    provenance: { sourceLabel: "Gmail (read only)" },
    observedAt: message.receivedAt,
    retrievedAt: retrievedAt.toISOString(),
    staleAfter: new Date(retrievedAt.getTime() + GMAIL_CACHE_MS).toISOString(),
    payload: message,
  };
}

function listUrl(): URL {
  const url = new URL(GMAIL_MESSAGES_ENDPOINT);
  url.searchParams.set("labelIds", "INBOX");
  url.searchParams.append("labelIds", "UNREAD");
  url.searchParams.set("includeSpamTrash", "false");
  url.searchParams.set("maxResults", String(GMAIL_MAX_MESSAGES));
  url.searchParams.set("q", `newer_than:${GMAIL_LOOKBACK_DAYS}d`);
  url.searchParams.set("fields", "messages(id),nextPageToken");
  return url;
}

function detailUrl(id: string): URL {
  const url = new URL(`${GMAIL_MESSAGES_ENDPOINT}/${encodeURIComponent(id)}`);
  url.searchParams.set("format", "metadata");
  url.searchParams.set("metadataHeaders", "Subject");
  url.searchParams.set("fields", MESSAGE_FIELDS);
  return url;
}

async function requestJson(
  url: URL,
  accessToken: string,
  signal: AbortSignal,
  fetchImpl: typeof globalThis.fetch,
  now: Date,
): Promise<
  { ok: true; value: unknown } | { ok: false; failure: GmailConnectorFailure }
> {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    redirect: "error",
    signal,
  });
  const body = await readBoundedText(response);
  if (!response.ok)
    return { ok: false, failure: failureFromResponse(response, now) };
  if (
    !(response.headers.get("content-type") ?? "").includes("application/json")
  ) {
    return {
      ok: false,
      failure: {
        code: "invalid_response",
        message: "Gmail returned a non-JSON response.",
        retryable: false,
      },
    };
  }
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return {
      ok: false,
      failure: {
        code: "invalid_response",
        message: "Gmail returned malformed JSON.",
        retryable: false,
      },
    };
  }
}

export async function syncGmail(
  request: { now: Date; accessToken: string },
  options: { fetchImpl?: typeof globalThis.fetch; timeoutMs?: number } = {},
): Promise<GmailSyncOutcome> {
  if (!Number.isFinite(request.now.getTime())) {
    return invalidResponse("Gmail synchronization requires a valid clock.");
  }
  const accessToken = request.accessToken.trim();
  if (!accessToken || accessToken.length > 16_384) {
    return {
      ok: false,
      failure: {
        code: "authentication_required",
        message: "Gmail authorization is required.",
        retryable: false,
      },
    };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const signal = AbortSignal.timeout(
    options.timeoutMs ?? GMAIL_REQUEST_TIMEOUT_MS,
  );
  try {
    const listed = await requestJson(
      listUrl(),
      accessToken,
      signal,
      fetchImpl,
      request.now,
    );
    if (!listed.ok) return listed;
    const parsedList = parseList(listed.value);
    if (!parsedList)
      return invalidResponse("Gmail returned invalid message identifiers.");

    const records: Array<SourceRecord<EmailMessageSummary>> = [];
    for (const id of parsedList.ids) {
      const detail = await requestJson(
        detailUrl(id),
        accessToken,
        signal,
        fetchImpl,
        request.now,
      );
      if (!detail.ok) return detail;
      const parsed = parseMessage(detail.value);
      if (!parsed)
        return invalidResponse("Gmail returned invalid message metadata.");
      records.push(
        sourceRecord(parsed.providerId, parsed.message, request.now),
      );
    }

    const batch: GmailSyncBatch = {
      connectorId: GMAIL_CONNECTOR_ID,
      records,
      retrievedAt: request.now.toISOString(),
      staleAfter: new Date(
        request.now.getTime() + GMAIL_CACHE_MS,
      ).toISOString(),
      window: {
        startsAt: new Date(
          request.now.getTime() - GMAIL_LOOKBACK_DAYS * 86_400_000,
        ).toISOString(),
        endsAt: request.now.toISOString(),
      },
      completeness: parsedList.capped ? "message_cap" : "complete",
    };
    return { ok: true, batch };
  } catch (error) {
    if (error instanceof ResponseLimitError) {
      return invalidResponse("Gmail returned an oversized response.");
    }
    const name =
      isRecord(error) && typeof error.name === "string" ? error.name : "";
    return {
      ok: false,
      failure: {
        code:
          name === "AbortError" || name === "TimeoutError"
            ? "timeout"
            : "provider_unavailable",
        message:
          name === "AbortError" || name === "TimeoutError"
            ? "Gmail synchronization timed out."
            : "Gmail could not be reached.",
        retryable: true,
      },
    };
  }
}
