import type { TodayPageModel } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import type {
  CosDocketItemView,
  CosTodaySectionId,
  CosTodaySectionItem,
  CosTodaySectionView,
} from "@/lib/continuum/chief-of-staff/operating-loop/docket";
import type {
  SterlingPortfolioAssessment,
  SterlingTodayProposal,
  SterlingTodayRecommendation,
} from "./types";

const SECTION_TITLES: Record<CosTodaySectionId, string> = {
  founder: "Founder / Your Turn",
  ready: "Ready / Delivery",
  waiting_client: "Waiting on Client",
  cad_design: "CAD / Design",
  production: "In Production",
  repairs: "Repairs",
  watching: "Watching / Held / Deferred",
};

function sectionId(
  recommendation: SterlingTodayRecommendation,
  assessment: SterlingPortfolioAssessment,
): CosTodaySectionId {
  if (assessment.nextStepOwner === "founder" && assessment.attentionPriority === "action_now") return "founder";
  if (recommendation.category === "ready_delivery") return "ready";
  if (recommendation.category === "waiting_on_client") return "waiting_client";
  if (recommendation.category === "in_production") return "production";
  const lifecycle = assessment.currentStage.canonicalLifecycleStage;
  if (["design", "cad", "client_approval"].includes(lifecycle ?? "")) return "cad_design";
  if (["intake", "evaluation", "estimate", "bench", "ready_for_return"].includes(lifecycle ?? "")) return "repairs";
  return "watching";
}

function sectionItem(
  recommendation: SterlingTodayRecommendation,
  assessment: SterlingPortfolioAssessment,
): CosTodaySectionItem {
  return {
    id: recommendation.itemId,
    title: recommendation.title,
    summary: recommendation.summary,
    stateLabel: assessment.currentStage.canonicalLifecycleStage ?? "Current",
    origin: "watching",
    ballHolder: assessment.nextStepOwner,
    lifecycle: assessment.currentStage.canonicalLifecycleStage,
    projectId: recommendation.projectId,
    jobId: null,
    packet: null,
    cosBriefing: null,
  };
}

function upNextItem(recommendation: SterlingTodayRecommendation): CosDocketItemView {
  return {
    id: recommendation.itemId,
    lane: "live_work",
    origin: "brief",
    subject: recommendation.title,
    headline: recommendation.summary,
    context: recommendation.explanation,
    job: null,
    brief: null,
    decision: null,
    anomaly: null,
    briefing: null,
    briefingPacket: null,
    cosBriefing: null,
    semanticPresentation: null,
  };
}

/**
 * Projects validated v6 output into the existing Today display contract.
 * The v6 proposal is authoritative while enabled; legacy data is retained only
 * as the immediate fallback returned by the caller when projection is unavailable.
 */
export function projectSterlingTodaySurface(
  legacy: TodayPageModel,
  proposal: SterlingTodayProposal,
): TodayPageModel {
  const assessmentByUnit = new Map(
    proposal.portfolioAssessments.map((assessment) => [assessment.workUnitId, assessment] as const),
  );
  const seen = new Set<string>();
  const active = proposal.recommendations.flatMap((recommendation) => {
    if (seen.has(recommendation.workUnitId)) return [];
    const assessment = assessmentByUnit.get(recommendation.workUnitId);
    if (!assessment || assessment.todayDisposition !== "presented" ||
      assessment.attentionPriority === "no_attention") return [];
    seen.add(recommendation.workUnitId);
    return [{ recommendation, assessment }];
  });
  const founderActions = active.filter(({ assessment }) =>
    assessment.nextStepOwner === "founder" && assessment.attentionPriority === "action_now");
  const upNext = founderActions.slice(0, 3).map(({ recommendation }) => upNextItem(recommendation));
  const promoted = new Set(upNext.map((item) => item.id));
  const grouped = new Map<CosTodaySectionId, CosTodaySectionItem[]>();
  for (const { recommendation, assessment } of active) {
    if (promoted.has(recommendation.itemId)) continue;
    const id = sectionId(recommendation, assessment);
    grouped.set(id, [...(grouped.get(id) ?? []), sectionItem(recommendation, assessment)]);
  }
  const sections = (Object.keys(SECTION_TITLES) as CosTodaySectionId[]).map((id): CosTodaySectionView => ({
    id,
    title: SECTION_TITLES[id],
    items: grouped.get(id) ?? [],
  }));
  return {
    freshness: legacy.freshness,
    readModelStatus: legacy.readModelStatus,
    // Preserve the canonical source watermark so the existing freshness poll
    // does not confuse a Sterling evidence snapshot id with a source change.
    readModelWatermark: legacy.readModelWatermark,
    docket: {
      ...legacy.docket,
      items: upNext,
      queuedCount: Math.max(0, founderActions.length - upNext.length),
      watching: [],
      watchingCount: 0,
      cleanup: [],
      sections,
      showCaughtUp: upNext.length === 0,
      showDisconnected: false,
      disconnectedHeading: null,
      disconnectedDetail: null,
    },
  };
}
