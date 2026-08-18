/**
 * Cadence window identity helpers (founder timezone).
 */

import { FOUNDER_CADENCE_TIMEZONE } from "../persistence/cadence";
import {
  founderLocalIsoWeekday,
  localCalendarStamp,
  localMinutesSinceMidnight,
} from "../persistence/timezone";
import {
  resolveLocalEligibleAt,
  resolveLocalEligibleWeekdays,
} from "../persistence/evaluate-cadence";
import type {
  AgentOsPersistedState,
  CadenceDefinition,
  FrequencyClass,
} from "../persistence/types";

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

/**
 * Official in-progress lock identity.
 * Daily and Weekly CoS must not share `chief-of-staff` — a Monday weekly
 * run must not mark daily as already-running / already satisfied.
 */
export function officialInProgressKey(cadenceId: string): string {
  return `cadence:${cadenceId}`;
}

export function isOfficialInProgressKey(key: string): boolean {
  return key.startsWith("cadence:");
}

const ACCEPTED_OFFICIAL_STATUSES = new Set(["sent"]);

/**
 * True when the official founder-brief window has provider-accepted send.
 * Uncertain / failed / suppressed / reserved do not satisfy the contract.
 */
export function officialWindowHasAcceptedSend(
  state: AgentOsPersistedState,
  cadenceId: string,
  officialWindow: string,
): boolean {
  for (const rec of Object.values(state.deliveries ?? {})) {
    if (rec.cadenceId !== cadenceId) continue;
    if (rec.kind !== "founder-brief") continue;
    if (rec.cadenceWindow !== officialWindow) continue;
    if (ACCEPTED_OFFICIAL_STATUSES.has(rec.status)) return true;
  }
  return false;
}

/**
 * True when a guaranteed Daily/Weekly window is still open:
 * after local eligible time, on an eligible weekday, and no accepted send
 * for this official window. Catch-up is the same-day remaining scheduler
 * invocations (7 AM + 8 AM America/New_York). Next local date / next Monday
 * is a new window — ancient misses are not replayed.
 */
export function isOfficialGuaranteedWindowOpen(
  cadence: CadenceDefinition,
  state: AgentOsPersistedState,
  nowIso: string,
): boolean {
  if (!isFounderBriefCadence(cadence.cadenceId) || !cadence.enabled) {
    return false;
  }
  const tz = cadence.timezone || FOUNDER_CADENCE_TIMEZONE;
  const stamp = localCalendarStamp(nowIso, tz);
  const eligibleAt = resolveLocalEligibleAt(cadence);
  if (eligibleAt) {
    const minutesNow = localMinutesSinceMidnight(stamp);
    if (minutesNow < eligibleAt.hour * 60 + eligibleAt.minute) return false;
  }
  const weekdays = resolveLocalEligibleWeekdays(cadence);
  if (weekdays && weekdays.length > 0) {
    if (!weekdays.includes(founderLocalIsoWeekday(stamp.date))) return false;
  }
  const window = cadenceWindowId(cadence, nowIso);
  if (officialWindowHasAcceptedSend(state, cadence.cadenceId, window)) {
    return false;
  }
  return true;
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

/**
 * Historical same-day anti-redundancy helper.
 * Product contract (P0-COS-3): Monday Daily and Weekly are independently
 * guaranteed. Callers must not use this to skip Daily after Weekly.
 */
export function weeklyFounderBriefOccupiesLocalDate(
  _state: AgentOsPersistedState,
  _localDate: string,
  _timeZone: string = FOUNDER_CADENCE_TIMEZONE,
): boolean {
  void _state;
  void _localDate;
  void _timeZone;
  return false;
}

/** Whether a cadence execution result indicates a successful founder-brief claim/send. */
export function founderBriefClaimSucceeded(result: {
  deliveryAction: string;
  deliveryStatus: string | null;
  emailSent: boolean;
}): boolean {
  if (result.emailSent) return true;
  if (result.deliveryAction === "send-failure-alert") return false;
  if (result.deliveryAction === "send-nothing") return false;
  if (result.deliveryAction === "block") return false;
  if (result.deliveryAction === "suppressed") return false;
  const status = result.deliveryStatus;
  if (
    status === "reserved" ||
    status === "sending" ||
    status === "sent" ||
    status === "uncertain"
  ) {
    return result.deliveryAction === "send-founder-brief" || status === "sent";
  }
  return false;
}
