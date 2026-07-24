/**
 * Cadence window identity helpers (founder timezone).
 */

import { FOUNDER_CADENCE_TIMEZONE } from "../persistence/cadence";
import { localCalendarStamp } from "../persistence/timezone";
import type { CadenceDefinition, FrequencyClass } from "../persistence/types";

/**
 * Stable cadence window key for idempotency.
 * Daily → local calendar date; weekly → ISO-like year-week in founder TZ; on-demand → stamp+hour.
 */
export function cadenceWindowId(
  cadence: CadenceDefinition,
  nowIso: string,
): string {
  const stamp = localCalendarStamp(
    nowIso,
    cadence.timezone || FOUNDER_CADENCE_TIMEZONE,
  );
  return windowForFrequency(cadence.frequencyClass, stamp.date, stamp.hour);
}

export function windowForFrequency(
  frequency: FrequencyClass,
  localDate: string,
  localHour: number,
): string {
  if (frequency === "daily") {
    return `day:${localDate}`;
  }
  if (frequency === "weekly") {
    return `week:${isoWeekKey(localDate)}`;
  }
  return `ondemand:${localDate}T${String(localHour).padStart(2, "0")}`;
}

/** ISO week key from YYYY-MM-DD (UTC noon of local date to avoid DST edge). */
function isoWeekKey(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // ISO week: Thursday-based
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Cadences that assemble the full five-executive founder brief + email path. */
export const FOUNDER_BRIEF_CADENCE_IDS = [
  "cos-weekly-founder-brief",
  "cos-daily-synthesis",
] as const;

export type FounderBriefCadenceId =
  (typeof FOUNDER_BRIEF_CADENCE_IDS)[number];

export function isFounderBriefCadence(cadenceId: string): boolean {
  return (FOUNDER_BRIEF_CADENCE_IDS as readonly string[]).includes(cadenceId);
}

/** Prefer weekly founder brief when listing; does not mark others complete. */
export function pickPreferredFounderCadence(
  dueCadenceIds: string[],
): string | null {
  const ordered = listDueFounderCadencesInOrder(dueCadenceIds);
  return ordered[0] ?? null;
}

/**
 * Deterministic order for simultaneous due founder cadences.
 * Weekly before daily — processing one does not mark the other complete.
 */
export function listDueFounderCadencesInOrder(
  dueCadenceIds: string[],
): string[] {
  const set = new Set(dueCadenceIds.filter(isFounderBriefCadence));
  const out: string[] = [];
  for (const id of FOUNDER_BRIEF_CADENCE_IDS) {
    if (set.has(id)) out.push(id);
  }
  for (const id of set) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
