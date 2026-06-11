export {
  assessReportCapability,
  assessReportCapabilityFromFinalized,
  BASIC_READ_KEYS,
  DEEP_LIGHT_KEYS,
  CLIENT_GUIDED_COMPLETION_KEYS,
  EXPERT_DIAGRAM_FIELD_KEYS,
  GUIDED_COMPLETION_KEYS,
  PROPORTION_REVIEW_KEYS,
  type ReportCapability,
  type ReportCapabilityInput,
} from "./report-capability";
export {
  CLIENT_CULET_OPTIONS,
  CLIENT_GIRDLE_OPTIONS,
  assessSuspiciousProportionCombinations,
  isClientManualFieldKey,
  validateClientManualField,
  type ClientManualFieldKey,
  type ManualFieldValidationResult,
} from "./manual-field-validation";
export {
  assertClientSnapshotNotCalibrationCanonical,
  buildClientInterpretationSnapshot,
  interpretationLevelLabel,
  type BuildClientInterpretationInput,
} from "./client-interpretation-record";
export { CLIENT_FIELD_HINTS, CLIENT_FIELD_LABELS } from "./client-field-labels";
export {
  CLIENT_UPLOAD_INTERPRET_ERROR,
  postReportForInterpretation,
  type InterpretApiPayload,
} from "./client-upload";
export {
  CLIENT_DISPLAY_FIELD_KEYS,
  reassessClientCapability,
  toClientSafeInterpretationPayload,
  type ClientSafeInterpretationPayload,
  type ClientSafeMetadata,
  type ClientReportFormat,
  type ClientSafeReportCapability,
} from "./client-api";
export {
  buildClientDiamondDecisionProfile,
} from "./client-decision-profile";
export {
  buildDiamondDecisionProfile,
  classifyProportionArchetype,
  type DiamondDecisionProfile,
  type DecisionDimension,
  type OverallRecommendationBand,
  type OpticalPerformanceBand,
  type RiskProfileBand,
  type VisualPresenceBand,
} from "./diamond-decision-profile";
export { buildDecisionConfidence, type DecisionConfidenceBand } from "./decision-profile-confidence";
export {
  buildVisualPersonality,
  consumerTitleForArchetype,
  type VisualPersonality,
  type VisualPersonalityArchetype,
} from "./visual-personality";
export {
  buildClarityReviewGuidance,
  type ClarityReviewGuidance,
} from "./clarity-review-guidance";
export {
  HOURGLASS_CLARITY_STANDARDS,
  hourglassClarityStandardsNote,
  isBelowHourglassClarityStandard,
} from "./hourglass-clarity-standards";
export {
  colorPreferenceImpact,
  colorPreferenceImpactLabel,
  colorPreferenceProfileLabel,
  formatColorForSummary,
  isLowColorGrade,
  isWarmMarketColor,
  suppressesBroadPercentileForColor,
  warmColorPreferenceContextCopy,
  WARM_COLOR_PREFERENCE_CONTEXT_COPY,
  worstColorLetterIndex,
  type ColorPreferenceImpact,
} from "./color-grade-policy";
export {
  buildPurchaseConstrainedOpticalDetail,
  isPurchaseRecommendationEligibleForBroadPercentile,
  presentPurchaseRecommendationLabel,
  purchaseRecommendationBlocksPremiumHeroHeadline,
  resolvePurchaseRecommendationLabel,
  type PurchaseRecommendationLabel,
} from "./purchase-recommendation-presentation";
export {
  HOURGLASS_EXCLUDED_CLARITY_CONSUMER_MESSAGE,
  HOURGLASS_EXCLUDED_CLARITY_HEADLINE,
  HOURGLASS_EXCLUDED_SPECTRUM_STATUS,
  SI2_INSPECTION_REQUIRED_MESSAGE,
  SI2_PRESENTATION_TIER_CEILING,
  resolveHourglassClarityPolicy,
  type HourglassClarityDisplayPolicy,
} from "./hourglass-clarity-policy";
export {
  buildDiamondPurchasePersonality,
  IDENTITY_TRANSLATIONS,
  translationForIdentityLabel,
  type DiamondPurchasePersonality,
  type DiamondIdentityLabel,
  type DiamondPurchasePersonalityTone,
} from "./diamond-purchase-personality";
export {
  derivePrimaryLimitingFactor,
  type PrimaryLimitingFactor,
  type PrimaryLimitingFactorKey,
} from "./primary-limiting-factor";
export {
  parseReportGradeHints,
  claritySeverity,
  type ReportGradeHints,
} from "./report-grade-hints";
export {
  opticalBalanceDisplayValue,
  presentClientInterpretationScore,
  type ClientInterpretationScore,
  type ClientLightTrait,
} from "./client-score-present";
export {
  CONSUMER_TRAIT_UNCERTAIN_HELPER,
  getConsumerLightPerformanceDisplay,
  getConsumerLightPerformanceLabel,
  type ConsumerLightPerformanceDisplay,
} from "./client-light-performance-labels";
export {
  ESTIMATED_COMPARISON_BAND_CAPTION,
  formatTraitReadDisplay,
  presentConfidenceAdjustedRead,
  presentOverallReadLabel,
  presentTraitReadLabel,
  type ConfidenceAdjustedRead,
  type OverallReadLabel,
  type OverallReadPresentation,
  type RareTopPill,
  type TraitCalmLabel,
  type TraitDisplayLabel,
  type TraitLabelContext,
  type TraitReadLabel,
} from "./client-percentile-present";
export {
  buildClientInterpretationConfidence,
  type ClientInterpretationConfidence,
  type ClientInterpretationConfidenceLevel,
} from "./client-interpretation-confidence";
export {
  buildClientReadState,
  type ClientReadState,
  type ClientReadStateKind,
} from "./client-read-state";
export {
  buildDiamondInterpretationContext,
  type DiamondCopyTone,
  type DiamondGraphMode,
  type DiamondInterpretationContext,
  type DiamondTraitMode,
} from "./client-interpretation-context";
export {
  assessExtractionCompleteness,
  SCORE_ELIGIBLE_CORE_KEYS,
  DEEP_OPTICAL_KEYS,
  toExtractionCompletenessSummary,
  type ExtractionCompleteness,
  type ExtractionCompletenessSummary,
  type ExtractionState,
} from "./extraction-completeness";
export {
  buildFaceUpPresenceCopy,
  buildOpticalCharacterCopy,
  buildOpticalInterpretationSummary,
  buildPerformanceReadCopy,
  type FaceUpPresenceCopy,
  type PerformanceReadCopy,
} from "./client-performance-copy";
export {
  editorialFaceUpSummary,
  editorialLightPerformancePersonality,
  editorialTierFromInternalLabel,
  editorialTierFromOverallLabel,
  presentEditorialLightPerformance,
  resolveEditorialFaceUpTier,
  type EditorialFaceUpTier,
  type EditorialLightPerformancePresentation,
  type EditorialLightPerformanceTier,
} from "./client-editorial-language";
export {
  buildBalanceProfileAxes,
  centerQualitativeLabel,
  confidenceCenterLabel,
  referenceEnvelopeRadius,
  spreadProfileValue,
  type ProfileAxis,
  type ProfileAxisKey,
} from "./client-balance-profile";
export type {
  ClientFieldAttribution,
  ClientInterpretationLevel,
  ClientInterpretationNextStep,
  ClientInterpretationSnapshot,
} from "./types";
