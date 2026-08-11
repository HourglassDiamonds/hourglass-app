/** Absolute timestamp helpers for Concierge SLA — no manual DST math. */

import {
  CONCIERGE_SLA_DUE_HOURS,
  CONCIERGE_SLA_DUE_SOON_HOURS,
} from "./types";

export function addElapsedHours(iso: string, hours: number): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    throw new Error("invalid_submitted_at");
  }
  return new Date(ms + hours * 3600_000).toISOString();
}

export function dueAtFromSubmittedAt(submittedAt: string): string {
  return addElapsedHours(submittedAt, CONCIERGE_SLA_DUE_HOURS);
}

export function ageHours(submittedAt: string, nowIso: string): number {
  const start = Date.parse(submittedAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(start) || !Number.isFinite(now)) return 0;
  return (now - start) / 3600_000;
}

export function isDueSoonWindow(
  submittedAt: string,
  nowIso: string,
): boolean {
  const age = ageHours(submittedAt, nowIso);
  return age >= CONCIERGE_SLA_DUE_SOON_HOURS && age < CONCIERGE_SLA_DUE_HOURS;
}

export function isOverdueWindow(submittedAt: string, nowIso: string): boolean {
  return ageHours(submittedAt, nowIso) >= CONCIERGE_SLA_DUE_HOURS;
}

/** Display founder-facing times in America/New_York. */
export function formatFounderLocal(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}
