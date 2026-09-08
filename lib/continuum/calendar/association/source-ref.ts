/**
 * Calendar Candidate source_ref under the frozen #17 identity contract.
 *
 * Format: cal1|{calendar_id}|{calendar_event_id}
 *
 * Same event + same proposal → same candidateId (identity also hashes
 * candidateType / target / proposalKey).
 * Same event + different Project → different Candidate (targetId differs).
 * Same Calendar event re-read → no duplicate Candidate (put is idempotent).
 *
 * Prefix cal1| does not collide with:
 *   gc1|     Gmail
 *   hi1|     Human Intake
 *   he1|     PLAUD / reMarkable human evidence
 *   google_calendar:  #22 evidence source_ref (different layer)
 *
 * Fail closed rather than truncate. Do not embed descriptions.
 */

import { CANDIDATE_SOURCE_REF_MAX } from "@/lib/continuum/candidates/types";

export const CALENDAR_CANDIDATE_SOURCE_VERSION = "cal1" as const;

export type CalendarCandidateSourceRef = {
  calendarId: string;
  calendarEventId: string;
};

export function calendarCandidateSourceRefPrefix(calendarId: string): string {
  return `${CALENDAR_CANDIDATE_SOURCE_VERSION}|${calendarId.trim()}|`;
}

export function packCalendarCandidateSourceRef(
  input: CalendarCandidateSourceRef,
): { ok: true; sourceRef: string } | { ok: false; reason: "identity-too-long" } {
  const calendarId = input.calendarId.trim();
  const calendarEventId = input.calendarEventId.trim();
  if (!calendarId || !calendarEventId) {
    return { ok: false, reason: "identity-too-long" };
  }
  if (calendarId.includes("|") || calendarEventId.includes("|")) {
    return { ok: false, reason: "identity-too-long" };
  }
  const packed = [
    CALENDAR_CANDIDATE_SOURCE_VERSION,
    calendarId,
    calendarEventId,
  ].join("|");
  if (packed.length > CANDIDATE_SOURCE_REF_MAX) {
    return { ok: false, reason: "identity-too-long" };
  }
  return { ok: true, sourceRef: packed };
}

export function parseCalendarCandidateSourceRef(
  sourceRef: string,
): CalendarCandidateSourceRef | null {
  const raw = sourceRef.trim();
  const parts = raw.split("|");
  if (parts[0] !== CALENDAR_CANDIDATE_SOURCE_VERSION) return null;
  if (parts.length !== 3) return null;
  const calendarId = (parts[1] ?? "").trim();
  const calendarEventId = (parts[2] ?? "").trim();
  if (!calendarId || !calendarEventId) return null;
  return { calendarId, calendarEventId };
}
