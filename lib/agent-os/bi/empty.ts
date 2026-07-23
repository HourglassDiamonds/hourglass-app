import type { BusinessIntelligenceOutput } from "../executives/business-intelligence";
import type {
  ConversionMeasurementAudit,
  OpportunityMeasurementHandoff,
} from "./types";

const EMPTY_HANDOFF: OpportunityMeasurementHandoff = {
  conversionEventVerified: false,
  conversionEventStatus: "unknown",
  authoritativeConversionEvent: "generate_lead",
  destinationMeasurable: false,
  sourceAttributionUsable: false,
  geographicSegmentationAvailable: false,
  paidSearchMeasurementPrerequisiteMissing: true,
  remarketingAudienceEvidenceAvailable: false,
  remarketingConsentEvidenceAvailable: false,
  toolEngagementObserved: false,
  toolToConciergeMeasurable: false,
  measurementPrerequisites: [],
  decisionBlockingFindingIds: [],
  decisionDegradingFindingIds: [],
  notes: ["Empty BI stub — conversion audit not executed"],
};

const EMPTY_AUDIT: ConversionMeasurementAudit = {
  expectedEvents: [],
  funnels: [],
  findings: [],
  opportunityHandoff: EMPTY_HANDOFF,
  volumeFunnel: {
    expectedEventsInventoried: 0,
    observedEvents: 0,
    notObservedEvents: 0,
    unknownEvents: 0,
    rawFindings: 0,
    qualifiedFindings: 0,
    monitorDeferredFindings: 0,
    rankedBiRecommendations: 0,
    surfacedEligibleBiRecommendations: 0,
  },
  facts: [],
  inferences: [],
  observationMode: "unavailable",
};

/** Typed empty BI output for tests / fatal live stubs. */
export function emptyBusinessIntelligenceOutput(
  note = "BI unavailable",
): BusinessIntelligenceOutput {
  const handoff: OpportunityMeasurementHandoff = {
    ...EMPTY_HANDOFF,
    notes: [note],
  };
  return {
    recommendations: [],
    anomalies: [],
    dataGaps: [],
    keyMetricChanges: [],
    facts: [],
    inferences: [],
    incompleteAttribution: false,
    conversionAudit: { ...EMPTY_AUDIT, opportunityHandoff: handoff },
    opportunityHandoff: handoff,
  };
}
