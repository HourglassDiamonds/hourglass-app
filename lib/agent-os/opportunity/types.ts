/**
 * Opportunity Executive typed contracts — taxonomy, readiness, and opportunity shape.
 */

export const OPPORTUNITY_TYPES = [
  "underpriced-organic-demand",
  "paid-search-readiness",
  "remarketing-readiness",
  "local-partnership-opportunity",
  "referral-opportunity",
  "bridal-ecosystem-opportunity",
  "wedding-vendor-opportunity",
  "community-placement-opportunity",
  "podcast-opportunity",
  "newsletter-opportunity",
  "earned-media-opportunity",
  "founder-expertise-placement",
  "content-distribution-opportunity",
  "local-authority-opportunity",
  "tool-distribution-opportunity",
  "guide-distribution-opportunity",
  "competitor-positioning-gap",
  "channel-fit-opportunity",
  "conversion-leverage-opportunity",
  "relationship-leverage-opportunity",
  "strategic-introduction-opportunity",
  "low-cost-experiment",
  "audience-reuse-opportunity",
  "measurement-gap",
  "verification-required",
  "opportunity-already-covered",
  "opportunity-not-ready",
] as const;

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const OPPORTUNITY_READINESS_STATES = [
  "ready-to-evaluate",
  "ready-for-founder-decision",
  "research-required",
  "measurement-blocked",
  "not-ready",
  "already-covered",
  "defer",
  "rejected",
] as const;

export type OpportunityReadiness =
  (typeof OPPORTUNITY_READINESS_STATES)[number];

export type OpportunityAudience =
  | "engagement-buyers"
  | "self-purchasers"
  | "local-charlotte"
  | "returning-researchers"
  | "bridal-adjacent"
  | "partner-ecosystem"
  | "founders-peers";

export type OpportunityFunnelStage =
  | "awareness"
  | "consideration"
  | "decision"
  | "trust"
  | "post-purchase";

export type OpportunityCostClass =
  | "none"
  | "low"
  | "moderate"
  | "high"
  | "unknown";

export type OpportunityEffortClass = "low" | "medium" | "high";

export type ExternalVerificationState =
  | "verified"
  | "unverified"
  | "not-applicable"
  | "source-gap";

export type OpportunityGeography =
  | "charlotte-metro"
  | "waxhaw"
  | "fort-mill"
  | "regional"
  | "national"
  | "unspecified";

/**
 * Growth opportunity detected by Opportunity Executive.
 * Distinct from Search/Content opportunities — adds leverage beyond source ownership.
 */
export type GrowthOpportunity = {
  id: string;
  type: OpportunityType;
  readiness: OpportunityReadiness;
  title: string;
  whyItMatters: string;
  recommendedAction: string;
  targetAudience: OpportunityAudience;
  geography: OpportunityGeography;
  funnelStage: OpportunityFunnelStage;
  relatedQuery?: string | null;
  relatedPage?: string | null;
  relatedContent?: string | null;
  relatedTool?: string | null;
  sourceExecutive?: "business-intelligence" | "search-strategy" | "content" | "repository";
  sourceEvidenceId?: string | null;
  verifiedMetric?: string | null;
  currentValue?: string | null;
  comparisonValue?: string | null;
  sampleSize?: number | null;
  costClass: OpportunityCostClass;
  effort: OpportunityEffortClass;
  reversibility: "easily-reversed" | "partially-reversed" | "hard-to-reverse";
  timeToSignal: "days" | "weeks" | "months" | "unknown";
  strategicFit: number; // 0–10
  founderDependence: "none" | "light" | "heavy";
  externalVerification: ExternalVerificationState;
  isInference: boolean;
  /**
   * Certainty about the diagnostic claim (e.g. “audience evidence is missing”).
   * Must not be confused with strategic attractiveness or actionability.
   */
  evidenceConfidence: number;
  /** How attractive the move would be if ready (0–10). Independent of diagnostics. */
  strategicAttractiveness: number;
  /**
   * 0–1 readiness to act. measurement-blocked / research-required / rejected stay low
   * even when evidenceConfidence is high.
   */
  actionability: number;
  /** @deprecated Prefer evidenceConfidence — kept as alias for ranking callers */
  confidence: number;
  likelyImpact: number; // 0–10 — derived from attractiveness × actionability
  urgency: "critical" | "high" | "medium" | "low";
  dependency?: string;
  approvalRequired: boolean;
  owner: string;
  supportingReference: string;
  evidenceNotes: string[];
  disqualifyingRisks: string[];
  alreadyCoveredBy?: string | null;
  /** Distinct leverage Opportunity adds beyond the source executive */
  additionalLeverage: string;
  /** True when qualification rejected this idea (retained for fixtures/tests) */
  rejected?: boolean;
  rejectionReason?: string | null;
};

/** Volume funnel counts for Opportunity detection (structured JSON transparency). */
export type OpportunityVolumeFunnel = {
  rawSignals: number;
  qualifiedFindings: number;
  rejected: number;
  alreadyCoveredOrDeferred: number;
  rankedRecommendations: number;
  surfaceEligible: number;
};
