import type { BusinessIntelligenceOutput } from "./business-intelligence";
import type { ContentExecutiveOutput } from "./content";
import type { OpportunityExecutiveOutput } from "./opportunity";
import type { SearchStrategyOutput } from "./search-strategy";
import {
  applyJourneyFounderRankingGate,
  consolidateJourneyDuplicates,
  sequenceJourneyMeasurementPrerequisites,
} from "../bi/journey";
import {
  cleanFounderFacingAction,
  formatFounderLocalDateLabel,
  formatWeeklyRangeLabel,
  selectFounderPriorities,
  type BriefCadenceIntent,
} from "../brief-quality";
import { consolidateDuplicates } from "../recommendation";
import { rankRecommendations } from "../ranking";
import { opportunityRecommendationIsSurfaceEligible } from "../opportunity/qualify";
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
  content?: ContentExecutiveOutput;
  opportunity?: OpportunityExecutiveOutput;
  reportingPeriod: { start: string; end: string };
  warnings: string[];
  mode?: "fixture" | "live";
  /** When true, Markdown is labeled degraded / partial — JSON still holds full ranked set. */
  briefEvidenceQuality?: BriefEvidenceQuality;
  /**
   * When set, founder brief surfacing is restricted to these recommendation IDs
   * (recurrence eligibility already applied). Full ranked JSON is unchanged.
   * Order is priority preference for brief slots.
   */
  founderSurfaceEligibleIds?: string[] | null;
  /**
   * Cadence intent for synthesis framing + priority selection.
   * Daily: today’s operating brief. Weekly: deeper performance review.
   * Same orchestration path — not a parallel agent system.
   */
  briefCadenceIntent?: BriefCadenceIntent;
  /** America/New_York YYYY-MM-DD for daily period framing. */
  briefLocalDate?: string;
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
  const contentRecs = input.content?.recommendations ?? [];
  const opportunityRecs = input.opportunity?.recommendations ?? [];
  const merged = [
    ...input.bi.recommendations,
    ...searchRecs,
    ...contentRecs,
    ...opportunityRecs,
  ];
  let recommendations = consolidateDuplicates(merged);
  recommendations = consolidateJourneyDuplicates(recommendations);
  recommendations = applyJourneyFounderRankingGate(recommendations);
  recommendations = sequenceJourneyMeasurementPrerequisites(recommendations);
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

  // Opportunity must not take a named brief slot unless surface-eligible
  let surfacePool = active.filter((r) => {
    if (r.originatingExecutive !== "opportunity") return true;
    return opportunityRecommendationIsSurfaceEligible(
      r.plainLanguageExplanation,
      r.title,
      r.priorityScore,
    );
  });

  // Recurrence eligibility BEFORE founder brief ranking/surfacing.
  // When a gate is provided, only eligible IDs compete for ≤5 brief slots.
  if (input.founderSurfaceEligibleIds) {
    const allow = new Set(input.founderSurfaceEligibleIds);
    const byId = new Map(surfacePool.map((r) => [r.recommendationId, r]));
    surfacePool = input.founderSurfaceEligibleIds
      .map((id) => byId.get(id))
      .filter((r): r is Recommendation => Boolean(r));
    // Keep any eligible that were in pool but missing from ordered list (safety)
    for (const r of active) {
      if (allow.has(r.recommendationId) && !surfacePool.some((x) => x.recommendationId === r.recommendationId)) {
        if (
          r.originatingExecutive !== "opportunity" ||
          opportunityRecommendationIsSurfaceEligible(
            r.plainLanguageExplanation,
            r.title,
            r.priorityScore,
          )
        ) {
          surfacePool.push(r);
        }
      }
    }
  }

  const intent: BriefCadenceIntent = input.briefCadenceIntent ?? "weekly";
  const poolForSelection =
    surfacePool.length > 0
      ? surfacePool
      : input.founderSurfaceEligibleIds
        ? []
        : active.filter((r) => r.originatingExecutive !== "opportunity");

  // Preserve ranked highest-ROI order; cluster/limitation rules only demote slots
  // (see brief-quality.ts). Soft diversity is a fill tie-breaker, not a quota.
  const selected = selectFounderPriorities(poolForSelection, {
    max: MAX_ADDITIONAL_SURFACED_PRIORITIES + 1,
  });
  const highest = selected.highest;
  const additionalSurfaced = selected.additional;
  const surfacedIds = new Set(
    [highest, ...additionalSurfaced]
      .filter(Boolean)
      .map((r) => r!.recommendationId),
  );

  // Diverted internal limitations → blockers / data notes, not named priorities
  const divertedAsBlockers = selected.divertedInternalLimitations
    .slice(0, 2)
    .map(
      (r) =>
        `Operator follow-up: ${r.title.replace(/^\[Content\]\s*/i, "").replace(/^Source material incomplete/i, "Complete source material")}`,
    );

  const founderDecisions = active
    .filter((r) => r.approvalRequired && surfacedIds.has(r.recommendationId))
    .map((r) => r.title);

  const escalationItems: EscalationItem[] = [];
  const allGaps = [
    ...input.bi.dataGaps,
    ...(input.search?.dataGaps ?? []),
    ...(input.content?.dataGaps ?? []),
    ...(input.opportunity?.dataGaps ?? []),
  ];
  for (const gap of allGaps.slice(0, 8)) {
    escalationItems.push({
      id: `esc-${gap.id}`,
      executiveId: gap.id.includes("opportunity")
        ? "opportunity"
        : gap.id.includes("content")
          ? "content"
          : gap.id.includes("search")
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
    .slice(0, 1)
    .map((o) => o.title);
  const contentChangeBits = (input.content?.opportunities ?? [])
    .slice(0, 1)
    .map((o) => o.title);
  const opportunityChangeBits = (input.opportunity?.opportunities ?? [])
    .filter(
      (o) =>
        o.readiness === "ready-to-evaluate" ||
        o.readiness === "ready-for-founder-decision",
    )
    .slice(0, 1)
    .map((o) => o.title);
  const changeBits =
    intent === "daily"
      ? [
          ...input.bi.keyMetricChanges.slice(0, 1),
          ...input.bi.anomalies
            .filter((a) => a.severity === "critical" || a.severity === "high")
            .slice(0, 1)
            .map((a) => a.title),
          ...searchChangeBits.slice(0, 1),
          ...contentChangeBits.slice(0, 1),
        ]
      : [
          ...input.bi.keyMetricChanges.slice(0, 2),
          ...searchChangeBits,
          ...contentChangeBits,
          ...opportunityChangeBits,
        ];
  const whatChanged =
    changeBits.filter(Boolean).join("; ") ||
    (intent === "daily"
      ? "No material day-over-day signal in available sources."
      : "Insufficient metric coverage to summarize changes.");

  const whyItMatters = highest
    ? highest.whyItMattersNow
    : intent === "daily"
      ? "No high-confidence founder move is ready today; watch measurement gaps quietly."
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

  const canSafelyWait: string[] = [];
  const deferredTotal = scheduleCount + monitorCount;
  const oppDeferred = (input.opportunity?.opportunities ?? []).filter(
    (o) =>
      o.readiness === "research-required" ||
      o.readiness === "measurement-blocked" ||
      o.readiness === "already-covered" ||
      o.readiness === "rejected" ||
      o.rejected,
  );
  const parts: string[] = [];
  if (deferredTotal > 0) {
    parts.push(`${deferredTotal} lower-ranked deferred (full set in JSON)`);
  }
  if (oppDeferred.length > 0) {
    parts.push(
      `Opportunity: ${oppDeferred.filter((o) => o.readiness === "research-required").length} research, ${oppDeferred.filter((o) => o.readiness === "measurement-blocked").length} measurement-blocked, ${oppDeferred.filter((o) => o.readiness === "already-covered").length} covered, ${oppDeferred.filter((o) => o.readiness === "rejected" || o.rejected).length} rejected`,
    );
  }
  if (parts.length > 0) {
    canSafelyWait.push(parts.join(" · "));
  } else {
    canSafelyWait.push("None");
  }

  const blockedList = [
    ...divertedAsBlockers,
    ...blocked.slice(0, 2).map(
      (r) =>
        `${r.title}${r.blockedReasons?.length ? ` — ${r.blockedReasons[0]}` : ""}`,
    ),
    // Daily briefs omit scaffold "not yet operational" noise from the founder list
    ...(intent === "daily" ? [] : nonOperationalNote),
  ].slice(0, 4);

  // Deduplicate gap descriptions for brief length
  const seenGap = new Set<string>();
  const missingOrUnreliableData: string[] = [];
  if (input.bi.incompleteAttribution) {
    missingOrUnreliableData.push(
      "Incomplete social attribution without Buffer adapter",
    );
  }
  for (const g of allGaps) {
    const key = g.sourceId;
    if (seenGap.has(key)) continue;
    seenGap.add(key);
    missingOrUnreliableData.push(`${g.description}`);
    if (missingOrUnreliableData.length >= 5) break;
  }

  const founderDecisionNeeded =
    founderDecisions.length > 0
      ? founderDecisions.slice(0, 3)
      : highest
        ? [
            "Whether to spend founder time on the highest-ROI action above before new experiments",
          ]
        : criticalGapsNeedDecision(
              input.bi,
              input.search,
              input.content,
              input.opportunity,
            )
          ? [
              "Whether to restore read-only measurement (GA4 / GSC / weekly) before growth recommendations",
            ]
          : ["None required this cycle"];

  const surfacedPriorityTitles = [
    ...(highest ? [highest.title] : []),
    ...additionalSurfaced.map((r) => r.title),
  ];

  const opportunitiesDetected =
    (input.search?.opportunities.length ?? 0) +
    (input.content?.opportunities.length ?? 0) +
    (input.opportunity?.volumeFunnel.qualifiedFindings ??
      input.opportunity?.opportunities.filter(
        (o) => !o.rejected && o.readiness !== "rejected",
      ).length ??
      0);

  const highestRoiAction = highest
    ? intent === "daily"
      ? `${highest.title} — ${truncateAction(cleanFounderFacingAction(highest.proposedAction))}`
      : `${highest.title} — ${truncateAction(highest.proposedAction)} (confidence ${highest.confidence})`
    : intent === "daily"
      ? "None required today"
      : "None — resolve data gaps first";

  const periodLabel =
    intent === "daily" && input.briefLocalDate
      ? `Morning Brief · ${formatFounderLocalDateLabel(input.briefLocalDate)}`
      : formatWeeklyRangeLabel(
          input.reportingPeriod.start,
          input.reportingPeriod.end,
        );

  const brief = buildFounderBrief({
    mode: input.mode ?? "fixture",
    briefEvidenceQuality: input.briefEvidenceQuality ?? "full",
    briefCadenceIntent: intent,
    whatChanged,
    whyItMatters,
    needsAttentionToday:
      needsAttentionToday.length > 0
        ? needsAttentionToday
        : highest
          ? ["See highest-ROI action below"]
          : ["None"],
    highestRoiAction,
    canSafelyWait,
    blocked: blockedList.length ? blockedList : ["None"],
    founderDecisionNeeded,
    missingOrUnreliableData,
    periodLabel,
    facts: [
      ...input.bi.facts.slice(0, 2),
      ...(input.search?.facts ?? []).slice(0, 1),
      ...(input.content?.facts ?? []).slice(0, 1),
      ...(input.opportunity?.facts ?? []).slice(0, 1),
    ],
    inferences: [
      ...input.bi.inferences.slice(0, 1),
      ...(input.opportunity?.inferences ?? []).slice(0, 1),
    ],
    surfacedPriorityTitles,
    rankedRecommendationCount: active.length,
    opportunitiesDetected,
  });

  return {
    recommendations,
    brief,
    escalationItems,
    nonOperationalNote,
    surfacedInBriefCount: surfacedPriorityTitles.length,
  };
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
  const content = active.filter((r) => r.originatingExecutive === "content");
  const opportunity = active.filter(
    (r) => r.originatingExecutive === "opportunity",
  );
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

  for (const c of content.slice(0, 4)) {
    const searchOverlap = ss.find((s) =>
      ownershipOverlap(c.title, s.title),
    );
    if (searchOverlap) {
      conflicts.push(
        `Ownership note: Content “${c.title}” relates to Search “${searchOverlap.title}” — Search keeps technical SEO; Content keeps communication/production`,
      );
    }
    const biOverlap = bi.find((b) => ownershipOverlap(c.title, b.title));
    if (biOverlap) {
      conflicts.push(
        `Ownership note: Content “${c.title}” relates to BI “${biOverlap.title}” — BI keeps measurement; Content keeps messaging`,
      );
    }
  }

  for (const o of opportunity.slice(0, 4)) {
    const searchOverlap = ss.find((s) => ownershipOverlap(o.title, s.title));
    if (searchOverlap) {
      conflicts.push(
        `Ownership note: Opportunity “${o.title}” relates to Search “${searchOverlap.title}” — Search keeps technical SEO; Opportunity keeps distribution/partner leverage only when distinct`,
      );
    }
    const contentOverlap = content.find((c) =>
      ownershipOverlap(o.title, c.title),
    );
    if (contentOverlap) {
      conflicts.push(
        `Ownership note: Opportunity “${o.title}” relates to Content “${contentOverlap.title}” — Content keeps production; Opportunity keeps distribution/partner research when distinct`,
      );
    }
    const biOverlap = bi.find((b) => ownershipOverlap(o.title, b.title));
    if (biOverlap) {
      conflicts.push(
        `Ownership note: Opportunity “${o.title}” relates to BI “${biOverlap.title}” — BI keeps measurement; Opportunity keeps conversion-leverage experiments when distinct`,
      );
    }
  }

  return conflicts;
}

function ownershipOverlap(a: string, b: string): boolean {
  const na = normalizeLoose(a);
  const nb = normalizeLoose(b);
  if (na.includes(nb.slice(0, 16)) || nb.includes(na.slice(0, 16))) return true;
  const tokens = na.split(" ").filter((t) => t.length > 4);
  let hits = 0;
  for (const t of tokens.slice(0, 6)) {
    if (nb.includes(t)) hits += 1;
  }
  return hits >= 2;
}

function normalizeLoose(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function truncateAction(s: string): string {
  return s.length <= 140 ? s : `${s.slice(0, 137)}…`;
}

function criticalGapsNeedDecision(
  bi: BusinessIntelligenceOutput,
  search?: SearchStrategyOutput,
  content?: ContentExecutiveOutput,
  opportunity?: OpportunityExecutiveOutput,
): boolean {
  const gaps = [
    ...bi.dataGaps,
    ...(search?.dataGaps ?? []),
    ...(content?.dataGaps ?? []),
    ...(opportunity?.dataGaps ?? []),
  ];
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
  briefCadenceIntent: BriefCadenceIntent;
  whatChanged: string;
  whyItMatters: string;
  needsAttentionToday: string[];
  highestRoiAction: string;
  canSafelyWait: string[];
  blocked: string[];
  founderDecisionNeeded: string[];
  missingOrUnreliableData: string[];
  periodLabel: string;
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
      ? "Fixture sample (not live evidence)"
      : "Live read-only";
  if (input.briefEvidenceQuality === "partial-degraded") {
    modeLabel += " — DEGRADED / PARTIAL (critical sources down; not all-clear)";
  } else if (input.briefEvidenceQuality === "none-blocked") {
    modeLabel += " — BLOCKED (critical sources unavailable)";
  } else if (input.briefEvidenceQuality === "failed") {
    modeLabel += " — FAILED";
  }

  const heading =
    input.briefCadenceIntent === "daily"
      ? "# Hourglass Morning Brief"
      : "# Hourglass Founder Brief";
  const intentLine =
    input.briefCadenceIntent === "daily"
      ? "Intent: Today’s priorities, decisions, blockers, and highest-ROI move"
      : "Intent: Weekly performance review, trends, and cross-functional synthesis";

  const dataSection =
    input.briefCadenceIntent === "daily"
      ? `## 8. Data confidence
${bullets(
  input.missingOrUnreliableData.length
    ? [
        input.missingOrUnreliableData.slice(0, 3).join("; "),
      ]
    : ["Sources available for this cycle"],
)}`
      : `## 8. What data is missing or unreliable?
${bullets(input.missingOrUnreliableData.slice(0, 5))}`;

  const markdown = `${heading}

Mode: ${modeLabel}
${intentLine}
Period: ${input.periodLabel}
Surfacing: ${input.surfacedPriorityTitles.length} named priorities (${input.opportunitiesDetected} detected · ${input.rankedRecommendationCount} ranked) — full set in JSON

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

${dataSection}

### Known facts
${bullets(input.facts.slice(0, 4))}

### Inferences (not facts)
${bullets(input.inferences.slice(0, 2))}

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
