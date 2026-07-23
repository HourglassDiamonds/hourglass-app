/**
 * Content Executive typed contracts — opportunities and content evidence fields.
 */

export const CONTENT_OPPORTUNITY_TYPES = [
  "founder-conversation-topic",
  "follow-up-conversation",
  "short-form-clip",
  "carousel-opportunity",
  "caption-opportunity",
  "guide-to-video-opportunity",
  "video-to-guide-handoff",
  "video-to-tool-handoff",
  "video-to-concierge-handoff",
  "search-demand-content",
  "local-authority-content",
  "faq-content",
  "objection-handling-content",
  "trust-building-content",
  "expertise-proof-content",
  "message-coverage-gap",
  "message-saturation-risk",
  "repurposing-gap",
  "sequence-gap",
  "channel-fit-gap",
  "content-measurement-gap",
  "stale-content-plan",
  "duplicate-topic-risk",
] as const;

export type ContentOpportunityType = (typeof CONTENT_OPPORTUNITY_TYPES)[number];

export type ContentFormat =
  | "founder-conversation"
  | "short-form-clip"
  | "carousel"
  | "caption"
  | "quote-graphic"
  | "faq-extraction"
  | "newsletter-section"
  | "guide-enhancement";

export type ContentFunnelStage =
  | "awareness"
  | "consideration"
  | "decision"
  | "trust"
  | "post-purchase";

export type ContentAudience =
  | "engagement-buyers"
  | "self-purchasers"
  | "local-charlotte"
  | "returning-researchers"
  | "founders-peers";

export type ContentOpportunity = {
  id: string;
  type: ContentOpportunityType;
  title: string;
  whyItMatters: string;
  recommendedAction: string;
  recommendedFormat: ContentFormat;
  formatRationale: string;
  topicOrItem: string;
  targetAudience: ContentAudience;
  funnelStage: ContentFunnelStage;
  sourceMaterial: string;
  relatedGuide?: string | null;
  relatedTool?: string | null;
  relatedConcierge?: string | null;
  supportingIdeaAreas?: string[];
  ownableLines?: string[];
  hookDirection?: string;
  audienceQuestion?: string;
  clipTerritories?: string[];
  /**
   * Narrative/planning order vs verified operational publish order.
   * Only set `verifiedPublishingSequence` when publicationState is verified.
   */
  sequenceKind?: "recommendedNarrativeSequence" | "verifiedPublishingSequence";
  confidence: number;
  likelyImpact: number;
  effort: "low" | "medium" | "high";
  urgency: "critical" | "high" | "medium" | "low";
  dependency?: string;
  approvalRequired: boolean;
  supportingReference: string;
  evidenceNotes: string[];
  /** True when performance is inferred rather than measured */
  performanceInferred: boolean;
  isInference: boolean;
  brandFitOk: boolean;
  brandFitNotes: string[];
};
