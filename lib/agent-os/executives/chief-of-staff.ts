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
  applyClientAttentionFounderRankingGate,
  isClientAttentionRecommendationId,
  MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES,
} from "../bi/client-attention";
import {
  cleanFounderFacingAction,
  composeHighestRoiAction,
  filterFounderFacingBlockers,
  filterGenuineFounderDecisions,
  formatFounderDecisionLine,
  formatFounderLocalDateLabel,
  formatWeeklyRangeLabel,
  isByDesignHealthySearchLimitation,
  isGenuineMeasurementSourceFailure,
  isVagueMetricWithoutMagnitude,
  isWeakAnalyticalObservation,
  MAX_DAILY_NAMED_PRIORITIES,
  selectFounderPriorities,
  sanitizeFounderFacingNarrative,
  shouldSuppressAnalyticsMaintenanceHighestRoi,
  toFounderFacingPriorityAction,
  weeklyLowConfidenceHighestRoi,
  summarizeFounderAction,
  type BriefCadenceIntent,
} from "../brief-quality";
import { consolidateDuplicates } from "../recommendation";
import { rankRecommendations } from "../ranking";
import { opportunityRecommendationIsSurfaceEligible } from "../opportunity/qualify";
import { scaffoldExecutives } from "../registry";
import { isCaseStudyProductionFounderNow } from "../content/authority";
import type { AuthoritySnapshot } from "../content/authority";
import type {
  AgendaBucket,
  BriefEvidenceQuality,
  EscalationItem,
  FounderBrief,
  Recommendation,
  SourceHealth,
} from "../types";
import type { OperatingBacklog } from "../operating-backlog/types";
import {
  backlogOrientationSummary,
  decisionRecommendationsFromBacklog,
  recommendationsFromOperatingBacklog,
  watchLinesFromOperatingBacklog,
} from "../operating-backlog";
import { isFounderNowItem } from "../operating-backlog/surface-policy";
import {
  injectConciergeSlaOverdueIntoSurfacePool,
  isConciergeSlaOverdueRecommendationId,
} from "@/lib/concierge/sla/cos-escalation";
import { CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID } from "@/lib/concierge/sla/types";
import {
  injectWebsiteQaCriticalIntoSurfacePool,
  isWebsiteQaExceptionRecommendationId,
} from "../bi/website-qa/cos-escalation";
import { WEBSITE_QA_ROOT_EXCEPTION_ID } from "../bi/website-qa/types";
import {
  injectAttributionIntegrityIntoSurfacePool,
  isAttributionIntegrityRecommendationId,
} from "../bi/attribution/cos-escalation";
import { ATTRIBUTION_COVERAGE_INTEGRITY_ID } from "../bi/attribution/types";

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
   * Active (non-terminal) operating-backlog IDs remain eligible for daily briefs.
   * Terminal backlog items must not be force-included.
   */
  founderSurfaceEligibleIds?: string[] | null;
  /**
   * Cadence intent for synthesis framing + priority selection.
   * Daily: today’s operating brief. Weekly: deeper performance review.
   * Same orchestration path — not a parallel agent system.
   * Callers should pass this explicitly; default remains weekly for legacy callers.
   */
  briefCadenceIntent?: BriefCadenceIntent;
  /** America/New_York YYYY-MM-DD for daily period framing. */
  briefLocalDate?: string;
  /** Adapter source health — used to suppress analytics-maintenance highest-ROI. */
  sourceHealth?: SourceHealth[];
  /**
   * Persistent master sprint / unfinished actions / open decisions.
   * Authoritative for daily briefs; fresh evidence enriches but does not erase.
   */
  operatingBacklog?: OperatingBacklog | null;
  /**
   * Carry-forward unresolved recommendation IDs from persistence when
   * recurrence cooldown would otherwise empty the daily brief.
   */
  carryForwardRecommendationIds?: string[] | null;
  /**
   * Live overdue Concierge SLA count (P0-5). Operational state — not a
   * persisted recommendation lifecycle item. Outranks ordinary sprint work and
   * cannot be suppressed by P0-3 terminal completion records.
   */
  conciergeSlaOverdueCount?: number;
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

  // Source hierarchy (daily): A founder-now backlog → B calendar (none yet)
  // → C inbox (client attention) → D project/deploy → E analytics → F social
  // → G opportunity. Watch/background backlog never occupies hierarchy A.
  // Missing lower sources must never erase higher persistent context.
  const backlogRecs = input.operatingBacklog
    ? recommendationsFromOperatingBacklog(input.operatingBacklog, {
        collectedAt: `${input.reportingPeriod.end}T12:00:00.000Z`,
      })
    : [];
  const backlogDecisionRecs = input.operatingBacklog
    ? decisionRecommendationsFromBacklog(input.operatingBacklog, {
        collectedAt: `${input.reportingPeriod.end}T12:00:00.000Z`,
      })
    : [];
  const backlogOrientation = input.operatingBacklog
    ? backlogOrientationSummary(input.operatingBacklog)
    : null;

  const searchRecs = input.search?.recommendations ?? [];
  const contentRecs = input.content?.recommendations ?? [];
  const opportunityRecs = input.opportunity?.recommendations ?? [];
  const merged = [
    ...backlogRecs,
    ...backlogDecisionRecs,
    ...input.bi.recommendations,
    ...searchRecs,
    ...contentRecs,
    ...opportunityRecs,
  ];
  let recommendations = consolidateDuplicates(merged);
  recommendations = consolidateJourneyDuplicates(recommendations);
  recommendations = applyJourneyFounderRankingGate(recommendations);
  recommendations = sequenceJourneyMeasurementPrerequisites(recommendations);
  recommendations = applyClientAttentionFounderRankingGate(recommendations);
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
  // Founder-now operating-backlog items remain eligible (hierarchy A).
  // Watch/background backlog IDs are not force-included.
  // Terminal backlog items are already excluded from backlogRecs via hydration.
  const backlogIds = new Set(backlogRecs.map((r) => r.recommendationId));
  const carryIds = new Set(input.carryForwardRecommendationIds ?? []);
  if (input.founderSurfaceEligibleIds) {
    const allow = new Set([
      ...input.founderSurfaceEligibleIds,
      ...backlogIds,
      ...carryIds,
      // Live Concierge SLA / critical production-health exceptions are
      // never gated by recommendation lifecycle.
      CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID,
      WEBSITE_QA_ROOT_EXCEPTION_ID,
      ATTRIBUTION_COVERAGE_INTEGRITY_ID,
    ]);
    const byId = new Map(surfacePool.map((r) => [r.recommendationId, r]));
    // Hierarchy order: backlog first, then carry-forward, then recurrence-eligible.
    const orderedIds = [
      ...backlogRecs.map((r) => r.recommendationId),
      ...(input.carryForwardRecommendationIds ?? []).filter(
        (id) => !backlogIds.has(id),
      ),
      ...input.founderSurfaceEligibleIds.filter(
        (id) => !backlogIds.has(id) && !carryIds.has(id),
      ),
    ];
    surfacePool = orderedIds
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
          ) ||
          isConciergeSlaOverdueRecommendationId(r.recommendationId) ||
          isWebsiteQaExceptionRecommendationId(r.recommendationId) ||
          isAttributionIntegrityRecommendationId(r.recommendationId)
        ) {
          surfacePool.push(r);
        }
      }
    }
  } else if (backlogRecs.length > 0) {
    // No persistence gate — still put backlog ahead of fresh evidence.
    const backlogFirst = backlogRecs.filter((r) =>
      surfacePool.some((s) => s.recommendationId === r.recommendationId),
    );
    const rest = surfacePool.filter((r) => !backlogIds.has(r.recommendationId));
    surfacePool = [...backlogFirst, ...rest];
  }

  // P0-5: live overdue Concierge SLA — operational state, not lifecycle-gated.
  {
    const injected = injectConciergeSlaOverdueIntoSurfacePool({
      recommendations,
      surfacePool,
      overdueCount: input.conciergeSlaOverdueCount ?? 0,
    });
    recommendations = injected.recommendations;
    surfacePool = injected.surfacePool;
  }

  {
    const qaInjected = injectWebsiteQaCriticalIntoSurfacePool({
      recommendations,
      surfacePool,
    });
    recommendations = qaInjected.recommendations;
    surfacePool = qaInjected.surfacePool;
  }

  {
    const attributionInjected = injectAttributionIntegrityIntoSurfacePool({
      recommendations,
      surfacePool,
    });
    recommendations = attributionInjected.recommendations;
    surfacePool = attributionInjected.surfacePool;
  }

  // Legacy fallback for callers that omit intent (mostly unit tests).
  // Production daily/weekly paths must pass intent explicitly:
  // executeAgentOsCadence → resolveBriefCadenceIntent(cadenceId),
  // and scripts/agent-os-brief.ts → parseBriefCadenceIntent(args).
  const intent: BriefCadenceIntent = input.briefCadenceIntent ?? "weekly";
  let poolForSelection =
    surfacePool.length > 0
      ? surfacePool
      : input.founderSurfaceEligibleIds
        ? []
        : active.filter((r) => r.originatingExecutive !== "opportunity");

  // Demote weak analytical observations from the founder priority pool.
  // They remain in ranked JSON; they must not become the highest-ROI action.
  {
    const actionable = poolForSelection.filter(
      (r) => !isWeakAnalyticalObservation(r) && !r.approvalRequired,
    );
    if (actionable.length > 0) {
      poolForSelection = actionable;
    } else {
      poolForSelection = poolForSelection.filter((r) => !r.approvalRequired);
    }
  }

  // When GA4 + GSC are healthy, never let generic analytics maintenance win
  // highest-ROI — prefer commercial / content / ops / quiet day instead.
  {
    const withoutAnalyticsMaint = poolForSelection.filter(
      (r) =>
        !shouldSuppressAnalyticsMaintenanceHighestRoi({
          recommendation: r,
          sourceHealth: input.sourceHealth,
        }),
    );
    if (withoutAnalyticsMaint.length > 0) {
      poolForSelection = withoutAnalyticsMaint;
    } else if (
      poolForSelection.some((r) =>
        shouldSuppressAnalyticsMaintenanceHighestRoi({
          recommendation: r,
          sourceHealth: input.sourceHealth,
        }),
      )
    ) {
      // Only analytics-maintenance left and sources are healthy → empty pool
      // so quiet-day / no-action messaging can win.
      poolForSelection = [];
    }
  }

  // Preserve ranked highest-ROI order; cluster/limitation rules only demote slots
  // (see brief-quality.ts). Soft diversity is a fill tie-breaker, not a quota.
  // Daily: 1 highest-ROI + up to 3 named priorities (product contract).
  // Daily named slots come from founder-now backlog only — do not backfill with
  // Search/Content/Opportunity busywork to reach the cap.
  const maxPriorities =
    intent === "daily"
      ? MAX_DAILY_NAMED_PRIORITIES + 1
      : MAX_ADDITIONAL_SURFACED_PRIORITIES + 1;

  let poolForSelect = poolForSelection;
  if (intent === "daily" && input.operatingBacklog) {
    // Management backlog is present: named daily slots are founder-now only.
    // Do not backfill with Search/Content/Opportunity to reach the cap.
    // Watch-only backlogs yield an empty named pool (quiet day), not busywork.
    const backlogInPool = backlogRecs.filter((r) =>
      poolForSelection.some((p) => p.recommendationId === r.recommendationId),
    );
    poolForSelect = [...backlogInPool];
  } else if (intent !== "daily" && backlogRecs.length > 0) {
    const backlogInPool = backlogRecs.filter((r) =>
      poolForSelection.some((p) => p.recommendationId === r.recommendationId),
    );
    const fresh = poolForSelection.filter(
      (r) => !backlogIds.has(r.recommendationId),
    );
    const caseStudyNow = isCaseStudyProductionFounderNow(input.operatingBacklog);
    const weeklyFresh = caseStudyNow
      ? fresh.filter((r) => !isOrdinaryEditorialContentRecommendation(r))
      : fresh;
    poolForSelect = [...backlogInPool, ...weeklyFresh];
  }

  // P0-5: live overdue Concierge must stay ahead of daily backlog reorder.
  // Backlog-first fill is correct for ordinary sprint work, but must not demote
  // an operational overdue Concierge SLA below SEO/marketing/content items.
  {
    const overdue = recommendations.find((r) =>
      isConciergeSlaOverdueRecommendationId(r.recommendationId),
    );
    if (overdue) {
      const without = poolForSelect.filter(
        (r) => !isConciergeSlaOverdueRecommendationId(r.recommendationId),
      );
      poolForSelect = [overdue, ...without];
    }
  }

  // Critical production-health exception may outrank ordinary founder-now
  // work. Concierge overdue still wins if both exist.
  {
    const qa = recommendations.find(
      (r) =>
        isWebsiteQaExceptionRecommendationId(r.recommendationId) &&
        r.urgency === "critical",
    );
    if (qa) {
      const without = poolForSelect.filter(
        (r) => !isWebsiteQaExceptionRecommendationId(r.recommendationId),
      );
      const conciergeFirst =
        without[0] &&
        isConciergeSlaOverdueRecommendationId(without[0].recommendationId);
      poolForSelect = conciergeFirst
        ? [without[0], qa, ...without.slice(1)]
        : [qa, ...without];
    }
  }

  {
    const attribution = recommendations.find(
      (r) =>
        isAttributionIntegrityRecommendationId(r.recommendationId) &&
        r.urgency === "critical",
    );
    if (attribution) {
      const without = poolForSelect.filter(
        (r) => !isAttributionIntegrityRecommendationId(r.recommendationId),
      );
      const opsFirst =
        without[0] &&
        (isConciergeSlaOverdueRecommendationId(without[0].recommendationId) ||
          isWebsiteQaExceptionRecommendationId(without[0].recommendationId));
      poolForSelect = opsFirst
        ? [without[0], attribution, ...without.slice(1)]
        : [attribution, ...without];
    }
  }

  const selected = selectFounderPriorities(poolForSelect, {
    max: maxPriorities,
  });
  let highest = selected.highest;
  let additionalSurfaced = selected.additional;

  // Carry-forward safety: if daily pool emptied after filters but backlog exists,
  // force backlog items into the brief.
  if (intent === "daily" && !highest && backlogRecs.length > 0) {
    const forced = selectFounderPriorities(
      backlogRecs.filter(
        (r) =>
          r.status !== "blocked" &&
          r.status !== "ignore" &&
          r.status !== "consolidated",
      ),
      { max: maxPriorities },
    );
    highest = forced.highest;
    additionalSurfaced = forced.additional;
  }

  if (highest && isWeakAnalyticalObservation(highest) && !backlogIds.has(highest.recommendationId)) {
    highest = undefined;
  }
  if (
    highest &&
    shouldSuppressAnalyticsMaintenanceHighestRoi({
      recommendation: highest,
      sourceHealth: input.sourceHealth,
    }) &&
    !backlogIds.has(highest.recommendationId)
  ) {
    highest = undefined;
  }

  const surfacedIds = new Set(
    [highest, ...additionalSurfaced]
      .filter(Boolean)
      .map((r) => r!.recommendationId),
  );

  // Diverted internal limitations stay in structured records — not as
  // engineering-language blockers on the founder brief.
  const divertedAsBlockers: string[] = [];

  const founderDecisions = active
    .filter((r) => r.approvalRequired && surfacedIds.has(r.recommendationId))
    .map((r) => {
      const choice = r.title.replace(/^\[[^\]]+\]\s*/, "");
      const recommendation = cleanFounderFacingAction(r.proposedAction);
      const reason = cleanFounderFacingAction(
        r.whyItMattersNow || r.plainLanguageExplanation,
      );
      const wait =
        r.urgency === "critical" || r.urgency === "high"
          ? "Waiting risks missing a time-sensitive window."
          : "Waiting keeps unfinished work competing with new experiments.";
      const deadline =
        r.recommendationId.startsWith("operating-backlog:") &&
        input.operatingBacklog
          ? input.operatingBacklog.masterSprint.items.find(
              (i) => `operating-backlog:${i.id}` === r.recommendationId,
            )?.deadline ?? null
          : null;
      return formatFounderDecisionLine({
        decision: choice,
        recommendation: recommendation.replace(/\.\.+/g, ".").replace(/\.\s*$/, ""),
        why: reason.replace(/\.\.+/g, ".").replace(/\.\s*$/, ""),
        costOfDelay: wait,
        deadline,
      });
    });

  // Also surface open backlog decisions even if not highest-ROI slot winners.
  if (input.operatingBacklog && intent === "daily") {
    for (const item of input.operatingBacklog.masterSprint.items) {
      if (item.kind !== "open-decision" || item.status !== "active") continue;
      if (!isFounderNowItem(item)) continue;
      if (founderDecisions.some((d) => d.includes(item.title))) continue;
      if (!item.recommendedChoice) continue;
      founderDecisions.push(
        formatFounderDecisionLine({
          decision: item.title,
          recommendation: item.recommendedChoice.replace(/\.\s*$/, ""),
          why: item.why.replace(/\.\s*$/, ""),
          costOfDelay: (
            item.costOfDelay ??
            "Delay keeps unfinished commitments and new work competing for the same hours."
          ).replace(/\.\s*$/, ""),
          deadline: item.deadline,
        }),
      );
    }
  }

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

  // What changed = business evidence only (metrics, material anomalies, ready
  // opportunity signals). Repository / content-map inventory titles stay out.
  const businessMetricChanges = input.bi.keyMetricChanges.filter(
    (line) =>
      !/repository|content-map|inventory|filming\/editing|registry draft/i.test(
        line,
      ),
  );
  const materialAnomalies = input.bi.anomalies
    .filter((a) => a.severity === "critical" || a.severity === "high")
    .filter((a) => {
      // Prefer observation (with magnitude) over vague titles.
      const line = a.observation || a.title;
      return !isVagueMetricWithoutMagnitude(line);
    })
    .slice(0, intent === "daily" ? 1 : 2)
    .map((a) => a.observation || a.title);
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
          ...businessMetricChanges.slice(0, 2),
          ...materialAnomalies.slice(0, 1),
        ]
      : [
          ...businessMetricChanges.slice(0, 3),
          ...materialAnomalies,
          ...opportunityChangeBits,
        ];
  const seenChange = new Set<string>();
  const dedupedChangeBits: string[] = [];
  for (const bit of changeBits) {
    if (!bit) continue;
    const key = bit.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
    // Also collapse near-duplicates that share the same leading metric label.
    const lead = key.split(/[:(]/)[0]!.trim();
    if (seenChange.has(key) || seenChange.has(`lead:${lead}`)) continue;
    seenChange.add(key);
    seenChange.add(`lead:${lead}`);
    dedupedChangeBits.push(bit);
  }
  const whatChangedRaw =
    dedupedChangeBits.join("; ") ||
    (intent === "daily"
      ? "No material day-over-day signal in available sources."
      : "No material week-over-week business signal in available sources.");
  const whatChanged =
    intent === "weekly"
      ? sanitizeFounderFacingNarrative(whatChangedRaw)
      : whatChangedRaw;

  const whyItMatters = highest
    ? highest.whyItMattersNow
    : intent === "daily" && backlogOrientation?.objective
      ? backlogOrientation.objective
      : intent === "daily"
        ? "No durable operating priority is available to orient the day."
        : "No high-confidence action is ready this week.";

  const needsAttentionToday = [
    ...additionalSurfaced.map((r) => r.title),
    ...input.bi.anomalies
      .filter((a) => a.severity === "critical" || a.severity === "high")
      .map((a) => a.observation || a.title)
      .filter((line) => !isVagueMetricWithoutMagnitude(line)),
  ].slice(0, intent === "daily" ? MAX_DAILY_NAMED_PRIORITIES : MAX_ADDITIONAL_SURFACED_PRIORITIES);

  if (
    needsAttentionToday.length === 0 &&
    !highest &&
    criticalGapsNeedDecision(
      input.bi,
      input.search,
      input.content,
      input.opportunity,
    )
  ) {
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
  const watchNoActionItems =
    intent === "daily" && input.operatingBacklog
      ? applyAuthorityOutreachWatchLine(
          watchLinesFromOperatingBacklog(input.operatingBacklog),
          input.content?.authority,
        )
      : [];
  if (intent === "daily") {
    if (watchNoActionItems.length > 0) {
      canSafelyWait.push(...watchNoActionItems);
    } else {
      canSafelyWait.push("None");
    }
  } else {
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
  }

  const blockedListRaw = [
    ...divertedAsBlockers,
    ...blocked.slice(0, 2).map(
      (r) =>
        `${r.title}${r.blockedReasons?.length ? ` — ${r.blockedReasons[0]}` : ""}`,
    ),
  ].slice(0, 4);
  const blockedList = filterFounderFacingBlockers(blockedListRaw);

  // Deduplicate gap descriptions for brief length.
  // Only critical website/search gaps may appear founder-facing, and only as
  // business-effect language. Opportunity/Buffer/HubSpot/GBP stay internal.
  const seenGap = new Set<string>();
  const missingOrUnreliableData: string[] = [];
  const internalSecondaryGaps: string[] = [];
  if (input.bi.incompleteAttribution) {
    internalSecondaryGaps.push(
      "Incomplete social attribution without Buffer adapter",
    );
  }
  for (const g of allGaps) {
    const desc = g.description;
    if (isByDesignHealthySearchLimitation(desc)) {
      internalSecondaryGaps.push(desc);
      continue;
    }
    const key = String(g.sourceId);
    if (seenGap.has(key)) continue;
    seenGap.add(key);
    if (
      /adapter|hubspot|buffer|gbp|not configured|opportunity adapter|fixture|evidence unavailable|cpc|paid-search cost|remarketing audience/i.test(
        desc,
      ) ||
      key === "hubspot-aggregates" ||
      key === "hubspot" ||
      key === "buffer" ||
      key === "gbp" ||
      /opportunity/i.test(key)
    ) {
      internalSecondaryGaps.push(desc);
      continue;
    }
    if (key === "ga4" || key === "gsc" || key === "weekly-intelligence") {
      missingOrUnreliableData.push(desc);
    } else {
      internalSecondaryGaps.push(desc);
    }
    if (missingOrUnreliableData.length >= 3) break;
  }
  if (internalSecondaryGaps.length > 0) {
    input.warnings.push(
      `Internal secondary source gaps (not founder-facing): ${internalSecondaryGaps.slice(0, 3).join("; ")}`,
    );
  }

  const founderDecisionNeededRaw =
    founderDecisions.length > 0
      ? founderDecisions.slice(0, 3)
      : intent === "weekly"
        ? []
        : criticalGapsNeedDecision(
              input.bi,
              input.search,
              input.content,
              input.opportunity,
            )
          ? [
              formatFounderDecisionLine({
                decision:
                  "Whether to restore trustworthy website and search reporting before growth experiments",
                recommendation:
                  "Restore reliable website and search analytics before changing growth direction.",
                why: "Without trustworthy measurement, new experiments cannot be evaluated.",
                costOfDelay:
                  "Delay risks shipping changes that cannot be measured.",
              }),
            ]
          : [];

  const founderDecisionNeeded =
    intent === "weekly"
      ? filterGenuineFounderDecisions(founderDecisionNeededRaw).length > 0
        ? filterGenuineFounderDecisions(founderDecisionNeededRaw)
        : ["No founder approvals required this week."]
      : founderDecisionNeededRaw.length > 0
        ? founderDecisionNeededRaw
        : [];

  const surfacedPriorityTitles = [
    // Highest-ROI stands alone — do not repeat it under Priorities.
    ...additionalSurfaced.map((r) => {
      const title = r.title.replace(/^\[[^\]]+\]\s*/, "");
      if (intent === "weekly") {
        return toFounderFacingPriorityAction(title, r.proposedAction);
      }
      // Daily: keep persistent backlog wording concrete (no editorial rewrite).
      if (r.recommendationId.startsWith("operating-backlog:")) {
        const action = cleanFounderFacingAction(r.proposedAction);
        return action && !action.toLowerCase().includes(title.toLowerCase().slice(0, 20))
          ? `${title} — ${summarizeFounderAction(action, 140)}`
          : title;
      }
      return toFounderFacingPriorityAction(title, r.proposedAction);
    }),
  ].slice(0, intent === "daily" ? MAX_DAILY_NAMED_PRIORITIES : 5);

  // When daily has a highest-ROI but no additional priorities, promote the
  // highest into named priorities only if we somehow have zero titles AND
  // no highest — otherwise keep highest separate. If both empty after filters,
  // leave empty for quality gate / send-nothing.
  if (
    intent === "daily" &&
    surfacedPriorityTitles.length === 0 &&
    highest &&
    backlogOrientation?.activePriorityTitles.length
  ) {
    for (const title of backlogOrientation.activePriorityTitles) {
      if (title === highest.title.replace(/^\[[^\]]+\]\s*/, "")) continue;
      surfacedPriorityTitles.push(title);
      if (surfacedPriorityTitles.length >= MAX_DAILY_NAMED_PRIORITIES) break;
    }
  }

  const opportunitiesDetected =
    (input.search?.opportunities.length ?? 0) +
    (input.content?.opportunities.length ?? 0) +
    (input.opportunity?.volumeFunnel.qualifiedFindings ??
      input.opportunity?.opportunities.filter(
        (o) => !o.rejected && o.readiness !== "rejected",
      ).length ??
      0);

  const hasCriticalSourceGaps = criticalGapsNeedDecision(
    input.bi,
    input.search,
    input.content,
    input.opportunity,
  );

  const highestRoiAction = highest
    ? enrichDailyHighestRoi(
        composeHighestRoiAction({
          title: highest.title,
          proposedAction: highest.proposedAction,
          intent,
          plainLanguageExplanation: highest.plainLanguageExplanation,
          expectedUpside: highest.expectedUpside,
          whyItMattersNow: highest.whyItMattersNow,
        }),
        intent,
        highest,
        input.operatingBacklog,
        input.content?.authority,
      )
    : intent === "daily" && backlogOrientation?.activePriorityTitles[0]
      ? composeHighestRoiAction({
          title: backlogOrientation.activePriorityTitles[0],
          proposedAction:
            "Finish the top unresolved sprint commitment before opening new work.",
          intent,
          expectedUpside: "Protect focus and clear the highest-value open item.",
          whyItMattersNow: backlogOrientation.objective,
        })
      : intent === "daily"
        ? "No durable operating priority is available for a highest-ROI move."
        : weeklyLowConfidenceHighestRoi({
            briefEvidenceQuality: input.briefEvidenceQuality,
            hasCriticalSourceGaps,
          });

  const periodLabel =
    intent === "daily" && input.briefLocalDate
      ? `Morning Brief · ${formatFounderLocalDateLabel(input.briefLocalDate)}`
      : formatWeeklyRangeLabel(
          input.reportingPeriod.start,
          input.reportingPeriod.end,
        );

  const sprintOrientationLine =
    intent === "daily" && backlogOrientation
      ? backlogOrientation.activePriorityTitles[0] ??
        backlogOrientation.sprintName
      : null;

  const opportunityToWatch =
    intent === "daily"
      ? buildActionableOpportunityWatch({
          anomalies: input.bi.anomalies,
          keyMetricChanges: businessMetricChanges,
        })
      : null;

  const clientAttentionItems =
    intent === "daily"
      ? buildClientAttentionBriefItems({
          pool: [highest, ...additionalSurfaced].filter(
            (r): r is Recommendation => Boolean(r),
          ),
          fallbackPool: surfacePool,
          highestTitle: highest?.title ?? null,
          priorityTitles: surfacedPriorityTitles,
          clientOpsHealth: input.bi.clientAttentionAudit?.clientOpsHealth,
        })
      : null;

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
      ...(sprintOrientationLine
        ? [`Persistent sprint focus: ${sprintOrientationLine}`]
        : []),
    ],
    inferences: [
      ...input.bi.inferences.slice(0, 1),
      ...(input.opportunity?.inferences ?? []).slice(0, 1),
    ],
    surfacedPriorityTitles,
    rankedRecommendationCount: active.length,
    opportunitiesDetected,
    sprintOrientation: sprintOrientationLine,
    dayOrientation:
      intent === "daily"
        ? applyAuthorityDayOrientation(
            backlogOrientation?.dayOrientation ?? null,
            input.operatingBacklog,
            input.content?.authority,
          )
        : null,
    opportunityToWatch,
    clientAttentionItems,
    watchNoActionItems:
      intent === "daily" && watchNoActionItems.length > 0
        ? watchNoActionItems
        : null,
  });

  return {
    recommendations,
    brief,
    escalationItems,
    nonOperationalNote,
    surfacedInBriefCount:
      (highest ? 1 : 0) + surfacedPriorityTitles.length,
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
  return gaps.some((g) => isGenuineMeasurementSourceFailure(g));
}

function enrichDailyHighestRoi(
  composed: string,
  _intent: BriefCadenceIntent,
  highest: Recommendation,
  backlog: OperatingBacklog | null | undefined,
  authority?: AuthoritySnapshot | null,
): string {
  if (!backlog) return composed.replace(/\.\.+/g, ".");
  const framed = applyAuthorityHighestRoi(composed, backlog, authority, highest);
  return framed.replace(/\.\.+/g, ".");
}

function isOrdinaryEditorialContentRecommendation(r: Recommendation): boolean {
  if (r.originatingExecutive !== "content") return false;
  const blob = `${r.recommendationId}\n${r.title}`;
  if (/case-study|authority-outreach/i.test(blob)) return false;
  return /editorial-roi-package|founder-conversation-topic|follow-up-conversation|Editorial ROI:|founder conversation/i.test(
    blob,
  );
}

function applyAuthorityDayOrientation(
  fallback: string | null,
  backlog: OperatingBacklog | null | undefined,
  authority: AuthoritySnapshot | null | undefined,
): string | null {
  if (!isCaseStudyProductionFounderNow(backlog) || !authority) return fallback;
  if (authority.caseStudies.nextCaseStudy) {
    const title = authority.caseStudies.nextCaseStudy.workingTitle;
    return `Advance the next Case Study (“${title}”). Protect conversion gains; do not open leftover local-guide or Conversation work.`;
  }
  return "Case Study production is the priority, but founder input/material is required.";
}

function applyAuthorityHighestRoi(
  composed: string,
  backlog: OperatingBacklog | null | undefined,
  authority: AuthoritySnapshot | null | undefined,
  highest: Recommendation,
): string {
  if (!isCaseStudyProductionFounderNow(backlog) || !authority) return composed;
  const isCaseStudySlot =
    /case study/i.test(highest.title) ||
    /case-study/i.test(highest.recommendationId) ||
    highest.recommendationId.includes("sprint-case-study-production");
  if (!isCaseStudySlot && isOrdinaryEditorialContentRecommendation(highest)) {
    if (authority.caseStudies.nextCaseStudy) {
      return authority.caseStudies.nextCaseStudy.nextAction;
    }
    return (
      authority.caseStudies.founderInputReason ??
      "Affirm the next Case Study in the Authority ledger. Do not substitute a Conversation."
    );
  }
  if (!isCaseStudySlot) return composed;
  if (authority.caseStudies.nextCaseStudy) {
    return authority.caseStudies.nextCaseStudy.nextAction;
  }
  return (
    authority.caseStudies.founderInputReason ??
    "Affirm the next Case Study in the Authority ledger. Do not substitute a Conversation."
  );
}

function applyAuthorityOutreachWatchLine(
  lines: string[],
  authority: AuthoritySnapshot | null | undefined,
): string[] {
  if (!authority) return lines;
  const dueLine = authority.outreach.watchLine;
  const replaced = lines.map((line) =>
    /authority outreach/i.test(line) ? dueLine : line,
  );
  if (
    authority.outreach.founderTask === "follow-up-readiness" &&
    !replaced.some((l) => /authority outreach/i.test(l))
  ) {
    return [dueLine, ...replaced].slice(0, 5);
  }
  return replaced;
}

function buildActionableOpportunityWatch(input: {
  anomalies: BusinessIntelligenceOutput["anomalies"];
  keyMetricChanges: string[];
}): string | null {
  for (const a of input.anomalies) {
    if (a.severity !== "critical" && a.severity !== "high") continue;
    const magnitudeLine = a.observation?.trim() || "";
    if (!magnitudeLine || isVagueMetricWithoutMagnitude(magnitudeLine)) continue;
    if (isVagueMetricWithoutMagnitude(a.title) && !magnitudeLine) continue;
    const hypothesis =
      a.possibleCauses?.[0] != null
        ? `Hypothesis: ${a.possibleCauses[0]}.`
        : "Hypothesis: channel mix or demand softness — confirm before acting.";
    const trigger =
      "Act if the same direction repeats next cycle with comparable magnitude, or if consultation requests move with sessions.";
    const next = a.isTrackingFailureSuspect
      ? "Recommended next step: verify consultation-request and Studio visit recording before changing product direction."
      : "Recommended next step: review top landing pages for the same period and decide whether the move is demand or mix.";
    return `${magnitudeLine}. ${hypothesis} Trigger: ${trigger} ${next}`;
  }
  for (const line of input.keyMetricChanges) {
    if (!line || isVagueMetricWithoutMagnitude(line)) continue;
    if (!/\d/.test(line)) continue;
    return `${cleanFounderFacingAction(line)}. Hypothesis: ordinary mix or demand shift until page-level confirmation. Trigger: act only if the move repeats with similar magnitude next cycle. Recommended next step: compare the top three landing pages week-over-week before changing offers.`;
  }
  return null;
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
  sprintOrientation?: string | null;
  dayOrientation?: string | null;
  opportunityToWatch?: string | null;
  clientAttentionItems?: Array<{
    title: string;
    summary: string;
    action: string;
  }> | null;
  watchNoActionItems?: string[] | null;
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

  const clientSection =
    input.briefCadenceIntent === "daily" &&
    input.clientAttentionItems &&
    input.clientAttentionItems.length > 0
      ? `
## Client Attention
${input.clientAttentionItems
  .map(
    (item, i) =>
      `${i + 1}. ${item.title}. ${item.summary} ${item.action}`,
  )
  .join("\n")}
`
      : "";

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
${clientSection}
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
    sprintOrientation: input.sprintOrientation ?? null,
    dayOrientation: input.dayOrientation ?? null,
    opportunityToWatch: input.opportunityToWatch ?? null,
    clientAttentionItems: input.clientAttentionItems?.length
      ? input.clientAttentionItems
      : null,
    watchNoActionItems: input.watchNoActionItems?.length
      ? input.watchNoActionItems
      : null,
  };
}

function buildClientAttentionBriefItems(input: {
  pool: Recommendation[];
  fallbackPool: Recommendation[];
  highestTitle: string | null;
  priorityTitles: string[];
  clientOpsHealth?: "healthy" | "exceptions" | "unknown";
}): Array<{ title: string; summary: string; action: string }> | null {
  if (input.clientOpsHealth === "unknown") {
    return null;
  }
  const fromPool = input.pool.filter((r) =>
    isClientAttentionRecommendationId(r.recommendationId),
  );
  const fromFallback = input.fallbackPool.filter((r) =>
    isClientAttentionRecommendationId(r.recommendationId),
  );
  const combined = [...fromPool];
  for (const r of fromFallback) {
    if (!combined.some((c) => c.recommendationId === r.recommendationId)) {
      combined.push(r);
    }
  }

  const actionable = combined.filter(
    (r) =>
      r.status !== "downgraded" &&
      r.status !== "ignore" &&
      r.status !== "blocked" &&
      r.status !== "consolidated",
  );

  const items = actionable
    .slice(0, MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES)
    .map((r) => {
      const title = r.title.replace(/^\[[^\]]+\]\s*/, "");
      return {
        title,
        summary: summarizeFounderAction(r.plainLanguageExplanation, 160),
        action: cleanFounderFacingAction(r.proposedAction),
      };
    });

  return items.length ? items : null;
}
