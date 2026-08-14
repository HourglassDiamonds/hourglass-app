/**
 * Founder Morning Brief quality gate.
 * Blocks sending empty / duplicative / internally-leaky briefs.
 */

import type { FounderBrief } from "./types";
import { actionJaccard, cleanFounderFacingAction } from "./brief-quality";

export type BriefQualityViolationCode =
  | "duplicative-today-call-and-roi"
  | "no-named-priority"
  | "decision-missing-recommendation"
  | "metric-missing-magnitude"
  | "internal-adapter-terminology"
  | "majority-missing-data-copy"
  | "no-concrete-founder-content"
  | "empty-no-action-brief";

export type BriefQualityViolation = {
  code: BriefQualityViolationCode;
  detail: string;
};

export type BriefQualityGateResult =
  | { ok: true; violations: [] }
  | { ok: false; violations: BriefQualityViolation[] };

const INTERNAL_TERMINOLOGY_RE =
  /\b(adapter(?:s)?\s+unavailable|no verified external opportunity adapter|evidence unavailable|processing delay expected|recommendations rely on repository and internal evidence|hubspot aggregates unavailable|buffer\/social unavailable|gbp unavailable|not configured|fixture leak|retrieval failed|source-unavailable|agent os v1)\b/i;

const NO_ACTION_RE =
  /no high-confidence founder (?:action|move) required|quiet operating day|no named priorities this cycle|none required this cycle|nothing to do|no durable operating priority/i;

const METRIC_WITHOUT_MAGNITUDE_RE =
  /\b(sessions?|clicks?|impressions?|views?|ctr|position)\b[^.\n]{0,40}\b(softened|declined|dropped|rose|increased|fell|up|down)\b(?![^.\n]{0,40}\d)/i;

const NUMERIC_MAGNITUDE_RE =
  /\d+(\.\d+)?\s*%|\b\d{1,3}(,\d{3})+\b|\b\d+\b/;

function normalizeForCompare(s: string): string {
  return cleanFounderFacingAction(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoActionCopy(text: string): boolean {
  return NO_ACTION_RE.test(text.trim());
}

function decisionHasRecommendation(text: string): boolean {
  const t = text.trim();
  if (!t || /^none(\s+required)?/i.test(t)) return true; // absence of decision is ok
  if (/^no founder approvals required/i.test(t)) return true;
  return (
    /\brecommend(?:ation|ed|s)?\b/i.test(t) ||
    /\brecommended choice\b/i.test(t) ||
    /\bchoose\b/i.test(t)
  );
}

function visibleFounderCopy(brief: FounderBrief, todayCall?: string): string {
  return [
    todayCall ?? "",
    brief.whyItMatters,
    brief.highestRoiAction,
    ...brief.needsAttentionToday,
    ...brief.surfacedPriorityTitles,
    ...brief.founderDecisionNeeded,
    ...brief.canSafelyWait,
    ...brief.blocked,
    ...brief.missingOrUnreliableData,
    brief.whatChanged,
  ]
    .filter(Boolean)
    .join("\n");
}

function countMissingDataSentences(text: string): {
  missing: number;
  total: number;
} {
  const sentences = text
    .split(/[\n.]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  const missing = sentences.filter((s) =>
    /unavailable|missing|not configured|no verified|incomplete|unreliable|not available/i.test(
      s,
    ),
  ).length;
  return { missing, total: Math.max(sentences.length, 1) };
}

/**
 * Evaluate whether a founder brief is usable enough to send.
 * `todayCall` should be the same string the email renderer will show.
 */
export function evaluateBriefQualityGate(input: {
  brief: FounderBrief;
  todayCall?: string;
  opportunityWatch?: string | null;
  intent?: "daily" | "weekly";
}): BriefQualityGateResult {
  const { brief } = input;
  const intent = input.intent ?? "daily";
  const todayCall =
    input.todayCall ??
    brief.whyItMatters;
  const violations: BriefQualityViolation[] = [];

  const todayNorm = normalizeForCompare(todayCall);
  const roiNorm = normalizeForCompare(brief.highestRoiAction);
  if (
    todayNorm &&
    roiNorm &&
    (todayNorm === roiNorm ||
      actionJaccard(todayCall, brief.highestRoiAction) >= 0.72 ||
      todayNorm.includes(roiNorm) ||
      roiNorm.includes(todayNorm))
  ) {
    // Allow shared quiet-day suppression path to be caught by empty-no-action instead
    if (!isNoActionCopy(todayCall) || !isNoActionCopy(brief.highestRoiAction)) {
      violations.push({
        code: "duplicative-today-call-and-roi",
        detail: "Today’s Call and Highest-ROI Move are semantically duplicative",
      });
    }
  }

  const namedPriorities = brief.surfacedPriorityTitles.filter(
    (t) => t && !/^none$/i.test(t) && !isNoActionCopy(t),
  );
  const hasRoiAction =
    Boolean(brief.highestRoiAction?.trim()) &&
    !isNoActionCopy(brief.highestRoiAction);

  if (intent === "daily" && namedPriorities.length === 0 && !hasRoiAction) {
    violations.push({
      code: "no-named-priority",
      detail: "No actual priority is named",
    });
  }

  for (const d of brief.founderDecisionNeeded) {
    if (!decisionHasRecommendation(d)) {
      violations.push({
        code: "decision-missing-recommendation",
        detail: `Decision listed without a recommendation: ${d.slice(0, 120)}`,
      });
    }
  }

  const metricCandidates = [
    brief.whatChanged,
    ...(input.opportunityWatch ? [input.opportunityWatch] : []),
    ...brief.needsAttentionToday,
    ...brief.canSafelyWait,
  ];
  for (const line of metricCandidates) {
    if (!line) continue;
    if (
      METRIC_WITHOUT_MAGNITUDE_RE.test(line) &&
      !NUMERIC_MAGNITUDE_RE.test(line)
    ) {
      violations.push({
        code: "metric-missing-magnitude",
        detail: `Metric mentioned without magnitude/context: ${line.slice(0, 120)}`,
      });
    }
  }

  const visible = visibleFounderCopy(brief, todayCall);
  if (INTERNAL_TERMINOLOGY_RE.test(visible)) {
    violations.push({
      code: "internal-adapter-terminology",
      detail: "Internal adapter/debug terminology appears in founder-facing copy",
    });
  }

  const { missing, total } = countMissingDataSentences(visible);
  if (missing / total > 0.5) {
    violations.push({
      code: "majority-missing-data-copy",
      detail: "More than half of visible content describes missing data",
    });
  }

  const hasConcrete =
    hasRoiAction ||
    namedPriorities.length > 0 ||
    brief.founderDecisionNeeded.some(
      (d) => d && !/^none/i.test(d) && decisionHasRecommendation(d),
    ) ||
    brief.needsAttentionToday.some(
      (t) => t && !/^none$/i.test(t) && !/^see highest/i.test(t),
    );

  if (!hasConcrete) {
    violations.push({
      code: "no-concrete-founder-content",
      detail:
        "Brief contains no concrete founder action, decision, deadline, or useful operational status",
    });
  }

  if (
    isNoActionCopy(todayCall) &&
    isNoActionCopy(brief.highestRoiAction) &&
    namedPriorities.length === 0
  ) {
    violations.push({
      code: "empty-no-action-brief",
      detail: "Empty “no action required” brief must not be sent",
    });
  }

  if (violations.length === 0) {
    return { ok: true, violations: [] };
  }
  return { ok: false, violations };
}

/** Quality codes that describe a legitimate quiet day — not a hollow/leaky brief. */
const QUIET_DAY_VIOLATION_CODES: ReadonlySet<BriefQualityViolationCode> = new Set([
  "no-named-priority",
  "empty-no-action-brief",
  "no-concrete-founder-content",
]);

/** True when the only quality failures are quiet-day emptiness, not leaky/hollow copy. */
export function isQuietDayQualityFailure(
  result: BriefQualityGateResult,
): boolean {
  if (result.ok || result.violations.length === 0) return false;
  return result.violations.every((v) => QUIET_DAY_VIOLATION_CODES.has(v.code));
}

/**
 * Daily brief with no named founder-now work and no-action Highest-ROI.
 * Distinct from a leaky hollow brief (July 28 class).
 */
export function isQuietDayFounderBrief(brief: FounderBrief): boolean {
  const namedPriorities = brief.surfacedPriorityTitles.filter(
    (t) => t && !/^none$/i.test(t) && !isNoActionCopy(t),
  );
  return namedPriorities.length === 0 && isNoActionCopy(brief.highestRoiAction);
}

/** True when copy looks like quiet-day / no-action filler. */
export function isEmptyNoActionBrief(brief: FounderBrief, todayCall?: string): boolean {
  return !evaluateBriefQualityGate({ brief, todayCall, intent: "daily" }).ok;
}
