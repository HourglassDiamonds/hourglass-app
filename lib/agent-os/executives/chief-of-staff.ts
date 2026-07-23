import type { BusinessIntelligenceOutput } from "./business-intelligence";
import type { SearchStrategyOutput } from "./search-strategy";
import { consolidateDuplicates } from "../recommendation";
import { rankRecommendations } from "../ranking";
import { scaffoldExecutives } from "../registry";
import type {
  AgendaBucket,
  BriefEvidenceQuality,
  EscalationItem,
  FounderBrief,
  Recommendation,
} from "../types";

export type ChiefOfStaffInput = {
  bi: BusinessIntelligenceOutput;
  search?: SearchStrategyOutput;
  reportingPeriod: { start: string; end: string };
  warnings: string[];
  mode?: "fixture" | "live";
  /** When true, Markdown is labeled degraded / partial — JSON still holds full ranked set. */
  briefEvidenceQuality?: BriefEvidenceQuality;
};

export type ChiefOfStaffOutput = {
  recommendations: Recommendation[];
  brief: FounderBrief;
  escalationItems: EscalationItem[];
  nonOperationalNote: string[];
  /** Count of individually named priorities in Markdown (excl. deferred summaries). */
  surfacedInBriefCount: number;
};

const REQUIRED_BRIEF_QUESTIONS = [
  "What changed?",
  "Why does it matter?",
  "What needs attention today?",
  "What is the single highest-ROI action?",
  "What can safely wait?",
  "What is blocked?",
  "What decision does the founder need to make?",
  "What data is missing or unreliable?",
] as const;

export { REQUIRED_BRIEF_QUESTIONS };

/** Highest-ROI (1) + this many additional named priorities in Markdown. */
export const MAX_ADDITIONAL_SURFACED_PRIORITIES = 4;

export function runChiefOfStaff(input: ChiefOfStaffInput): ChiefOfStaffOutput {
  const scaffolds = scaffoldExecutives();
  const nonOperationalNote = scaffolds.map(
    (e) => `${e.displayName} not yet operational`,
  );

  const searchRecs = input.search?.recommendations ?? [];
  const merged = [...input.bi.recommendations, ...searchRecs];
  let recommendations = consolidateDuplicates(merged);
  recommendations = rankRecommendations(
    recommendations.filter((r) => r.status !== "consolidated"),
  );

  const conflicts = findExecutiveConflicts(recommendations);
  for (const c of conflicts) {
    input.warnings.push(c);
  }

  recommendations = recommendations.map((r) => {
    if (
      r.agendaBucket === "ignore" ||
      (r.rankingFactors.expectedBusinessImpact < 4 &&
        r.effortEstimate === "high")
    ) {
      return {
        ...r,
        agendaBucket: "ignore" as AgendaBucket,
        status: r.status === "blocked" ? r.status : "ignore",
      };
    }
    return r;
  });

  const active = recommendations.filter(
    (r) =>
      r.status !== "blocked" &&
      r.status !== "ignore" &&
      r.status !== "consolidated",
  );
  const blocked = recommendations.filter((r) => r.status === "blocked");

  const highest = active[0];
  const additionalSurfaced = pickAdditionalSurfaced(
    active.slice(1),
    MAX_ADDITIONAL_SURFACED_PRIORITIES,
  );
  const surfacedIds = new Set(
    [highest, ...additionalSurfaced]
      .filter(Boolean)
      .map((r) => r!.recommendationId),
  );

  const founderDecisions = active
    .filter((r) => r.approvalRequired && surfacedIds.has(r.recommendationId))
    .map((r) => r.title);

  const escalationItems: EscalationItem[] = [];
  const allGaps = [
    ...input.bi.dataGaps,
    ...(input.search?.dataGaps ?? []),
  ];
  for (const gap of allGaps.slice(0, 8)) {
    escalationItems.push({
      id: `esc-${gap.id}`,
      executiveId: gap.id.includes("search")
        ? "search-strategy"
        : "chief-of-staff",
      title: gap.description,
      reason: gap.impactOnRecommendations,
      requiresFounderDecision:
        gap.sourceId === "ga4" || gap.id.includes("tracking"),
    });
  }
  if (input.bi.incompleteAttribution) {
    escalationItems.push({
      id: "esc-incomplete-attribution",
      executiveId: "business-intelligence",
      title: "Incomplete attribution",
      reason:
        "Social/channel attribution is incomplete — do not treat GA4 social labels as content ROI proof",
      requiresFounderDecision: false,
    });
  }

  const searchChangeBits = (input.search?.opportunities ?? [])
    .slice(0, 2)
    .map((o) => o.title);
  const whatChanged =
    [
      ...input.bi.keyMetricChanges.slice(0, 3),
      ...searchChangeBits,
    ].join("; ") ||
    "Insufficient metric coverage to summarize changes.";

  const whyItMatters = highest
    ? `${highest.whyItMattersNow} (top ranked: ${highest.title})`
    : "No high-confidence action is ready; measurement gaps dominate.";

  const needsAttentionToday = [
    ...additionalSurfaced.map((r) => r.title),
    ...input.bi.anomalies
      .filter((a) => a.severity === "critical" || a.severity === "high")
      .map((a) => a.title),
  ].slice(0, MAX_ADDITIONAL_SURFACED_PRIORITIES);

  if (needsAttentionToday.length === 0 && allGaps.length && !highest) {
    needsAttentionToday.push(
      "Close critical measurement gaps before prioritizing growth experiments",
    );
  }

  const deferred = active.filter((r) => !surfacedIds.has(r.recommendationId));
  const scheduleCount = deferred.filter(
    (r) => r.agendaBucket === "schedule-next",
  ).length;
  const monitorCount = deferred.filter(
    (r) => r.agendaBucket === "monitor",
  ).length;
  const ignoreCount = recommendations.filter(
    (r) =>
      r.agendaBucket === "ignore" &&
      r.status !== "blocked" &&
      r.status !== "consolidated",
  ).length;

  const canSafelyWait: string[] = [];
  const deferredTotal = scheduleCount + monitorCount;
  if (deferredTotal > 0) {
    canSafelyWait.push(
      `${deferredTotal} lower-ranked findings deferred (${scheduleCount} schedule-next, ${monitorCount} monitor) — full ranked set retained in JSON`,
    );
  }
  if (ignoreCount > 0) {
    canSafelyWait.push(
      `${ignoreCount} low-priority items marked ignore — not expanded here`,
    );
  }
  if (canSafelyWait.length === 0) {
    canSafelyWait.push("None");
  }

  const blockedList = [
    ...blocked.slice(0, 3).map(
      (r) =>
        `${r.title}${r.blockedReasons?.length ? ` — ${r.blockedReasons[0]}` : ""}`,
    ),
    ...nonOperationalNote,
  ].slice(0, 6);

  const missingOrUnreliableData = allGaps.map(
    (g) => `${g.description}: ${g.impactOnRecommendations}`,
  );

  if (input.bi.incompleteAttribution) {
    missingOrUnreliableData.unshift(
      "Incomplete attribution: social/content ROI cannot be verified without a Buffer (or equivalent) adapter",
    );
  }

  const founderDecisionNeeded =
    founderDecisions.length > 0
      ? founderDecisions
      : highest
        ? [
            "Whether to spend founder time on the highest-ROI action above before starting new creative or SEO experiments",
          ]
        : criticalGapsNeedDecision(input.bi, input.search)
          ? [
              "Whether to prioritize restoring read-only measurement (GA4 / Search Console / weekly intelligence) before asking Agent OS for growth recommendations",
            ]
          : ["None required this cycle"];

  const surfacedPriorityTitles = [
    ...(highest ? [highest.title] : []),
    ...additionalSurfaced.map((r) => r.title),
  ];

  const brief = buildFounderBrief({
    mode: input.mode ?? "fixture",
    briefEvidenceQuality: input.briefEvidenceQuality ?? "full",
    whatChanged,
    whyItMatters,
    needsAttentionToday:
      needsAttentionToday.length > 0
        ? needsAttentionToday
        : highest
          ? ["See highest-ROI action below"]
          : ["None"],
    highestRoiAction: highest
      ? `${highest.title} — ${highest.proposedAction} (confidence ${highest.confidence})`
      : "None — resolve data gaps first",
    canSafelyWait,
    blocked: blockedList,
    founderDecisionNeeded,
    missingOrUnreliableData,
    period: input.reportingPeriod,
    facts: [
      ...input.bi.facts.slice(0, 5),
      ...(input.search?.facts ?? []).slice(0, 4),
    ],
    inferences: [
      ...input.bi.inferences.slice(0, 3),
      ...(input.search?.inferences ?? []).slice(0, 3),
    ],
    surfacedPriorityTitles,
    rankedRecommendationCount: active.length,
    opportunitiesDetected: input.search?.opportunities.length ?? 0,
  });

  return {
    recommendations,
    brief,
    escalationItems,
    nonOperationalNote,
    surfacedInBriefCount: surfacedPriorityTitles.length,
  };
}

/**
 * Prefer do-now / high urgency for additional Markdown priorities.
 * High-severity items are not dropped in favor of low-urgency noise.
 */
function pickAdditionalSurfaced(
  rest: Recommendation[],
  limit: number,
): Recommendation[] {
  const priority = [...rest].sort((a, b) => {
    const score = (r: Recommendation) =>
      (r.agendaBucket === "do-now" ? 100 : 0) +
      (r.urgency === "critical" ? 50 : r.urgency === "high" ? 30 : 0) +
      r.priorityScore;
    return score(b) - score(a);
  });
  return priority.slice(0, limit);
}

function findExecutiveConflicts(recs: Recommendation[]): string[] {
  const active = recs.filter(
    (r) =>
      r.status === "proposed" ||
      r.status === "downgraded" ||
      r.status === "monitor",
  );
  const bi = active.filter((r) => r.originatingExecutive === "business-intelligence");
  const ss = active.filter((r) => r.originatingExecutive === "search-strategy");
  if (!bi.length || !ss.length) return [];
  const conflicts: string[] = [];
  for (const s of ss.slice(0, 3)) {
    const overlap = bi.find((b) =>
      normalizeLoose(b.title).includes(normalizeLoose(s.title).slice(0, 18)),
    );
    if (overlap) {
      conflicts.push(
        `Conflict note: Search Strategy “${s.title}” overlaps BI “${overlap.title}” — ranked by shared priority model`,
      );
    }
  }
  return conflicts;
}

function normalizeLoose(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function criticalGapsNeedDecision(
  bi: BusinessIntelligenceOutput,
  search?: SearchStrategyOutput,
): boolean {
  const gaps = [...bi.dataGaps, ...(search?.dataGaps ?? [])];
  return gaps.some(
    (g) =>
      g.sourceId === "ga4" ||
      g.sourceId === "gsc" ||
      g.sourceId === "weekly-intelligence" ||
      g.id.includes("live-load"),
  );
}

function buildFounderBrief(input: {
  mode: "fixture" | "live";
  briefEvidenceQuality: BriefEvidenceQuality;
  whatChanged: string;
  whyItMatters: string;
  needsAttentionToday: string[];
  highestRoiAction: string;
  canSafelyWait: string[];
  blocked: string[];
  founderDecisionNeeded: string[];
  missingOrUnreliableData: string[];
  period: { start: string; end: string };
  facts: string[];
  inferences: string[];
  surfacedPriorityTitles: string[];
  rankedRecommendationCount: number;
  opportunitiesDetected: number;
}): FounderBrief {
  const bullets = (items: string[]) =>
    items.length ? items.map((i) => `- ${i}`).join("\n") : "- None";

  let modeLabel =
    input.mode === "fixture"
      ? "Fixture sample (not live production evidence)"
      : "Live read-only";
  if (input.briefEvidenceQuality === "partial-degraded") {
    modeLabel +=
      " — DEGRADED / PARTIAL: usable findings present; critical analytics sources unavailable (not all-clear)";
  } else if (input.briefEvidenceQuality === "none-blocked") {
    modeLabel +=
      " — BLOCKED: critical sources unavailable; do not treat as a quiet healthy week";
  } else if (input.briefEvidenceQuality === "failed") {
    modeLabel += " — FAILED: brief may be incomplete";
  }

  const markdown = `# Hourglass Founder Brief

Mode: ${modeLabel}
Reporting period: ${input.period.start} → ${input.period.end}
Surfacing: ${input.surfacedPriorityTitles.length} named priorities (${input.opportunitiesDetected} opportunities detected · ${input.rankedRecommendationCount} ranked active) — full set in JSON

## 1. What changed?
${input.whatChanged}

## 2. Why does it matter?
${input.whyItMatters}

## 3. What needs attention today?
${bullets(input.needsAttentionToday)}

## 4. What is the single highest-ROI action?
${input.highestRoiAction}

## 5. What can safely wait?
${bullets(input.canSafelyWait)}

## 6. What is blocked?
${bullets(input.blocked)}

## 7. What decision does the founder need to make?
${bullets(input.founderDecisionNeeded)}

## 8. What data is missing or unreliable?
${bullets(input.missingOrUnreliableData.slice(0, 8))}

### Known facts
${bullets(input.facts.slice(0, 6))}

### Inferences (not facts)
${bullets(input.inferences.slice(0, 4))}

---
Agent OS V1 — read-only. No external writes. Revenue is never inferred from traffic alone.
`.trim();

  return {
    whatChanged: input.whatChanged,
    whyItMatters: input.whyItMatters,
    needsAttentionToday: input.needsAttentionToday,
    highestRoiAction: input.highestRoiAction,
    canSafelyWait: input.canSafelyWait,
    blocked: input.blocked,
    founderDecisionNeeded: input.founderDecisionNeeded,
    missingOrUnreliableData: input.missingOrUnreliableData,
    markdown,
    surfacedPriorityTitles: input.surfacedPriorityTitles,
  };
}
