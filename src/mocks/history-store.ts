import type { ActionAuditRecord } from "@/domain/orbit/types";

const STORAGE_KEY = "orbit.mock.audit-record";

export function saveAuditRecord(record: ActionAuditRecord): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  }
}

export function loadAuditRecord(): ActionAuditRecord | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as ActionAuditRecord;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearAuditRecord(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
