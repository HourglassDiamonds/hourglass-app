/**
 * Deterministic cadence due / skip evaluation.
 * Does not execute jobs — evaluation only.
 */

import type { SourceHealth } from "../types";
import type {
  CadenceDefinition,
  CadenceEvaluation,
  CadenceEvaluationReason,
  CadenceLocalEligibleAt,
  RunTrigger,
} from "./types";
import { getCadenceById } from "./cadence";
import {
  founderLocalIsoWeekday,
  localCalendarStamp,
  localMinutesSinceMidnight,
  utcIsoForLocalWallTime,
} from "./timezone";

export type CadenceEvaluateInput = {
  cadence: CadenceDefinition;
  nowIso: string;
  /** Override: on-demand / manual bypass of due window (not already-running). */
  trigger?: RunTrigger;
  sourceHealth?: SourceHealth[];
  /** Soft in-progress marker for this cadence scope. */
  inProgressRunId?: string | null;
  /**
   * Explicit allow for on-demand to proceed while already-running.
   * Default false — on-demand does NOT bypass already-running protection.
   */
  allowOnDemandWhileRunning?: boolean;
  /** Last successful executive/system output timestamp for freshness deps. */
  dependencyLastSuccessfulAt?: string | null;
  dependencyFreshnessWindowMs?: number | null;
};

function sourceOk(
  health: SourceHealth[] | undefined,
  sourceId: string,
): boolean {
  if (!health || health.length === 0) return true;
  const row = health.find((h) => h.sourceId === sourceId);
  if (!row) return false;
  return (
    row.retrievalState === "ok" ||
    row.retrievalState === "fixture" ||
    row.retrievalState === "empty"
  );
}

function sourcesRequiredHealthy(
  cadence: CadenceDefinition,
  health: SourceHealth[] | undefined,
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const req of cadence.sourceRequirements) {
    if (!sourceOk(health, req)) missing.push(req);
  }
  return { ok: missing.length === 0, missing };
}

/** Resolve schedule gate from persisted cadence or seeded default. */
export function resolveLocalEligibleAt(
  cadence: CadenceDefinition,
): CadenceLocalEligibleAt | null {
  if (cadence.localEligibleAt) return cadence.localEligibleAt;
  const seeded = getCadenceById(cadence.cadenceId);
  return seeded?.localEligibleAt ?? null;
}

/** ISO weekdays (1=Monday … 7=Sunday) from persisted cadence or seeded default. */
export function resolveLocalEligibleWeekdays(
  cadence: CadenceDefinition,
): number[] | null {
  if (cadence.localEligibleWeekdays && cadence.localEligibleWeekdays.length > 0) {
    return cadence.localEligibleWeekdays;
  }
  const seeded = getCadenceById(cadence.cadenceId);
  return seeded?.localEligibleWeekdays?.length
    ? seeded.localEligibleWeekdays
    : null;
}

/**
 * Local calendar schedule is authoritative when localEligibleAt is set:
 * - before local wall time → not due
 * - already succeeded on this local date → not due
 * - otherwise continue (sources / deps); skip interval/freshness as primary blockers
 */
function evaluateLocalScheduleGate(
  cadence: CadenceDefinition,
  nowIso: string,
  eligibleAt: CadenceLocalEligibleAt,
): CadenceEvaluation | null {
  const tz = cadence.timezone;
  const local = localCalendarStamp(nowIso, tz);
  const minutesNow = localMinutesSinceMidnight(local);
  const minutesEligible = eligibleAt.hour * 60 + eligibleAt.minute;

  if (minutesNow < minutesEligible) {
    const next = utcIsoForLocalWallTime(
      local.date,
      eligibleAt.hour,
      eligibleAt.minute,
      tz,
    );
    return result(
      cadence,
      nowIso,
      false,
      false,
      false,
      true,
      ["local-time-before-window", "not-due", "timezone-window"],
      `Before local eligible time ${String(eligibleAt.hour).padStart(2, "0")}:${String(eligibleAt.minute).padStart(2, "0")} (local ${local.date} ${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")} offsetMin=${local.offsetMinutes} tz=${tz})`,
      next,
    );
  }

  const weekdays = resolveLocalEligibleWeekdays(cadence);
  if (weekdays && weekdays.length > 0) {
    const dow = founderLocalIsoWeekday(local.date);
    if (!weekdays.includes(dow)) {
      return result(
        cadence,
        nowIso,
        false,
        false,
        false,
        true,
        ["weekday-outside-window", "not-due", "timezone-window"],
        `Local weekday ${dow} is outside eligible weekdays [${weekdays.join(",")}] (local ${local.date} tz=${tz})`,
        null,
      );
    }
  }

  if (cadence.lastSuccessfulAt) {
    const lastLocal = localCalendarStamp(cadence.lastSuccessfulAt, tz);
    if (lastLocal.date === local.date) {
      const nextDate = nextLocalDateString(local.date);
      const next = utcIsoForLocalWallTime(
        nextDate,
        eligibleAt.hour,
        eligibleAt.minute,
        tz,
      );
      return result(
        cadence,
        nowIso,
        false,
        false,
        false,
        true,
        ["already-ran-local-date", "not-due", "timezone-window"],
        `Already succeeded on local date ${local.date} (tz=${tz})`,
        next,
      );
    }
  }

  return null;
}

function nextLocalDateString(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function evaluateCadence(input: CadenceEvaluateInput): CadenceEvaluation {
  const { cadence, nowIso } = input;
  const reasons: CadenceEvaluationReason[] = [];
  const now = Date.parse(nowIso);

  if (!cadence.enabled) {
    return result(cadence, nowIso, false, false, false, true, ["disabled"], "Cadence disabled");
  }

  if (input.inProgressRunId) {
    const triggerEarly = input.trigger ?? cadence.intendedTrigger;
    const onDemandTrying =
      triggerEarly === "on-demand" ||
      triggerEarly === "manual" ||
      triggerEarly === "test";
    if (!(onDemandTrying && input.allowOnDemandWhileRunning)) {
      return result(
        cadence,
        nowIso,
        false,
        false,
        false,
        true,
        ["already-running"],
        `In-progress run ${input.inProgressRunId}`,
      );
    }
  }

  const trigger = input.trigger ?? cadence.intendedTrigger;
  if (trigger === "on-demand" || trigger === "manual" || trigger === "test") {
    reasons.push("manual-override");
    const src = sourcesRequiredHealthy(cadence, input.sourceHealth);
    if (!src.ok) {
      if (cadence.degradedRunPolicy === "skip") {
        reasons.push("source-unavailable");
        return result(
          cadence,
          nowIso,
          true,
          false,
          false,
          true,
          reasons,
          `Sources unavailable: ${src.missing.join(",")}`,
        );
      }
      reasons.push("degraded-allowed");
      return result(
        cadence,
        nowIso,
        true,
        true,
        true,
        false,
        reasons,
        `On-demand with degraded sources: ${src.missing.join(",") || "none"}`,
      );
    }
    return result(
      cadence,
      nowIso,
      true,
      true,
      false,
      false,
      reasons,
      "On-demand / manual override — cadence bypassed",
    );
  }

  const localEligibleAt = resolveLocalEligibleAt(cadence);
  if (localEligibleAt) {
    const gated = evaluateLocalScheduleGate(cadence, nowIso, localEligibleAt);
    if (gated) return gated;
    // Past local eligible time and not yet successful today — local calendar
    // is authoritative; skip rolling interval/freshness as primary blockers.
  } else {
    const lastSuccess = cadence.lastSuccessfulAt
      ? Date.parse(cadence.lastSuccessfulAt)
      : null;
    const lastAttempt = cadence.lastAttemptedAt
      ? Date.parse(cadence.lastAttemptedAt)
      : null;

    if (lastSuccess != null && now - lastSuccess < cadence.minimumIntervalMs) {
      reasons.push("minimum-interval", "not-due");
      const next = new Date(lastSuccess + cadence.minimumIntervalMs).toISOString();
      return result(
        cadence,
        nowIso,
        false,
        false,
        false,
        true,
        reasons,
        "Minimum interval not satisfied",
        next,
      );
    }

    // Freshness of last success within window → not due
    if (
      lastSuccess != null &&
      now - lastSuccess < cadence.freshnessWindowMs &&
      cadence.frequencyClass !== "on-demand"
    ) {
      const withinFresh = now - lastSuccess < cadence.freshnessWindowMs;
      if (withinFresh && !(cadence.catchUpBehavior !== "none" && lastAttempt == null)) {
        reasons.push("not-due");
        const next = new Date(lastSuccess + cadence.minimumIntervalMs).toISOString();
        return result(
          cadence,
          nowIso,
          false,
          false,
          false,
          true,
          reasons,
          "Last successful run still within freshness window",
          next,
        );
      }
    }
  }

  const lastSuccessForCatchUp = cadence.lastSuccessfulAt
    ? Date.parse(cadence.lastSuccessfulAt)
    : null;

  // Dependency freshness for CoS synthesis
  if (
    input.dependencyFreshnessWindowMs != null &&
    input.dependencyFreshnessWindowMs > 0
  ) {
    if (!input.dependencyLastSuccessfulAt) {
      reasons.push("dependency-missing");
      if (cadence.degradedRunPolicy === "skip") {
        return result(
          cadence,
          nowIso,
          true,
          false,
          false,
          true,
          reasons,
          "Required dependency output missing",
        );
      }
      reasons.push("degraded-allowed");
    } else {
      const depAge = now - Date.parse(input.dependencyLastSuccessfulAt);
      if (depAge > input.dependencyFreshnessWindowMs) {
        reasons.push("dependency-stale");
        if (cadence.degradedRunPolicy === "skip") {
          return result(
            cadence,
            nowIso,
            true,
            false,
            false,
            true,
            reasons,
            "Dependency output stale",
          );
        }
        reasons.push("degraded-allowed");
      }
    }
  }

  const src = sourcesRequiredHealthy(cadence, input.sourceHealth);
  if (!src.ok) {
    reasons.push("source-unavailable");
    if (cadence.degradedRunPolicy === "skip") {
      return result(
        cadence,
        nowIso,
        true,
        false,
        false,
        true,
        reasons,
        `Required sources unavailable: ${src.missing.join(",")}`,
      );
    }
    reasons.push("degraded-allowed");
    reasons.push("due");
    return result(
      cadence,
      nowIso,
      true,
      true,
      true,
      false,
      reasons,
      `Due with degraded sources: ${src.missing.join(",")}`,
    );
  }

  // Catch-up: never succeeded but enabled, or last success beyond freshness
  if (
    lastSuccessForCatchUp == null ||
    now - lastSuccessForCatchUp > cadence.freshnessWindowMs
  ) {
    if (cadence.catchUpBehavior === "run-once" || cadence.catchUpBehavior === "run-if-stale") {
      reasons.push("catch-up");
    }
  }

  reasons.push("due");
  // Founder TZ calendar stamp (DST-aware via Intl) — intervals remain absolute UTC ms.
  const local = localCalendarStamp(nowIso, cadence.timezone);
  reasons.push("timezone-window");

  return result(
    cadence,
    nowIso,
    true,
    true,
    reasons.includes("degraded-allowed"),
    false,
    reasons,
    `Cadence due (local ${local.date} hour=${local.hour} minute=${local.minute} offsetMin=${local.offsetMinutes} tz=${cadence.timezone})`,
    null,
  );
}

function result(
  cadence: CadenceDefinition,
  evaluatedAt: string,
  due: boolean,
  shouldProceed: boolean,
  proceedDegraded: boolean,
  shouldSkip: boolean,
  reasonCodes: CadenceEvaluationReason[],
  detail: string,
  nextEligibleAt: string | null = cadence.nextEligibleAt,
): CadenceEvaluation {
  return {
    cadenceId: cadence.cadenceId,
    due,
    shouldProceed,
    proceedDegraded,
    shouldSkip,
    reasonCodes,
    detail,
    evaluatedAt,
    nextEligibleAt,
  };
}

/** Evaluate all provided cadence definitions. */
export function evaluateAllCadences(
  cadences: CadenceDefinition[],
  input: Omit<CadenceEvaluateInput, "cadence">,
): CadenceEvaluation[] {
  return cadences.map((cadence) => evaluateCadence({ ...input, cadence }));
}
