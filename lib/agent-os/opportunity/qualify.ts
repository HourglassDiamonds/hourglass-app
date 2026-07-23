/**
 * Opportunity qualification, confidence separation, and ranking adjustments.
 *
 * evidenceConfidence ≠ strategicAttractiveness ≠ actionability ≠ priority.
 * High diagnostic confidence that evidence is missing must not raise
 * remarketing/paid priority.
 */

import type { GrowthOpportunity, OpportunityReadiness } from "./types";

export type QualificationResult = {
  ok: boolean;
  score: number;
  reasons: string[];
  penalties: string[];
};

/** Map readiness → actionability (0–1). */
export function actionabilityForReadiness(
  readiness: OpportunityReadiness,
): number {
  switch (readiness) {
    case "ready-for-founder-decision":
      return 0.85;
    case "ready-to-evaluate":
      return 0.75;
    case "research-required":
      return 0.25;
    case "measurement-blocked":
      return 0.1;
    case "not-ready":
      return 0.15;
    case "defer":
    case "already-covered":
      return 0.05;
    case "rejected":
      return 0;
    default:
      return 0.2;
  }
}

/**
 * Whether an Opportunity finding may take a named founder-brief slot.
 * measurement-blocked / already-covered / rejected / generic research stay out.
 */
export function opportunityIsSurfaceEligible(opp: GrowthOpportunity): boolean {
  if (opp.rejected || opp.readiness === "rejected") return false;
  if (opp.readiness === "measurement-blocked") return false;
  if (opp.readiness === "already-covered" || opp.readiness === "defer") {
    return false;
  }
  if (opp.readiness === "not-ready") return false;
  if (opp.type === "opportunity-already-covered") return false;
  if (!opp.additionalLeverage || opp.additionalLeverage.length < 24) return false;
  if (opp.actionability < 0.45) return false;

  if (opp.readiness === "research-required") {
    // Rare exception: unusually high-fit, low-cost, strong internal evidence
    return (
      opp.strategicAttractiveness >= 8.5 &&
      (opp.costClass === "none" || opp.costClass === "low") &&
      opp.evidenceConfidence >= 0.7 &&
      opp.founderDependence !== "heavy" &&
      Boolean(opp.relatedPage || opp.relatedTool) &&
      opp.externalVerification !== "source-gap"
    );
  }

  return (
    (opp.readiness === "ready-to-evaluate" ||
      opp.readiness === "ready-for-founder-decision") &&
    opp.strategicAttractiveness >= 6 &&
    opp.evidenceNotes.length >= 2
  );
}

/** Parse readiness from Opportunity recommendation plain-language block. */
export function readinessFromOpportunityRecommendation(plain: string): string | null {
  const m = /Readiness=([a-z-]+)/i.exec(plain);
  return m?.[1] ?? null;
}

export function opportunityRecommendationIsSurfaceEligible(
  plainLanguageExplanation: string,
  title: string,
  priorityScore: number,
): boolean {
  const readiness = readinessFromOpportunityRecommendation(
    plainLanguageExplanation,
  );
  if (!readiness) return false;
  if (
    readiness === "measurement-blocked" ||
    readiness === "already-covered" ||
    readiness === "rejected" ||
    readiness === "not-ready" ||
    readiness === "defer"
  ) {
    return false;
  }
  if (readiness === "research-required") {
    // Generic research stays deferred unless priority is exceptionally high
    // and title signals strong ready-path fit (rare)
    return (
      priorityScore >= 0.22 &&
      /high-fit|ready path|existing asset/i.test(plainLanguageExplanation)
    );
  }
  // ready-to-evaluate / ready-for-founder-decision — still need minimum quality
  if (priorityScore < 0.08) return false;
  if (/already covered|measurement-blocked/i.test(title)) return false;
  return true;
}

export function qualifyOpportunity(opp: GrowthOpportunity): QualificationResult {
  const reasons: string[] = [];
  const penalties: string[] = [];
  let score = 0;

  if (opp.evidenceNotes.length >= 2) {
    score += 2;
    reasons.push("evidence-backed");
  }
  if (
    opp.targetAudience === "engagement-buyers" ||
    opp.targetAudience === "local-charlotte" ||
    opp.targetAudience === "bridal-adjacent"
  ) {
    score += 2;
    reasons.push("high-intent-or-local-audience");
  }
  if (opp.costClass === "none" || opp.costClass === "low") {
    score += 2;
    reasons.push("low-cost");
  }
  if (opp.effort === "low" || opp.effort === "medium") {
    score += 1;
    reasons.push("contained-effort");
  }
  if (
    opp.relatedPage ||
    opp.relatedTool ||
    opp.relatedContent ||
    opp.relatedQuery
  ) {
    score += 2;
    reasons.push("connected-to-existing-asset");
  }
  if (
    opp.geography === "charlotte-metro" ||
    opp.geography === "waxhaw" ||
    opp.geography === "fort-mill"
  ) {
    score += 1;
    reasons.push("regional-relevance");
  }
  if (
    opp.funnelStage === "consideration" ||
    opp.funnelStage === "decision" ||
    opp.funnelStage === "trust"
  ) {
    score += 1;
    reasons.push("conversion-proximity");
  }
  if (opp.strategicAttractiveness >= 7 || opp.strategicFit >= 7) {
    score += 2;
    reasons.push("strategic-fit");
  }
  if (opp.founderDependence === "none" || opp.founderDependence === "light") {
    score += 1;
    reasons.push("manageable-founder-burden");
  }
  if (opp.additionalLeverage.length > 20) {
    score += 1;
    reasons.push("distinct-leverage");
  }
  if (
    opp.readiness === "ready-to-evaluate" ||
    opp.readiness === "ready-for-founder-decision"
  ) {
    score += 2;
    reasons.push("actionable-readiness");
  }

  if (opp.readiness === "already-covered") {
    penalties.push("already-covered-by-active-owner");
    score -= 8;
  }
  if (opp.type === "opportunity-already-covered") {
    penalties.push("duplicate-of-source-executive");
    score -= 8;
  }
  if (opp.costClass === "high") {
    penalties.push("large-spend");
    score -= 4;
  }
  if (opp.founderDependence === "heavy") {
    penalties.push("high-founder-burden");
    score -= 3;
  }
  if (
    opp.externalVerification === "unverified" &&
    opp.type.includes("competitor")
  ) {
    penalties.push("unverified-competitor-claim");
    score -= 3;
  }
  if (
    /network more|run ads|go viral|easy win|cheap traffic/i.test(
      `${opp.title} ${opp.recommendedAction}`,
    )
  ) {
    penalties.push("generic-speculative-language");
    score -= 10;
  }
  if (
    !opp.relatedPage &&
    !opp.relatedTool &&
    !opp.relatedQuery &&
    !opp.relatedContent &&
    opp.readiness === "ready-to-evaluate"
  ) {
    penalties.push("no-clear-conversion-path");
    score -= 3;
  }
  if (opp.isInference && opp.evidenceConfidence < 0.45) {
    penalties.push("weak-inference");
    score -= 2;
  }
  if (
    opp.externalVerification === "source-gap" &&
    (opp.type === "podcast-opportunity" ||
      opp.type === "newsletter-opportunity" ||
      opp.type === "earned-media-opportunity" ||
      opp.type === "local-partnership-opportunity" ||
      opp.type === "wedding-vendor-opportunity" ||
      opp.type === "bridal-ecosystem-opportunity")
  ) {
    if (opp.readiness === "ready-to-evaluate") {
      penalties.push("external-specificity-without-verification");
      score -= 6;
    }
  }
  if (opp.readiness === "measurement-blocked") {
    penalties.push("measurement-prerequisite-not-attractiveness");
    // Do not treat diagnostic certainty as opportunity strength
    score -= 2;
  }

  if (
    /generic|speculative|spray.?and.?pray|dominate|guaranteed roi/i.test(
      `${opp.title} ${opp.whyItMatters}`,
    ) &&
    opp.evidenceNotes.length < 2
  ) {
    return {
      ok: false,
      score: 0,
      reasons,
      penalties: [...penalties, "rejected-generic-speculation"],
    };
  }

  if (opp.rejected) {
    return {
      ok: false,
      score: Math.max(0, score),
      reasons,
      penalties: [...penalties, opp.rejectionReason ?? "explicitly-rejected"],
    };
  }

  if (
    opp.readiness === "rejected" ||
    (opp.readiness === "already-covered" && score < 4)
  ) {
    return { ok: false, score: Math.max(0, score), reasons, penalties };
  }

  return {
    ok: score >= 4,
    score: Math.max(0, score),
    reasons,
    penalties,
  };
}

/**
 * Ranking adjustments: actionability gates impact.
 * High evidenceConfidence alone never inflates measurement-blocked priority.
 */
export function opportunityRankingAdjustments(opp: GrowthOpportunity): {
  impactBoost: number;
  /** Multiplier applied to recommendation confidence (actionability-weighted) */
  confidenceMult: number;
  alignmentBoost: number;
  /** Effective impact for shared ranking = attractiveness × actionability */
  effectiveImpact: number;
  /** Confidence used for priority — diagnostic × actionability */
  rankingConfidence: number;
} {
  const actionability =
    opp.actionability ?? actionabilityForReadiness(opp.readiness);
  const attractiveness = opp.strategicAttractiveness ?? opp.strategicFit ?? 5;
  const evidenceConf = opp.evidenceConfidence ?? opp.confidence ?? 0.5;

  let impactBoost = 0;
  let confidenceMult = actionability;
  let alignmentBoost = 0;

  if (opp.relatedPage || opp.relatedTool) impactBoost += 0.5;
  if (
    opp.geography === "charlotte-metro" ||
    opp.geography === "waxhaw" ||
    opp.geography === "fort-mill"
  ) {
    impactBoost += 0.5;
    alignmentBoost += 1;
  }
  if (
    opp.funnelStage === "decision" ||
    opp.funnelStage === "consideration"
  ) {
    impactBoost += 0.5;
  }
  if (opp.costClass === "high" || opp.costClass === "unknown") {
    // Unknown cost lowers attractiveness for paid channels
    if (opp.type === "paid-search-readiness" || opp.type === "remarketing-readiness") {
      impactBoost -= 1.5;
    }
  }
  if (opp.costClass === "high") impactBoost -= 2;
  if (opp.founderDependence === "heavy") impactBoost -= 1.5;

  if (opp.readiness === "research-required") {
    impactBoost -= 2;
  }
  if (opp.readiness === "measurement-blocked") {
    // Diagnostic certainty must not raise priority
    impactBoost = -4;
    confidenceMult = Math.min(confidenceMult, 0.15);
  }
  if (opp.readiness === "already-covered" || opp.readiness === "defer") {
    impactBoost -= 5;
    confidenceMult = 0.1;
  }
  if (opp.readiness === "rejected" || opp.rejected) {
    impactBoost = -10;
    confidenceMult = 0;
  }
  if (opp.readiness === "not-ready") {
    impactBoost -= 3;
    confidenceMult = Math.min(confidenceMult, 0.2);
  }

  const effectiveImpact = clamp(
    (attractiveness + impactBoost) * actionability,
    0,
    10,
  );
  const rankingConfidence = clamp(evidenceConf * confidenceMult, 0.05, 1);

  return {
    impactBoost,
    confidenceMult,
    alignmentBoost,
    effectiveImpact,
    rankingConfidence,
  };
}

/** Apply confidence/attractiveness/actionability fields consistently. */
export function withConfidenceContract(
  opp: Omit<
    GrowthOpportunity,
    | "evidenceConfidence"
    | "strategicAttractiveness"
    | "actionability"
    | "confidence"
    | "likelyImpact"
    | "strategicFit"
  > & {
    evidenceConfidence: number;
    strategicAttractiveness: number;
    strategicFit?: number;
    confidence?: number;
    likelyImpact?: number;
  },
): GrowthOpportunity {
  const actionability = actionabilityForReadiness(opp.readiness);
  const strategicFit = opp.strategicFit ?? opp.strategicAttractiveness;
  const likelyImpact = clamp(
    opp.strategicAttractiveness * actionability,
    0,
    10,
  );
  return {
    ...opp,
    strategicFit,
    evidenceConfidence: opp.evidenceConfidence,
    strategicAttractiveness: opp.strategicAttractiveness,
    actionability,
    confidence: opp.evidenceConfidence,
    likelyImpact: opp.likelyImpact ?? likelyImpact,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
