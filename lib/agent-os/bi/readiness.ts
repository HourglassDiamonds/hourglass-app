/**
 * Opportunity-facing measurement handoff.
 * BI reports prerequisites — Opportunity retains growth ownership; BI does not launch ads.
 */

import { AUTHORITATIVE_CONVERSION_EVENT } from "./expected-events";
import { getEventCount, resolveObservedStatus } from "./observe";
import { isConciergeConversionClusterFinding } from "./recommendations";
import {
  CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
  type BiConversionObservationBundle,
  type ExpectedEventInventoryItem,
  type MeasurementFinding,
  type OpportunityMeasurementHandoff,
} from "./types";

export function buildOpportunityMeasurementHandoff(input: {
  inventory: ExpectedEventInventoryItem[];
  findings: MeasurementFinding[];
  observations: BiConversionObservationBundle | null;
}): OpportunityMeasurementHandoff {
  const { inventory, findings, observations } = input;
  const lead = inventory.find(
    (e) => e.expectedEventName === AUTHORITATIVE_CONVERSION_EVENT,
  );
  const conversionEventStatus = lead?.observedStatus ?? "unknown";
  const conversionEventVerified = conversionEventStatus === "observed";

  const decisionBlocking = findings.filter(
    (f) => f.decisionEffect === "decision-blocking",
  );
  const decisionDegrading = findings.filter(
    (f) => f.decisionEffect === "decision-degrading",
  );

  const destinationMeasurable = Boolean(
    observations?.landingPages.some(
      (p) =>
        p.value.includes("/concierge") ||
        p.value.includes("/diamond-studio") ||
        p.value.includes("/diamond-shape-studio") ||
        p.value.includes("/diamond-guide") ||
        p.value.includes("/diamond-intelligence"),
    ),
  );

  const toolEngagementObserved =
    resolveObservedStatus("studio_session_engaged", observations) ===
      "observed" ||
    (getEventCount(observations, "diamond_studio_view") ?? 0) > 0;

  const toolToConciergeMeasurable =
    resolveObservedStatus("consultation_cta_clicked", observations) ===
      "observed" && conversionEventVerified;

  const sourceAttributionUsable =
    (observations?.channelGroups.length ?? 0) > 0 &&
    !findings.some(
      (f) =>
        (f.type === "source-medium-anomaly" ||
          f.type === "direct-traffic-overconcentration") &&
        f.decisionEffect !== "monitor" &&
        !f.suppressRecommendation,
    );

  const hasConciergeCluster = findings.some(isConciergeConversionClusterFinding);
  const paidSearchMeasurementPrerequisiteMissing =
    !conversionEventVerified ||
    decisionBlocking.some((f) => f.blocksOtherExecutive) ||
    hasConciergeCluster;

  const measurementPrerequisites = hasConciergeCluster
    ? [CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID]
    : decisionBlocking.filter((f) => f.blocksOtherExecutive).map((f) => f.id);

  const notes: string[] = [
    `Conversion candidate ${AUTHORITATIVE_CONVERSION_EVENT} status=${conversionEventStatus} (candidate — not assumed sole correct key event)`,
    "BI owns measurement repair; Opportunity references BI prerequisites without duplicating founder-facing repair recs",
    "BI does not recommend or launch ads",
    "Remarketing audience/consent evidence is unavailable in Agent OS V1",
  ];

  if (paidSearchMeasurementPrerequisiteMissing) {
    notes.push(
      "Paid-search readiness blocked on BI conversion measurement prerequisite",
    );
  }
  if (toolEngagementObserved && !toolToConciergeMeasurable) {
    notes.push(
      "Tool engagement observed but tool→Concierge conversion path not fully measurable",
    );
  }

  return {
    conversionEventVerified,
    conversionEventStatus,
    authoritativeConversionEvent: AUTHORITATIVE_CONVERSION_EVENT,
    destinationMeasurable,
    sourceAttributionUsable,
    geographicSegmentationAvailable: false,
    paidSearchMeasurementPrerequisiteMissing,
    remarketingAudienceEvidenceAvailable: false,
    remarketingConsentEvidenceAvailable: false,
    toolEngagementObserved,
    toolToConciergeMeasurable,
    measurementPrerequisites,
    decisionBlockingFindingIds: decisionBlocking.map((f) => f.id),
    decisionDegradingFindingIds: decisionDegrading.map((f) => f.id),
    notes,
  };
}
