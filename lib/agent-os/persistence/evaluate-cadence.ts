/**
 * Deterministic cadence due / skip evaluation.
 * Does not execute jobs — evaluation only.
 */

import type { SourceHealth } from "../types";
import type {
  CadenceDefinition,
  CadenceEvaluation,
  CadenceEvaluationReason,
  RunTrigger,
} from "./types";
import { localCalendarStamp } from "./timezone";

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
    // Still check catch-up if never attempted after a long gap — handled below
    const withinFresh = now - lastSuccess < cadence.freshnessWindowMs;
    if (withinFresh && !(cadence.catchUpBehavior !== "none" && lastAttempt == null)) {
      // due only if past minimum AND outside a "recent enough" half-window for weekly?
      // Spec: is last run recent enough → not-due
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
    lastSuccess == null ||
    now - lastSuccess > cadence.freshnessWindowMs
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
    `Cadence due (local ${local.date} hour=${local.hour} offsetMin=${local.offsetMinutes} tz=${cadence.timezone})`,
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
