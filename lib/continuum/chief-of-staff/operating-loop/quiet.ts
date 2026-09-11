/**
 * Read-only Today quiet rules for Candidates.
 * Does not write review status, specs, or Open Jobs.
 */

import { deferredUntilOf } from "@/lib/continuum/candidates/review";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import {
  civilDateInZone,
  compareDateOnly,
  parseDateOnly,
} from "@/lib/continuum/date-only";

const DATE_ONLY_MIDNIGHT = /T00:00:00(?:\.000)?Z$/;

export function isSnoozeStillQuiet(untilIso: string, nowIso: string): boolean {
  const until = untilIso.trim();
  const now = nowIso.trim();
  if (!until || !now) return true;
  if (DATE_ONLY_MIDNIGHT.test(until)) {
    const untilDay = parseDateOnly(until);
    const today = civilDateInZone(now);
    if (untilDay && today) return compareDateOnly(today, untilDay) < 0;
  }
  const untilMs = Date.parse(until);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(untilMs) || !Number.isFinite(nowMs)) return true;
  return untilMs > nowMs;
}

export function isCandidateQuietForToday(
  row: ContinuumCandidate,
  nowIso: string,
): boolean {
  if (row.candidateState === "superseded") return true;
  if (row.reviewStatus === "discarded") return true;
  if (row.reviewStatus !== "deferred") return false;
  const until = deferredUntilOf(row);
  if (!until) return true;
  return isSnoozeStillQuiet(until, nowIso);
}
