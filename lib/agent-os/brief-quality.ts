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
import {
  makeDecisiveFounderRecommendation,
  replaceFounderFacingRoutes,
  sanitizeFounderFacingNarrative,
  synthesizeWeeklyExecutiveSummary,
  toFounderFacingPriorityAction,
} from "./founder-language";
import { shortenMeasurementGapLabel } from "./measurement/health-codes";

export type BriefCadenceIntent = "daily" | "weekly";

export const MAX_SURFACED_FOUNDER_PRIORITIES = 5;

/** Max named priorities allowed from the same topic/asset cluster. */
export const MAX_PER_TOPIC_CLUSTER = 2;

/** Action-token Jaccard above this → treat as near-duplicate within a cluster. */
export const NEAR_DUPLICATE_ACTION_JACCARD = 0.55;

const INTERNAL_LIMITATION_TITLE_RE =
  /source material incomplete|connector unavailable|retrieval failed|aggregates unavailable|not configured|fixture leak|do not invent|no fabricated|unavailable —|ga4 retrieval failed|search console retrieval failed|hubspot aggregates unavailable|buffer\/social unavailable|gbp unavailable|source-unavailable|measurement-gap|google-business-profile|ga4-journey/i;

const INTERNAL_LIMITATION_ACTION_RE =
  /do not invent|do not fabricate|not a verified|connector|retrieval failed|complete filming\/editing assets in the repository|registry draft labels|restore ga4|trusted gbp read|before diagnosing client journey|before evaluating profile performance/i;

/** Analytical inventory / theme observations — not a concrete founder move. */
const WEAK_ANALYTICAL_OBSERVATION_RE =
  /theme concentration|source material|broad theme|inventory completeness|registry draft|filming\/editing assets|do not invent|not a verified content gap|incomplete for “|incomplete for "/i;

const ENGINEERING_BLOCKER_RE =
  /not yet operational|missing dependencies|measurement prerequisite|adapter|retrieval|pipeline|connector|dependency|aggregates unavailable|completed-with-warnings|fixture/i;

const GENERIC_DECISION_FILLER_RE =
  /whether to spend founder time on the highest-roi|before new experiments$/i;

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
  rec: Pick<Recommendation, "title" | "proposedAction" | "plainLanguageExplanation"> & {
    recommendationId?: string;
  },
): boolean {
  const blob = `${rec.title}\n${rec.proposedAction}\n${rec.plainLanguageExplanation}\n${rec.recommendationId ?? ""}`;
  if (INTERNAL_LIMITATION_TITLE_RE.test(rec.title)) return true;
  if (INTERNAL_LIMITATION_TITLE_RE.test(rec.recommendationId ?? "")) return true;
  if (/source material incomplete/i.test(rec.title)) return true;
  // Low-urgency inventory completeness without a founder decision
  if (
    /incomplete for/i.test(rec.title) &&
    INTERNAL_LIMITATION_ACTION_RE.test(rec.proposedAction)
  ) {
    return true;
  }
  if (
    INTERNAL_LIMITATION_ACTION_RE.test(rec.proposedAction) &&
    /unavailable|incomplete|failed|not configured|measurement-gap|source-unavailable/i.test(
      blob,
    )
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

/**
 * True when the recommendation is an internal analytical observation
 * rather than a concrete, founder-actionable move.
 */
export function isWeakAnalyticalObservation(
  rec: Pick<Recommendation, "title" | "proposedAction" | "plainLanguageExplanation" | "urgency">,
): boolean {
  if (isInternalLimitationRecommendation(rec)) return true;
  const blob = `${rec.title}\n${rec.proposedAction}\n${rec.plainLanguageExplanation}`;
  if (WEAK_ANALYTICAL_OBSERVATION_RE.test(blob)) return true;
  if (
    rec.urgency === "low" &&
    /theme|concentration|inventory|source material/i.test(rec.title)
  ) {
    return true;
  }
  // No clear imperative for the founder
  if (
    !/\b(confirm|ensure|ship|launch|approve|decide|restore|fix|complete|publish|strengthen|clarify|close|prioritize)\b/i.test(
      `${rec.title} ${rec.proposedAction}`,
    ) &&
    /concentration|incomplete|unavailable|gap in source/i.test(blob)
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

function toUtcIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Convert an ISO week key (`2026-W30`) to its Monday–Sunday date range (UTC calendar dates).
 * Uses the ISO-8601 rule: week 1 contains the year's first Thursday; weeks start Monday.
 */
export function isoWeekKeyToDateRange(isoWeekKey: string): {
  start: string;
  end: string;
} {
  const match = /^(\d{4})-W(\d{2})$/.exec(isoWeekKey.trim());
  if (!match) {
    throw new Error(`Invalid ISO week key: ${isoWeekKey}`);
  }
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) {
    throw new Error(`Invalid ISO week number: ${isoWeekKey}`);
  }
  // Jan 4 is always in ISO week 1 of `year`.
  const jan4 = new Date(Date.UTC(year, 0, 4, 12, 0, 0));
  const jan4Dow = jan4.getUTCDay() || 7; // Mon=1 … Sun=7
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: toUtcIsoDate(monday), end: toUtcIsoDate(sunday) };
}

/** Monday–Sunday range starting at a YYYY-MM-DD Monday (or any day → that week's Monday). */
export function mondaySundayRangeFromDate(localDate: string): {
  start: string;
  end: string;
} {
  const [y, m, d] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - (dow - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: toUtcIsoDate(monday), end: toUtcIsoDate(sunday) };
}

/**
 * Resolve the founder-facing week range from a cadence window.
 * Prefer ISO `week:YYYY-Www` (authoritative delivery identity).
 * Also accepts legacy `week:YYYY-MM-DD`.
 */
export function weeklyRangeFromCadenceWindow(
  cadenceWindow: string,
  fallback?: { start: string; end: string },
): { start: string; end: string } {
  const iso = /^week:(\d{4}-W\d{2})$/.exec(cadenceWindow);
  if (iso) return isoWeekKeyToDateRange(iso[1]!);
  const dateForm = /^week:(\d{4}-\d{2}-\d{2})$/.exec(cadenceWindow);
  if (dateForm) return mondaySundayRangeFromDate(dateForm[1]!);
  if (fallback?.start && fallback?.end) return fallback;
  throw new Error(`Cannot derive weekly range from window: ${cadenceWindow}`);
}

export function localDateFromCadenceWindow(
  cadenceWindow: string,
  nowIso?: string,
): string {
  const dayMatch = /^day:(\d{4}-\d{2}-\d{2})$/.exec(cadenceWindow);
  if (dayMatch) return dayMatch[1]!;
  const isoWeek = /^week:(\d{4}-W\d{2})$/.exec(cadenceWindow);
  if (isoWeek) return isoWeekKeyToDateRange(isoWeek[1]!).start;
  const weekMatch = /^week:(\d{4}-\d{2}-\d{2})$/.exec(cadenceWindow);
  if (weekMatch) return weekMatch[1]!;
  return localCalendarStamp(
    nowIso ?? new Date().toISOString(),
    FOUNDER_CADENCE_TIMEZONE,
  ).date;
}

/** Compact ISO range for engineering labels: `2026-07-20 — 2026-07-26`. */
export function formatWeeklyRangeLabel(start: string, end: string): string {
  return `${start} — ${end}`;
}

/**
 * Founder-facing weekly range for subject/body.
 * Same month: `July 20–26, 2026`
 * Cross month: `July 27 – August 2, 2026`
 * Cross year: `December 29, 2025 – January 4, 2026`
 */
export function formatWeeklyFounderRangeLabel(
  start: string,
  end: string,
): string {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const startDate = new Date(Date.UTC(ys, ms - 1, ds, 16, 0, 0));
  const endDate = new Date(Date.UTC(ye, me - 1, de, 16, 0, 0));
  const monthDay = new Intl.DateTimeFormat("en-US", {
    timeZone: FOUNDER_CADENCE_TIMEZONE,
    month: "long",
    day: "numeric",
  });
  const full = new Intl.DateTimeFormat("en-US", {
    timeZone: FOUNDER_CADENCE_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  if (ys === ye && ms === me) {
    const month = new Intl.DateTimeFormat("en-US", {
      timeZone: FOUNDER_CADENCE_TIMEZONE,
      month: "long",
    }).format(startDate);
    return `${month} ${ds}–${de}, ${ye}`;
  }
  if (ys === ye) {
    return `${monthDay.format(startDate)} – ${monthDay.format(endDate)}, ${ye}`;
  }
  return `${full.format(startDate)} – ${full.format(endDate)}`;
}

/** Known analytics / instrumentation identifiers → plain business language. */
const ANALYTICS_EVENT_PLAIN: Array<[RegExp, string]> = [
  [/\bstudio_session_engaged\b/gi, "Studio engagement"],
  [/\bconsultation_cta_clicked\b/gi, "consultation request clicks"],
  [/\bdiamond_studio_view\b/gi, "Diamond Studio visits"],
  [/\bsession_engaged\b/gi, "session engagement"],
  [/\bshape_selected\b/gi, "shape selections"],
  [/\bconsultation_cta\b/gi, "consultation call-to-action"],
];

/**
 * Translate analytics implementation terms and snake_case event keys into
 * founder-facing business language. Does not invent metrics.
 */
export function toFounderFacingPlainLanguage(text: string): string {
  let out = text;
  for (const [re, plain] of ANALYTICS_EVENT_PLAIN) {
    out = out.replace(re, plain);
  }
  // Remaining snake_case identifiers that look like event/metric keys
  out = out.replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g, (match) => {
    if (/^(https?|www)$/i.test(match)) return match;
    return match
      .split("_")
      .filter(Boolean)
      .map((part, i) =>
        i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
      )
      .join(" ");
  });
  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * When a recommendation title is an internal id/slug, derive a short founder label.
 */
export function humanizeFounderTitle(title: string): string {
  const t = title.trim().replace(/^\[[^\]]+\]\s*/, "");
  if (!t) return t;
  const looksLikeId =
    /^[a-z0-9-]+:[a-z0-9:-]+$/i.test(t) ||
    /:(repository|journey|gbp|bi):/i.test(t);
  if (!looksLikeId) return t;
  const parts = t.split(":").filter(Boolean);
  // Drop executive + bucket prefixes when present
  const start =
    parts.length >= 3 &&
    /^(content|search-strategy|business-intelligence|opportunity|chief-of-staff)$/i.test(
      parts[0]!,
    )
      ? 2
      : 0;
  const phrase = parts
    .slice(start)
    .join(" ")
    .replace(/-/g, " ")
    .replace(/\bwhy we re here\b/gi, "Why We’re Here")
    .replace(/\bdiamond guide\b/gi, "Diamond Guide")
    .replace(/\bdiamond studio\b/gi, "Diamond Studio")
    .replace(/\bconcierge\b/gi, "Concierge")
    .replace(/\bgap\b/gi, "gap")
    .replace(/\s+/g, " ")
    .trim();
  if (!phrase) return t;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/** Strip operator/debug parentheticals from founder-facing action lines. */
export function cleanFounderFacingAction(text: string): string {
  return toFounderFacingPlainLanguage(
    replaceFounderFacingRoutes(
      text
        .replace(/\s*\(Agent OS[^)]*\)\.?/gi, "")
        .replace(/\s*Agent OS (will not|does not)[^.]*\.?/gi, "")
        .replace(/\s*[—–-]\s*read-only finding only\.?/gi, "")
        .replace(/\s*[—–-]\s*do not invent[^.]*\.?/gi, "")
        .replace(/\s*[—–-]\s*do not fabricate[^.]*\.?/gi, "")
        .replace(/\s*\(confidence\s*0?\.\d+\)\s*$/i, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
    ),
  );
}

/**
 * Sentence-aware shortening for founder-facing actions.
 * Never character-truncates with an ellipsis; prefers a complete sentence.
 */
export function summarizeFounderAction(
  text: string,
  maxLen = 280,
): string {
  const cleaned = cleanFounderFacingAction(text)
    .replace(/\s*\(confidence\s*0?\.\d+\)\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned) return cleaned;
  if (cleaned.length <= maxLen) {
    return cleaned;
  }
  const window = cleaned.slice(0, maxLen + 1);
  const sentenceEnds: number[] = [];
  for (let i = 0; i < window.length; i++) {
    if (
      (window[i] === "." || window[i] === "!" || window[i] === "?") &&
      (i === window.length - 1 || /\s/.test(window[i + 1]!))
    ) {
      sentenceEnds.push(i);
    }
  }
  const minSentence = Math.floor(maxLen * 0.4);
  const goodEnd = [...sentenceEnds].reverse().find((i) => i >= minSentence);
  if (goodEnd != null) {
    return cleaned.slice(0, goodEnd + 1).trim();
  }
  const space = cleaned.lastIndexOf(" ", maxLen);
  const cutAt = space >= Math.floor(maxLen * 0.5) ? space : maxLen;
  let cut = cleaned.slice(0, cutAt).replace(/[—–,;:\s]+$/g, "").trim();
  if (!/[.!?]$/.test(cut)) cut = `${cut}.`;
  return cut;
}

/** Compose a complete highest-ROI line from title + proposed action. */
export function composeHighestRoiAction(input: {
  title: string;
  proposedAction: string;
  intent: BriefCadenceIntent;
  plainLanguageExplanation?: string;
  expectedUpside?: string;
  whyItMattersNow?: string;
}): string {
  const title = cleanFounderFacingAction(
    humanizeFounderTitle(input.title.replace(/^\[[^\]]+\]\s*/, "")),
  ).trim();
  let action = cleanFounderFacingAction(input.proposedAction).trim();
  const explanation = input.plainLanguageExplanation
    ? cleanFounderFacingAction(input.plainLanguageExplanation).trim()
    : "";
  const upside = input.expectedUpside
    ? cleanFounderFacingAction(input.expectedUpside).trim()
    : "";
  const whyNow = input.whyItMattersNow
    ? cleanFounderFacingAction(input.whyItMattersNow).trim()
    : "";

  if (input.intent === "weekly") {
    // Decisive rewrite for handoff / propose / and-or style recommendations
    if (
      /propose|and\/or|link from\s+\//i.test(input.proposedAction) ||
      /link from /i.test(action)
    ) {
      action = makeDecisiveFounderRecommendation(
        `${action}${whyNow ? ` ${whyNow}` : ""}${explanation ? ` ${explanation}` : ""}`,
      );
      return summarizeFounderAction(action, 320);
    }

    if (explanation || whyNow || upside) {
      const lead =
        action && !/compare .+ rates/i.test(action)
          ? makeDecisiveFounderRecommendation(action)
          : title
            ? title
                .replace(/^Investigate\b/i, "Review")
                .replace(/\bvs\b/gi, "versus")
            : action;
      const context = explanation || whyNow;
      const benefit = upside
        ? /[.!?]$/.test(upside)
          ? upside
          : `${upside}.`
        : "";
      const parts = [lead, context, benefit].filter(Boolean);
      const unique: string[] = [];
      for (const p of parts) {
        const norm = p.toLowerCase().replace(/[.!?]+$/, "");
        if (
          unique.some((u) => u.toLowerCase().replace(/[.!?]+$/, "") === norm)
        ) {
          continue;
        }
        if (
          unique.some((u) => {
            const a = u.toLowerCase();
            const b = norm;
            return a.includes(b.slice(0, 40)) || b.includes(a.slice(0, 40));
          })
        ) {
          continue;
        }
        unique.push(/[.!?]$/.test(p) ? p : `${p}.`);
      }
      return summarizeFounderAction(
        makeDecisiveFounderRecommendation(unique.join(" ")),
        320,
      );
    }
  }

  const combined =
    action &&
    title &&
    !action.toLowerCase().includes(title.toLowerCase().slice(0, 24))
      ? `${title} — ${action}`
      : action || title;
  return summarizeFounderAction(
    input.intent === "weekly"
      ? makeDecisiveFounderRecommendation(combined)
      : combined,
    input.intent === "daily" ? 220 : 320,
  );
}

export function weeklyLowConfidenceHighestRoi(input: {
  briefEvidenceQuality?: string;
  hasCriticalSourceGaps?: boolean;
}): string {
  if (
    input.briefEvidenceQuality === "none-blocked" ||
    input.briefEvidenceQuality === "failed" ||
    input.hasCriticalSourceGaps
  ) {
    return "Measurement coverage is too incomplete to justify a high-confidence new initiative this week. Restore reliable website and search analytics before changing growth direction.";
  }
  return "Evidence this week is too thin to support a high-confidence new initiative. Finish the current publishing cadence and let enough performance data accumulate before changing direction.";
}

export function isGenuineFounderDecision(text: string): boolean {
  const t = text.trim();
  if (!t || /^none(\s+required)?/i.test(t)) return false;
  if (GENERIC_DECISION_FILLER_RE.test(t)) return false;
  if (/highest-roi action above/i.test(t)) return false;
  // Require an actual choice/approval shape
  return (
    /\b(approve|approval|authorize|choose|decide|decision|commit to|whether to (restore|fund|launch|hire|pause|ship|publish|invest|kill|continue))\b/i.test(
      t,
    ) && t.length >= 24
  );
}

export function filterGenuineFounderDecisions(decisions: string[]): string[] {
  return decisions.filter(isGenuineFounderDecision);
}

/**
 * Translate or omit blockers for founder-facing email.
 * Returns null when the blocker is internal engineering noise.
 */
export function toFounderFacingBlocker(text: string): string | null {
  const t = text.trim();
  if (!t || /^none$/i.test(t)) return null;
  if (/not yet operational/i.test(t)) return null;
  if (/operator follow-up:/i.test(t) && ENGINEERING_BLOCKER_RE.test(t)) {
    return null;
  }
  if (ENGINEERING_BLOCKER_RE.test(t)) {
    if (/\bga4\b|google analytics|website analytics/i.test(t)) {
      return "Website analytics are incomplete, so growth experiments should wait until measurement is trustworthy.";
    }
    if (/\bgsc\b|search console/i.test(t)) {
      return "Search performance data is incomplete, so SEO experiments should wait until reporting is trustworthy.";
    }
    return null;
  }
  return t;
}

export function filterFounderFacingBlockers(blocked: string[]): string[] {
  const out: string[] = [];
  for (const b of blocked) {
    const translated = toFounderFacingBlocker(b);
    if (translated) out.push(translated);
  }
  return out;
}

/** Drop priorities that merely restate the highest-ROI action. */
export function dedupePrioritiesAgainstHighestRoi(
  priorities: string[],
  highestRoiAction: string,
  max = 5,
): string[] {
  const highest = normalizeTokens(highestRoiAction);
  const highestTitle = highest.split(" ").slice(0, 8).join(" ");
  const out: string[] = [];
  for (const p of priorities) {
    const cleaned = toFounderFacingPriorityAction(
      p.replace(/^\[[^\]]+\]\s*/, ""),
    );
    const norm = normalizeTokens(cleaned);
    if (!norm) continue;
    if (norm === highest || highest.includes(norm) || norm.includes(highestTitle)) {
      continue;
    }
    if (
      out.some(
        (existing) =>
          actionJaccard(existing, cleaned) >= NEAR_DUPLICATE_ACTION_JACCARD,
      )
    ) {
      continue;
    }
    out.push(cleaned);
    if (out.length >= max) break;
  }
  return out;
}

export type DataConfidenceInput = {
  missingOrUnreliableData: string[];
  executiveNotes: string[];
  briefEvidenceQuality?: string;
  criticalFailure?: boolean;
  /** Weekly founder emails use business-effect language only. */
  intent?: BriefCadenceIntent;
};

type EvidenceDomain =
  | "website"
  | "search"
  | "client"
  | "social"
  | "local"
  | "other";

function classifyEvidenceDomain(gap: string): EvidenceDomain {
  const s = gap.toLowerCase();
  if (/hubspot|crm|client|pipeline|deal|contact/.test(s)) return "client";
  if (/buffer|social|instagram|facebook|linkedin/.test(s)) return "social";
  if (/gbp|google business|local listing|maps/.test(s)) return "local";
  if (/ga4|google analytics|website analytics|web analytics/.test(s)) {
    return "website";
  }
  if (/gsc|search console|search performance|organic search/.test(s)) {
    return "search";
  }
  if (/weekly intelligence|weekly/.test(s)) return "other";
  return "other";
}

/**
 * Founder-facing weekly confidence: business effect of missing evidence.
 * Never names connectors, adapters, APIs, or internal source identifiers.
 */
export function buildWeeklyDataConfidenceSummary(input: {
  missingOrUnreliableData: string[];
  briefEvidenceQuality?: string;
  criticalFailure?: boolean;
}): { level: "Full" | "Partial" | "Critical"; summary: string } {
  const gaps = input.missingOrUnreliableData.filter(Boolean);
  const critical =
    input.criticalFailure === true ||
    input.briefEvidenceQuality === "none-blocked" ||
    input.briefEvidenceQuality === "failed";
  const domains = new Set(gaps.map(classifyEvidenceDomain));
  const missingClient = domains.has("client");
  const missingSocial = domains.has("social");
  const missingLocal = domains.has("local");
  const missingWebsite = domains.has("website");
  const missingSearch = domains.has("search");
  const hasWebsiteOrSearchSignal = !missingWebsite || !missingSearch;

  if (critical) {
    return {
      level: "Critical",
      summary:
        "Core performance measurement is unavailable — treat this week’s recommendations as provisional until website and search analytics are trustworthy again.",
    };
  }

  if (gaps.length === 0) {
    return {
      level: "Full",
      summary: "Evidence coverage is sufficient for this week’s operating conclusions.",
    };
  }

  // Prefer the most accurate single business-effect sentence.
  if (
    hasWebsiteOrSearchSignal &&
    (missingClient || missingSocial || missingLocal) &&
    !missingWebsite &&
    !missingSearch
  ) {
    const missingBits = [
      missingClient ? "client" : null,
      missingSocial ? "social-performance" : null,
      missingLocal ? "local-presence" : null,
    ].filter((x): x is string => Boolean(x));
    const missingPhrase =
      missingBits.length === 1
        ? `${missingBits[0]} data was`
        : missingBits.length === 2
          ? `${missingBits[0]} and ${missingBits[1]} data were`
          : `${missingBits.slice(0, -1).join(", ")}, and ${missingBits[missingBits.length - 1]} data were`;
    return {
      level: "Partial",
      summary: `Recommendations are based primarily on website and search signals; ${missingPhrase} not available for this brief.`,
    };
  }

  if (missingWebsite || missingSearch) {
    return {
      level: "Partial",
      summary:
        "Performance conclusions remain directional until broader conversion data is available.",
    };
  }

  if (missingClient || missingSocial || missingLocal) {
    return {
      level: "Partial",
      summary:
        "Recommendations lean on website and search signals; broader client and channel evidence was limited this week.",
    };
  }

  return {
    level: "Partial",
    summary: "Partial.",
  };
}

/**
 * Compact data-confidence line for founder email.
 * Weekly: business-effect language only (no connector inventory).
 * Daily: compact labels; critical failures stay visible.
 * Technical source status remains on run.brief.missingOrUnreliableData.
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

  if (input.intent === "weekly") {
    const weekly = buildWeeklyDataConfidenceSummary({
      missingOrUnreliableData: gaps,
      briefEvidenceQuality: input.briefEvidenceQuality,
      criticalFailure: critical,
    });
    return {
      level: weekly.level,
      summary: weekly.summary,
      showDetails: false,
      detailLines: [],
    };
  }

  if (critical) {
    const short = gaps.map(shortenGapLabelDaily).filter(Boolean).slice(0, 3);
    return {
      level: "Critical",
      summary:
        short[0] ??
        "Critical measurement sources unavailable — treat recommendations as provisional.",
      showDetails: short.length > 1,
      detailLines: short.slice(1),
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
    .map(shortenGapLabelDaily)
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

/** Daily-only compact labels (not used for weekly founder confidence). */
function shortenGapLabelDaily(g: string): string {
  return shortenMeasurementGapLabel(g);
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

/** Executive summary for weekly: situation synthesis — not a copy of the ROI action. */
export function weeklyExecutiveSummary(input: {
  whyItMatters: string;
  whatChanged: string;
  highestRoiAction: string;
  weakEvidence?: boolean;
}): string {
  return synthesizeWeeklyExecutiveSummary({
    whyItMatters: input.whyItMatters,
    whatChanged: input.whatChanged,
    highestRoiAction: input.highestRoiAction,
    weakEvidence:
      input.weakEvidence ??
      /directional|incomplete|thin|limited verified|partial/i.test(
        `${input.whyItMatters} ${input.whatChanged}`,
      ),
  });
}

export {
  formatFounderFacingRoute,
  makeDecisiveFounderRecommendation,
  replaceFounderFacingRoutes,
  sanitizeFounderFacingNarrative,
  synthesizeWeeklyWhatChanged,
  toFounderFacingPriorityAction,
} from "./founder-language";
