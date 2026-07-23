/**
 * Output freshness rules for Agent OS executives and synthesis.
 * Internal timestamps are UTC.
 */

import type { ExecutiveId } from "../types";
import type { FreshnessEvaluation } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const FRESHNESS_WINDOWS_MS = {
  "source-health": 6 * HOUR,
  "business-intelligence": 7 * DAY,
  "search-strategy": 7 * DAY,
  content: 7 * DAY,
  opportunity: 7 * DAY,
  "chief-of-staff": 36 * HOUR,
  "founder-brief": 7 * DAY,
} as const;

export type FreshnessScope = keyof typeof FRESHNESS_WINDOWS_MS;

export function evaluateFreshness(input: {
  scope: FreshnessScope;
  lastSuccessfulAt: string | null;
  nowIso: string;
  /** Explicit degraded policy allows CoS to synthesize with partial freshness. */
  allowPartialSynthesis?: boolean;
}): FreshnessEvaluation {
  const window = FRESHNESS_WINDOWS_MS[input.scope];
  if (!input.lastSuccessfulAt) {
    return {
      scope: scopeAsExecutive(input.scope),
      fresh: false,
      stale: true,
      ageMs: null,
      freshnessWindowMs: window,
      reason: "No successful output timestamp",
      compatibleWithSynthesis: Boolean(input.allowPartialSynthesis),
    };
  }
  const ageMs = Date.parse(input.nowIso) - Date.parse(input.lastSuccessfulAt);
  const fresh = ageMs >= 0 && ageMs <= window;
  const stale = !fresh;
  return {
    scope: scopeAsExecutive(input.scope),
    fresh,
    stale,
    ageMs,
    freshnessWindowMs: window,
    reason: fresh
      ? "Within freshness window"
      : "Outside freshness window — mark stale; do not masquerade as current",
    compatibleWithSynthesis: fresh || Boolean(input.allowPartialSynthesis),
  };
}

function scopeAsExecutive(
  scope: FreshnessScope,
): ExecutiveId | "source-health" | "founder-brief" {
  if (scope === "source-health" || scope === "founder-brief") return scope;
  return scope;
}

/**
 * Chief of Staff dependency freshness across executive outputs.
 * Incompatible windows are labeled; partial synthesis only under explicit policy.
 */
export function evaluateChiefOfStaffDependencyFreshness(input: {
  executiveLastSuccess: Partial<Record<ExecutiveId, string | null>>;
  nowIso: string;
  allowPartialSynthesis: boolean;
}): {
  overallCompatible: boolean;
  degraded: boolean;
  perExecutive: FreshnessEvaluation[];
  label: string;
} {
  const ids: ExecutiveId[] = [
    "business-intelligence",
    "search-strategy",
    "content",
    "opportunity",
  ];
  const perExecutive = ids.map((id) =>
    evaluateFreshness({
      scope: id,
      lastSuccessfulAt: input.executiveLastSuccess[id] ?? null,
      nowIso: input.nowIso,
      allowPartialSynthesis: input.allowPartialSynthesis,
    }),
  );
  const allFresh = perExecutive.every((e) => e.fresh);
  const anyMissing = perExecutive.some((e) => e.ageMs === null);
  const anyStale = perExecutive.some((e) => e.stale);
  if (allFresh) {
    return {
      overallCompatible: true,
      degraded: false,
      perExecutive,
      label: "All executive outputs fresh for synthesis",
    };
  }
  if (input.allowPartialSynthesis) {
    return {
      overallCompatible: true,
      degraded: true,
      perExecutive,
      label:
        "Partial freshness — synthesizing under explicit degraded policy; stale outputs labeled",
    };
  }
  return {
    overallCompatible: false,
    degraded: true,
    perExecutive,
    label: anyMissing
      ? "Missing executive outputs — synthesis blocked without degraded policy"
      : anyStale
        ? "Stale executive outputs — synthesis blocked without degraded policy"
        : "Incompatible freshness windows",
  };
}
