/**
 * Founder-facing attribution recs are rare.
 * Tiny samples and ordinary GA4↔CRM count mismatch emit zero recommendations.
 * Coverage collapse on a material sample emits at most one BI integrity finding.
 */

import { proposedActionImpliesWrite } from "../../permissions";
import { buildRecommendation } from "../../recommendation";
import { createEvidence } from "../../evidence";
import type { Recommendation } from "../../types";
import { classifyAttributionPermissionTier } from "./permissions";
import {
  ATTRIBUTION_COVERAGE_INTEGRITY_ID,
  type AcceptedInquiryAttributionSnapshot,
} from "./types";

export function attributionRecommendations(
  snapshot: AcceptedInquiryAttributionSnapshot,
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation[] {
  if (!snapshot.coverageIntegrityFinding) return [];
  const rec = coverageIntegrityRecommendation(
    snapshot,
    reportingPeriod,
    collectedAt,
  );
  return rec ? [rec] : [];
}

function coverageIntegrityRecommendation(
  snapshot: AcceptedInquiryAttributionSnapshot,
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation | null {
  const action =
    "Inspect Concierge attribution capture already written at submit, then restore origin evidence on future accepted inquiries. Identity joins, acquisition-strategy changes, and CRM property work remain out of scope.";
  if (
    proposedActionImpliesWrite(action) ||
    classifyAttributionPermissionTier(action) !== "green"
  ) {
    return null;
  }

  const coverage =
    snapshot.originCoverageRate == null
      ? "n/a"
      : `${Math.round(snapshot.originCoverageRate * 100)}%`;

  const rec = buildRecommendation({
    recommendationId: ATTRIBUTION_COVERAGE_INTEGRITY_ID,
    originatingExecutive: "business-intelligence",
    title: "Accepted-inquiry origin capture coverage collapsed",
    plainLanguageExplanation: `${snapshot.explicitOriginCount} of ${snapshot.acceptedInquiryCount} reconstructed Concierge inquiries had explicit origin fields (coverage ${coverage}). This is a capture-integrity finding, not a channel ranking or a missing-lead claim.`,
    whyItMattersNow:
      "Hourglass cannot describe where accepted Concierge inquiries originated because origin fields are missing from reconstructed CRM records at a material sample.",
    proposedAction: action,
    expectedUpside:
      "Restore origin evidence on future accepted inquiries before any acquisition decision.",
    effortEstimate: "low",
    urgency: "critical",
    reversibility: "easily-reversed",
    baseConfidence: 0.75,
    evidence: [
      createEvidence({
        source: "hubspot-aggregates",
        sourceType: "crm",
        collectedAt,
        reportingPeriod,
        metricOrObservation: `accepted=${snapshot.acceptedInquiryCount} explicit=${snapshot.explicitOriginCount} unknown=${snapshot.unknownOriginCount} coverage=${coverage} sample=${snapshot.sampleStrength}`,
        reliability: "reliable",
        supportingReference: "lib/agent-os/bi/attribution",
        redactionStatus: "clean",
      }),
    ],
    assumptions: [
      "Only reconstructed Concierge inquiries are counted",
      "GA4 counts remain unjoined and are not used as identity proof",
      "Accepted inquiry is not a qualified opportunity",
    ],
    risks: [
      "Do not infer organic/social/direct from GA4 because CRM origin is unknown",
      "Do not attribute revenue or rank channels from this finding",
    ],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "Founder / engineering",
    rankingFactors: {
      expectedBusinessImpact: 8,
      strategicAlignment: 8,
    },
  });

  rec.priorityScore = Math.max(rec.priorityScore, 400_000);
  return rec;
}
