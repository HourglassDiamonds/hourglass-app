/**
 * Content ROI Prioritization — typed contracts.
 * Editorial intelligence for Content Executive (not a new executive).
 * Dimension scores and overall ROI use 0–100 (fan-out convention).
 */

import type { AudienceStage, QueryFamily } from "../../search/fan-out/types";
import type { ReservedConversationCycle } from "../editorial-sequence";
import type { PlannedConversationTopic } from "../editorial-sequence";

export type { ReservedConversationCycle, PlannedConversationTopic };

export const CONTENT_ROI_PRIMARY_FORMATS = [
  "conversation",
  "a-matter-of-taste",
  "diamond-guide-flagship",
  "faq-cluster",
  "short-form-series",
  "carousel",
  "newsletter",
  "sales-support",
  "concierge-explainer",
  "local-landing-enhancement",
  "post-purchase-guide",
] as const;

export type ContentRoiPrimaryFormat =
  (typeof CONTENT_ROI_PRIMARY_FORMATS)[number];

export const CONTENT_ROI_TOPIC_KINDS = [
  "flagship-cluster",
  "standalone-high-value",
  "supporting-faq",
  "short-form-only",
  "taste-only",
  "sales-enablement",
  "local-conversion",
  "post-purchase-education",
] as const;

export type ContentRoiTopicKind = (typeof CONTENT_ROI_TOPIC_KINDS)[number];

/** Recalibratable weights — must sum to 1.0. */
export type ContentRoiWeights = {
  salesInfluence: number;
  brandDifferentiation: number;
  searchDiscovery: number;
  crossChannelLeverage: number;
  conversationPotential: number;
  strategicUrgency: number;
  shortFormPotential: number;
  evergreenValue: number;
  productionEfficiency: number;
  /** Conditional / optional — kept low so Taste is not dominant */
  tastePotential: number;
};

export type ContentRoiDimensionKey = keyof ContentRoiWeights;

export type ContentRoiDimensionScores = Record<ContentRoiDimensionKey, number>;

export type ContentRoiScoreBreakdown = {
  dimensions: ContentRoiDimensionScores;
  weights: ContentRoiWeights;
  weightedContribution: ContentRoiDimensionScores;
  overall: number;
  reasons: string[];
  evidence: string[];
};

export type ContentRoiQuestionAssessment = {
  questionId: string;
  canonicalQuestion: string;
  queryFamily: QueryFamily;
  audienceStage: AudienceStage;
  coverageScore: number;
  coverageBand: "fully-covered" | "partially-covered" | "uncovered";
  commercialValue: number;
  authorityValue: number;
  gapClusterId: string | null;
  scores: ContentRoiScoreBreakdown;
  topicKindHint: ContentRoiTopicKind;
  primaryFormat: ContentRoiPrimaryFormat;
  supportingFormats: ContentRoiPrimaryFormat[];
  inappropriateFormats: ContentRoiPrimaryFormat[];
};

export type ContentRoiEditorialPackage = {
  id: string;
  workingTitle: string;
  coreBuyerQuestion: string;
  centralTension: string;
  whyItMattersToBuyer: string;
  whyItMattersToHourglass: string;
  primaryFormat: ContentRoiPrimaryFormat;
  supportingFormats: ContentRoiPrimaryFormat[];
  inappropriateFormats: ContentRoiPrimaryFormat[];
  topicKind: ContentRoiTopicKind;
  supportingQuestionAngles: string[];
  shortFormHooks: string[];
  tasteAngle: string | null;
  articleOrFaqOpportunity: string;
  newsletterAngle: string;
  salesUseAngle: string;
  productionEffort: "low" | "medium" | "high";
  overallRoi: number;
  scoreBreakdown: ContentRoiScoreBreakdown;
  relatedQuestionIds: string[];
  gapClusterId: string | null;
  queryFamilies: QueryFamily[];
  reasoningSummary: string;
  /** True when this package is one of the reserved Conversation cycles */
  reservedSequence: boolean;
  reservedPosition: number | null;
};

export type ContentRoiSequenceSlot = {
  order: number;
  packageId: string;
  workingTitle: string;
  primaryFormat: ContentRoiPrimaryFormat;
  overallRoi: number;
  reserved: boolean;
  balanceTag:
    | "emotional-decision"
    | "practical-buying"
    | "diamond-expertise"
    | "brand-worldview"
    | "humor-commentary"
    | "local-concierge"
    | "post-purchase";
};

export type ContentRoiBacklogCandidate = {
  id: string;
  title: string;
  primaryFormat: ContentRoiPrimaryFormat;
  relatedCanonicalQuestions: string[];
  overallRoi: number;
  productionEffort: "low" | "medium" | "high";
  reservedSequencePosition: number | null;
  status: "reserved" | "ranked-ready" | "evidence-needed" | "faq-only" | "sales-support-only";
  prerequisite: string | null;
  nextAction: string;
  packageId: string;
};

export type ContentRoiStatus = "ok" | "unavailable" | "failed";

export type ContentRoiFailureStage =
  | "fan-out-input"
  | "question-scoring"
  | "cluster-consolidation"
  | "package-building"
  | "sequencing"
  | "unknown";

export type ContentRoiErrorCategory =
  | "fan-out-input"
  | "question-scoring"
  | "cluster-consolidation"
  | "package-building"
  | "sequencing"
  | "unexpected";

export type ContentRoiDegradation = {
  errorCategory: ContentRoiErrorCategory;
  failedStage: ContentRoiFailureStage;
  safeMessage: string;
  recommendationsSuppressed: true;
};

export type ContentRoiInternalEvent = {
  at: string;
  level: "info" | "warn" | "error";
  category: ContentRoiErrorCategory | "ok" | "unavailable";
  stage: ContentRoiFailureStage | null;
  message: string;
};

export type ContentRoiSnapshot = {
  status: ContentRoiStatus;
  completedAt: string | null;
  degradation: ContentRoiDegradation | null;
  internalEvents: ContentRoiInternalEvent[];
  weights: ContentRoiWeights;
  questionAssessments: ContentRoiQuestionAssessment[];
  packages: ContentRoiEditorialPackage[];
  top10Packages: ContentRoiEditorialPackage[];
  top25Topics: ContentRoiEditorialPackage[];
  reservedCycles: ReservedConversationCycle[];
  postSequenceOrder: ContentRoiSequenceSlot[];
  fullSequenceOrder: ContentRoiSequenceSlot[];
  faqOnly: ContentRoiQuestionAssessment[];
  salesSupportOnly: ContentRoiQuestionAssessment[];
  lowRoiUncovered: ContentRoiQuestionAssessment[];
  evidenceNeeded: ContentRoiQuestionAssessment[];
  backlogCandidates: ContentRoiBacklogCandidate[];
  founderFacingPackages: ContentRoiEditorialPackage[];
  /** Canonical sequence source note (no conflicting pipelines) */
  editorialSequenceNote: string;
  /** Older planned themes preserved as reserve-backlog */
  reserveBacklogTopics: PlannedConversationTopic[];
  facts: string[];
  inferences: string[];
};
