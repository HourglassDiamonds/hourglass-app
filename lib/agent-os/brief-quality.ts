/**
 * Founder brief product-quality helpers.
 *
 * Cadence intent, priority selection (dedupe / clustering), and
 * founder-facing copy framing — does not touch delivery claims or send path.
 *
 * Priority selection rule (documented):
 * 1. Preserve highest-ROI ranking order from the ranked surface pool.
 * 2. Exclude internal source-limitation items from named founder priorities
 *    (they may still appear as blockers / data-confidence notes).
 * 3. Cluster by topic/asset (quoted title, supportingReference, or title tokens).
 * 4. Within a cluster: at most one primary + one secondary, and only when
 *    proposed actions are materially distinct (token Jaccard < 0.55).
 * 5. Diversity across clusters is a soft tie-breaker when filling remaining
 *    slots — never a hard executive quota.
 * 6. Cap remains 5; fewer than 5 is allowed.
 */

import type { Recommendation } from "./types";
import { FOUNDER_CADENCE_TIMEZONE } from "./persistence/cadence";
import { localCalendarStamp } from "./persistence/timezone";

export type BriefCadenceIntent = "daily" | "weekly";

export const MAX_SURFACED_FOUNDER_PRIORITIES = 5;

/** Max named priorities allowed from the same topic/asset cluster. */
export const MAX_PER_TOPIC_CLUSTER = 2;

/** Action-token Jaccard above this → treat as near-duplicate within a cluster. */
export const NEAR_DUPLICATE_ACTION_JACCARD = 0.55;

const INTERNAL_LIMITATION_TITLE_RE =
  /source material incomplete|connector unavailable|retrieval failed|aggregates unavailable|not configured|fixture leak|do not invent|no fabricated|unavailable —|ga4 retrieval failed|search console retrieval failed|hubspot aggregates unavailable|buffer\/social unavailable|gbp unavailable/i;

const INTERNAL_LIMITATION_ACTION_RE =
  /do not invent|do not fabricate|not a verified|connector|retrieval failed|complete filming\/editing assets in the repository|registry draft labels/i;

export function resolveBriefCadenceIntent(
  cadenceId: string | null | undefined,
): BriefCadenceIntent {
  if (cadenceId === "cos-daily-synthesis") return "daily";
  return "weekly";
}

/**
 * True when the recommendation is an internal system/source limitation
 * rather than a concrete founder operating action.
 */
export function isInternalLimitationRecommendation(
  rec: Pick<Recommendation, "title" | "proposedAction" | "plainLanguageExplanation">,
): boolean {
  const blob = `${rec.title}\n${rec.proposedAction}\n${rec.plainLanguageExplanation}`;
  if (INTERNAL_LIMITATION_TITLE_RE.test(rec.title)) return true;
  if (/source material incomplete/i.test(rec.title)) return true;
  // Low-urgency inventory completeness without a founder decision
  if (
    /incomplete for/i.test(rec.title) &&
    INTERNAL_LIMITATION_ACTION_RE.test(rec.proposedAction)
  ) {
    return true;
  }
  if (
    /do not invent|do not fabricate metrics/i.test(blob) &&
    /unavailable|incomplete|failed|not configured/i.test(rec.title)
  ) {
    return true;
  }
  return false;
}

/** Stable topic/asset cluster key for near-duplicate control. */
export function topicClusterKey(rec: Recommendation): string {
  const quoted = rec.title.match(/[“"]([^”"]+)[”"]/);
  if (quoted?.[1]) {
    return `asset:${normalizeTokens(quoted[1])}`;
  }
  const ref = rec.evidence?.[0]?.supportingReference;
  if (ref && ref.length > 4) {
    return `ref:${normalizeTokens(ref).slice(0, 80)}`;
  }
  const topicObservation = rec.evidence?.[0]?.metricOrObservation;
  if (topicObservation && /:/.test(topicObservation)) {
    const after = topicObservation.split(":").slice(1).join(":").trim();
    if (after.length > 3) return `obs:${normalizeTokens(after).slice(0, 80)}`;
  }
  const tokens = normalizeTokens(rec.title)
    .split(" ")
    .filter((t) => t.length > 3 && !STOP_WORDS.has(t))
    .slice(0, 4)
    .join(" ");
  return `title:${rec.originatingExecutive}:${tokens || normalizeTokens(rec.title).slice(0, 40)}`;
}

const STOP_WORDS = new Set([
  "from",
  "with",
  "that",
  "this",
  "confirm",
  "content",
  "opportunity",
  "search",
  "strategy",
  "for",
  "the",
  "and",
  "path",
]);

function normalizeTokens(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function actionTokenSet(action: string): Set<string> {
  return new Set(
    normalizeTokens(action)
      .split(" ")
      .filter((t) => t.length > 3 && !STOP_WORDS.has(t)),
  );
}

export function actionJaccard(a: string, b: string): number {
  const sa = actionTokenSet(a);
  const sb = actionTokenSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function actionsMateriallyDistinct(
  a: string,
  b: string,
): boolean {
  return actionJaccard(a, b) < NEAR_DUPLICATE_ACTION_JACCARD;
}

export type SelectFounderPrioritiesResult = {
  highest: Recommendation | undefined;
  additional: Recommendation[];
  /** Internal limitations diverted from priority slots. */
  divertedInternalLimitations: Recommendation[];
  /** Near-duplicates suppressed within a topic cluster. */
  suppressedNearDuplicates: Recommendation[];
};

/**
 * Select ≤5 founder priorities with ranking preserved and soft topic diversity.
 */
export function selectFounderPriorities(
  rankedPool: Recommendation[],
  options?: { max?: number; maxPerCluster?: number },
): SelectFounderPrioritiesResult {
  const max = options?.max ?? MAX_SURFACED_FOUNDER_PRIORITIES;
  const maxPerCluster = options?.maxPerCluster ?? MAX_PER_TOPIC_CLUSTER;

  const divertedInternalLimitations: Recommendation[] = [];
  const suppressedNearDuplicates: Recommendation[] = [];
  const eligible: Recommendation[] = [];

  for (const r of rankedPool) {
    if (isInternalLimitationRecommendation(r)) {
      divertedInternalLimitations.push(r);
      continue;
    }
    eligible.push(r);
  }

  const selected: Recommendation[] = [];
  const clusterCounts = new Map<string, number>();
  const clusterPrimaries = new Map<string, Recommendation>();

  // Walk ranked order: preserve highest-ROI, soft-cap same-topic duplicates.
  for (const r of eligible) {
    if (selected.length >= max) break;
    const key = topicClusterKey(r);
    const count = clusterCounts.get(key) ?? 0;
    if (count >= maxPerCluster) {
      suppressedNearDuplicates.push(r);
      continue;
    }
    const primary = clusterPrimaries.get(key);
    if (
      primary &&
      !actionsMateriallyDistinct(primary.proposedAction, r.proposedAction)
    ) {
      suppressedNearDuplicates.push(r);
      continue;
    }
    selected.push(r);
    clusterCounts.set(key, count + 1);
    if (!primary) clusterPrimaries.set(key, r);
  }

  // Soft diversity fill: if still under cap, prefer remaining items from
  // clusters not yet represented (tie-breaker only — never a hard quota).
  if (selected.length < max) {
    const selectedIds = new Set(selected.map((r) => r.recommendationId));
    for (const r of eligible) {
      if (selected.length >= max) break;
      if (selectedIds.has(r.recommendationId)) continue;
      const key = topicClusterKey(r);
      if ((clusterCounts.get(key) ?? 0) > 0) continue;
      selected.push(r);
      selectedIds.add(r.recommendationId);
      clusterCounts.set(key, 1);
      clusterPrimaries.set(key, r);
      const idx = suppressedNearDuplicates.findIndex(
        (x) => x.recommendationId === r.recommendationId,
      );
      if (idx >= 0) suppressedNearDuplicates.splice(idx, 1);
    }
  }

  const highest = selected[0];
  const additional = selected.slice(1);
  return {
    highest,
    additional,
    divertedInternalLimitations,
    suppressedNearDuplicates,
  };
}

/** Format America/New_York local YYYY-MM-DD as "July 24, 2026". */
export function formatFounderLocalDateLabel(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  if (!y || !m || !d) return localDate;
  // Noon UTC avoids DST edge when formatting a calendar date as a label.
  const iso = new Date(Date.UTC(y, m - 1, d, 16, 0, 0)).toISOString();
  return new Intl.DateTimeFormat("en-US", {
    timeZone: FOUNDER_CADENCE_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function localDateFromCadenceWindow(
  cadenceWindow: string,
  nowIso?: string,
): string {
  const dayMatch = /^day:(\d{4}-\d{2}-\d{2})$/.exec(cadenceWindow);
  if (dayMatch) return dayMatch[1]!;
  const weekMatch = /^week:(\d{4}-\d{2}-\d{2})$/.exec(cadenceWindow);
  if (weekMatch) return weekMatch[1]!;
  return localCalendarStamp(
    nowIso ?? new Date().toISOString(),
    FOUNDER_CADENCE_TIMEZONE,
  ).date;
}

export function formatWeeklyRangeLabel(start: string, end: string): string {
  return `${start} — ${end}`;
}

/** Strip operator/debug parentheticals from founder-facing action lines. */
export function cleanFounderFacingAction(text: string): string {
  return text
    .replace(/\s*[—–-]\s*do not invent[^.]*\.?/gi, "")
    .replace(/\s*[—–-]\s*do not fabricate[^.]*\.?/gi, "")
    .replace(/\s*\(confidence\s*0?\.\d+\)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type DataConfidenceInput = {
  missingOrUnreliableData: string[];
  executiveNotes: string[];
  briefEvidenceQuality?: string;
  criticalFailure?: boolean;
};

/**
 * Compact data-confidence line for daily founder email.
 * Critical failures stay visible; routine gaps become one sentence.
 */
export function buildDataConfidenceNote(input: DataConfidenceInput): {
  level: "Full" | "Partial" | "Critical";
  summary: string;
  showDetails: boolean;
  detailLines: string[];
} {
  const gaps = input.missingOrUnreliableData.filter(Boolean);
  const critical =
    input.criticalFailure === true ||
    input.briefEvidenceQuality === "none-blocked" ||
    input.briefEvidenceQuality === "failed";

  if (critical) {
    const detailLines = [
      ...gaps.slice(0, 4),
      ...input.executiveNotes.slice(0, 2),
    ];
    return {
      level: "Critical",
      summary:
        detailLines[0] ??
        "Critical measurement sources unavailable — treat recommendations as provisional.",
      showDetails: true,
      detailLines,
    };
  }

  if (gaps.length === 0 && input.executiveNotes.length === 0) {
    return {
      level: "Full",
      summary: "Sources available for this cycle.",
      showDetails: false,
      detailLines: [],
    };
  }

  const shortGaps = gaps
    .map(shortenGapLabel)
    .filter(Boolean)
    .slice(0, 4);
  const unique = [...new Set(shortGaps)];
  return {
    level: "Partial",
    summary:
      unique.length > 0
        ? `${unique.join("; ")}; recommendations rely on repository and internal evidence.`
        : "Some sources unavailable; recommendations rely on repository and internal evidence.",
    showDetails: false,
    detailLines: [],
  };
}

function shortenGapLabel(g: string): string {
  const s = g.trim();
  if (/hubspot/i.test(s)) return "HubSpot unavailable";
  if (/buffer|social/i.test(s)) return "Buffer/social unavailable";
  if (/gbp|google business/i.test(s)) return "GBP unavailable";
  if (/ga4|google analytics/i.test(s)) return "GA4 unavailable";
  if (/gsc|search console/i.test(s)) return "Search Console unavailable";
  if (/weekly/i.test(s)) return "Weekly intelligence partial";
  if (s.length > 72) return `${s.slice(0, 69)}…`;
  return s;
}

export function dailyTodayCall(input: {
  whyItMatters: string;
  highestRoiAction: string;
}): string {
  const why = input.whyItMatters.trim();
  if (why && why.length <= 220 && !/^no high-confidence/i.test(why)) {
    return why;
  }
  const action = cleanFounderFacingAction(input.highestRoiAction);
  if (action && !/^none/i.test(action)) {
    return `Focus founder time on: ${action.split("—")[0]!.trim()}.`;
  }
  return "Quiet operating day — no high-confidence founder move required.";
}
