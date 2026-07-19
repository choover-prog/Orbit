import { createHash } from "node:crypto";

import type {
  CalendarEvent,
  CalendarSelfResponseStatus,
  SourceRecord,
} from "@/domain/orbit/connectors";

import { GOOGLE_CALENDAR_CONNECTOR_ID } from "./config";

import type {
  CalendarConnectorFailure,
  CalendarSyncBatch,
  CalendarSyncOutcome,
} from "./types";

export const GOOGLE_CALENDAR_EVENTS_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
export const GOOGLE_CALENDAR_REQUEST_TIMEOUT_MS = 5_000;
export const GOOGLE_CALENDAR_PAGE_SIZE = 50;
export const GOOGLE_CALENDAR_MAX_PAGES = 4;
export const GOOGLE_CALENDAR_MAX_EVENTS = 200;
export const GOOGLE_CALENDAR_MAX_RESPONSE_BYTES = 256 * 1_024;
export const GOOGLE_CALENDAR_CACHE_MS = 5 * 60 * 1_000;

const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_RETRY_AFTER_SECONDS = 60 * 60;
const MAX_TITLE_LENGTH = 1_024;
const MAX_PAGE_TOKEN_LENGTH = 4_096;
const CALENDAR_FIELDS =
  "nextPageToken,items(id,status,summary,start(date,dateTime),end(date,dateTime),transparency,updated,attendees(self,responseStatus))";

type JsonRecord = Record<string, unknown>;

export interface GoogleCalendarSyncRequest {
  now: Date;
  accessToken: string;
}

export interface GoogleCalendarSyncOptions {
  fetchImpl?: typeof globalThis.fetch;
  timeoutMs?: number;
}

interface ParsedPage {
  events: Array<{ providerId: string; event: CalendarEvent }>;
  nextPageToken?: string;
}

class ResponseLimitError extends Error {}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRfc3339(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      value,
    ) &&
    Number.isFinite(Date.parse(value))
  );
}

function normalizeDateTime(value: unknown): string | null {
  return isRfc3339(value) ? new Date(value).toISOString() : null;
}

function normalizeAllDayDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return null;
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return null;
  const normalized = new Date(timestamp).toISOString();
  return normalized.startsWith(value) ? normalized : null;
}

function parseBoundary(value: unknown): { at: string; allDay: boolean } | null {
  if (!isRecord(value)) return null;

  const dateTime = normalizeDateTime(value.dateTime);
  const date = normalizeAllDayDate(value.date);
  if ((dateTime === null) === (date === null)) return null;

  return dateTime
    ? { at: dateTime, allDay: false }
    : { at: date as string, allDay: true };
}

function normalizeSelfResponseStatus(
  attendees: unknown,
): CalendarSelfResponseStatus {
  if (!Array.isArray(attendees)) return "unknown";

  const self = attendees.find(
    (attendee) => isRecord(attendee) && attendee.self === true,
  );
  if (!isRecord(self)) return "unknown";

  switch (self.responseStatus) {
    case "accepted":
    case "tentative":
    case "declined":
    case "needsAction":
      return self.responseStatus;
    default:
      return "unknown";
  }
}

function isUnsafeTitleCodePoint(codePoint: number): boolean {
  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x061c ||
    (codePoint >= 0x200b && codePoint <= 0x200f) ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069) ||
    codePoint === 0xfeff
  );
}

function normalizeTitle(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_TITLE_LENGTH) {
    return null;
  }

  return Array.from(value, (character) =>
    isUnsafeTitleCodePoint(character.codePointAt(0) ?? 0) ? " " : character,
  )
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
}

function parseEvent(
  value: unknown,
): { providerId: string; event: CalendarEvent } | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const providerId = value.id.trim();
  if (providerId.length === 0 || providerId.length > 1_024) return null;

  if (
    value.status !== "confirmed" &&
    value.status !== "tentative" &&
    value.status !== "cancelled"
  ) {
    return null;
  }

  const start = parseBoundary(value.start);
  const end = parseBoundary(value.end);
  const updatedAt = normalizeDateTime(value.updated);
  if (
    !start ||
    !end ||
    start.allDay !== end.allDay ||
    updatedAt === null ||
    Date.parse(end.at) <= Date.parse(start.at)
  ) {
    return null;
  }

  if (
    value.transparency !== undefined &&
    value.transparency !== "opaque" &&
    value.transparency !== "transparent"
  ) {
    return null;
  }

  const title = normalizeTitle(value.summary ?? "");
  if (title === null) return null;

  return {
    providerId,
    event: {
      title: title || "Busy event",
      startAt: start.at,
      endAt: end.at,
      allDay: start.allDay,
      status: value.status,
      transparency: value.transparency ?? "opaque",
      selfResponseStatus: normalizeSelfResponseStatus(value.attendees),
      updatedAt,
    },
  };
}

function parsePage(value: unknown): ParsedPage | null {
  if (!isRecord(value)) return null;
  const items = value.items ?? [];
  if (!Array.isArray(items) || items.length > GOOGLE_CALENDAR_PAGE_SIZE) {
    return null;
  }

  const events: ParsedPage["events"] = [];
  for (const item of items) {
    const parsed = parseEvent(item);
    if (!parsed) return null;
    events.push(parsed);
  }

  if (value.nextPageToken === undefined) return { events };
  if (
    typeof value.nextPageToken !== "string" ||
    value.nextPageToken.length === 0 ||
    value.nextPageToken.length > MAX_PAGE_TOKEN_LENGTH
  ) {
    return null;
  }

  return { events, nextPageToken: value.nextPageToken };
}

async function readBoundedText(response: Response): Promise<string> {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const contentLength = Number(lengthHeader);
    if (
      !Number.isFinite(contentLength) ||
      contentLength < 0 ||
      contentLength > GOOGLE_CALENDAR_MAX_RESPONSE_BYTES
    ) {
      throw new ResponseLimitError("Calendar response exceeded the byte cap.");
    }
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > GOOGLE_CALENDAR_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ResponseLimitError("Calendar response exceeded the byte cap.");
    }
    body += decoder.decode(value, { stream: true });
  }

  return body + decoder.decode();
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

function isRateLimit403(body: string): boolean {
  try {
    const value: unknown = JSON.parse(body);
    if (!isRecord(value) || !isRecord(value.error)) return false;
    if (value.error.status === "RESOURCE_EXHAUSTED") return true;
    if (!Array.isArray(value.error.errors)) return false;
    return value.error.errors.some(
      (item) =>
        isRecord(item) &&
        (item.reason === "rateLimitExceeded" ||
          item.reason === "userRateLimitExceeded" ||
          item.reason === "quotaExceeded"),
    );
  } catch {
    return false;
  }
}

function httpFailure(
  status: number,
  responseBody: string,
  retryAfterSeconds: number | undefined,
): CalendarConnectorFailure {
  if (status === 401) {
    return {
      code: "authentication_required",
      message: "Google Calendar authorization has expired or was revoked.",
      retryable: false,
    };
  }

  if (status === 429 || (status === 403 && isRateLimit403(responseBody))) {
    return {
      code: "rate_limited",
      message: "Google Calendar temporarily limited synchronization.",
      retryable: true,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    };
  }

  if (status === 403) {
    return {
      code: "insufficient_scope",
      message: "Google Calendar did not grant the required read-only access.",
      retryable: false,
    };
  }

  if (status >= 500 && status <= 599) {
    return {
      code: "provider_unavailable",
      message: "Google Calendar is temporarily unavailable.",
      retryable: true,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    };
  }

  return {
    code: "provider_unavailable",
    message: `Google Calendar rejected the synchronization request (${status}).`,
    retryable: false,
  };
}

function invalidResponse(message: string): CalendarSyncOutcome {
  return {
    ok: false,
    failure: { code: "invalid_response", message, retryable: false },
  };
}

function opaqueReference(providerId: string): string {
  return createHash("sha256")
    .update(`orbit:calendar.google:event:${providerId}`, "utf8")
    .digest("hex");
}

function sourceRecord(
  providerId: string,
  event: CalendarEvent,
  retrievedAt: Date,
): SourceRecord<CalendarEvent> {
  const reference = opaqueReference(providerId);
  return {
    id: `calendar.google.${reference.slice(0, 24)}`,
    connectorId: GOOGLE_CALENDAR_CONNECTOR_ID,
    schemaVersion: "1",
    externalReference: `sha256:${reference}`,
    provenance: { sourceLabel: "Google Calendar (read only)" },
    observedAt: event.updatedAt,
    retrievedAt: retrievedAt.toISOString(),
    staleAfter: new Date(
      retrievedAt.getTime() + GOOGLE_CALENDAR_CACHE_MS,
    ).toISOString(),
    payload: event,
  };
}

function calendarUrl(
  windowStart: Date,
  windowEnd: Date,
  pageToken?: string,
): URL {
  const url = new URL(GOOGLE_CALENDAR_EVENTS_ENDPOINT);
  url.searchParams.set("timeMin", windowStart.toISOString());
  url.searchParams.set("timeMax", windowEnd.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("showDeleted", "false");
  url.searchParams.set("maxResults", String(GOOGLE_CALENDAR_PAGE_SIZE));
  url.searchParams.set("fields", CALENDAR_FIELDS);
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  return url;
}

function requestFailure(error: unknown): CalendarSyncOutcome {
  const name =
    isRecord(error) && typeof error.name === "string" ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return {
      ok: false,
      failure: {
        code: "timeout",
        message: "Google Calendar synchronization timed out.",
        retryable: true,
      },
    };
  }

  if (error instanceof ResponseLimitError) {
    return invalidResponse("Google Calendar returned an oversized response.");
  }

  return {
    ok: false,
    failure: {
      code: "provider_unavailable",
      message: "Google Calendar could not be reached.",
      retryable: true,
    },
  };
}

export async function syncGoogleCalendar(
  request: GoogleCalendarSyncRequest,
  options: GoogleCalendarSyncOptions = {},
): Promise<CalendarSyncOutcome> {
  if (!Number.isFinite(request.now.getTime())) {
    return invalidResponse("Calendar synchronization requires a valid clock.");
  }
  const accessToken = request.accessToken.trim();
  if (accessToken.length === 0 || accessToken.length > 16_384) {
    return {
      ok: false,
      failure: {
        code: "authentication_required",
        message: "Google Calendar authorization is required.",
        retryable: false,
      },
    };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? GOOGLE_CALENDAR_REQUEST_TIMEOUT_MS;
  const signal = AbortSignal.timeout(timeoutMs);
  const windowStart = new Date(request.now.getTime() - DAY_MS);
  const windowEnd = new Date(request.now.getTime() + 14 * DAY_MS);
  const seenTokens = new Set<string>();
  const seenProviderIds = new Set<string>();
  const records: Array<SourceRecord<CalendarEvent>> = [];
  let pageToken: string | undefined;
  let pageCount = 0;

  while (pageCount < GOOGLE_CALENDAR_MAX_PAGES) {
    let response: Response;
    let body: string;
    try {
      response = await fetchImpl(
        calendarUrl(windowStart, windowEnd, pageToken),
        {
          method: "GET",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
          redirect: "error",
          signal,
        },
      );
      body = await readBoundedText(response);
    } catch (error) {
      return requestFailure(error);
    }

    if (!response.ok) {
      return {
        ok: false,
        failure: httpFailure(
          response.status,
          body,
          parseRetryAfter(response.headers.get("retry-after"), request.now),
        ),
      };
    }

    if (
      !(response.headers.get("content-type") ?? "").includes("application/json")
    ) {
      return invalidResponse("Google Calendar returned a non-JSON response.");
    }

    let pageValue: unknown;
    try {
      pageValue = JSON.parse(body);
    } catch {
      return invalidResponse("Google Calendar returned malformed JSON.");
    }

    const page = parsePage(pageValue);
    if (!page) {
      return invalidResponse("Google Calendar returned invalid event data.");
    }

    pageCount += 1;
    for (const { providerId, event } of page.events) {
      if (seenProviderIds.has(providerId)) {
        return invalidResponse(
          "Google Calendar returned duplicate event identifiers.",
        );
      }
      seenProviderIds.add(providerId);
      records.push(sourceRecord(providerId, event, request.now));
      if (records.length > GOOGLE_CALENDAR_MAX_EVENTS) {
        return invalidResponse(
          "Google Calendar exceeded the event cap for one page set.",
        );
      }
    }

    if (!page.nextPageToken) {
      const batch: CalendarSyncBatch = {
        connectorId: GOOGLE_CALENDAR_CONNECTOR_ID,
        records,
        retrievedAt: request.now.toISOString(),
        staleAfter: new Date(
          request.now.getTime() + GOOGLE_CALENDAR_CACHE_MS,
        ).toISOString(),
        window: {
          startsAt: windowStart.toISOString(),
          endsAt: windowEnd.toISOString(),
        },
        pageCount,
        completeness: "complete",
      };
      return { ok: true, batch };
    }

    if (seenTokens.has(page.nextPageToken)) {
      return invalidResponse("Google Calendar returned a repeated page token.");
    }
    seenTokens.add(page.nextPageToken);
    pageToken = page.nextPageToken;
  }

  return {
    ok: true,
    batch: {
      connectorId: GOOGLE_CALENDAR_CONNECTOR_ID,
      records,
      retrievedAt: request.now.toISOString(),
      staleAfter: new Date(
        request.now.getTime() + GOOGLE_CALENDAR_CACHE_MS,
      ).toISOString(),
      window: {
        startsAt: windowStart.toISOString(),
        endsAt: windowEnd.toISOString(),
      },
      pageCount,
      completeness: "page_cap",
    },
  };
}
