/**
 * Resilience wrappers — Client Attention failures never abort BI / CoS / brief.
 */

import type { Recommendation } from "../../types";
import type {
  BuyerConcernSignal,
  ClientActionBacklogCandidate,
  ClientAttentionAudit,
  RankedClientAttentionSignal,
} from "./types";

export type ClientAttentionRunResult = {
  audit: ClientAttentionAudit;
  recommendations: Recommendation[];
  rankedSignals: RankedClientAttentionSignal[];
  buyerConcerns: BuyerConcernSignal[];
  backlogCandidates: ClientActionBacklogCandidate[];
};

export function emptyClientAttentionAudit(
  reportingPeriod: { start: string; end: string },
  mode: "fixture" | "live" = "live",
  reason = "Client Attention unavailable",
): ClientAttentionAudit {
  const collectedAt = new Date().toISOString();
  return {
    collectedAt,
    reportingPeriod,
    mode,
    sourceAvailability: {
      gmail: "not-configured",
      hubspot: "not-configured",
      concierge: "not-configured",
    },
    signals: [],
    rankedSignals: [],
    buyerConcerns: [],
    backlogCandidates: [],
    dataGaps: [
      {
        id: "business-intelligence:client-attention:source-gap:unavailable",
        source: "cross-cutting",
        scope: reason,
        affectedAnalyses: ["client-attention"],
        founderRelevance: "diagnostic",
        resolutionPrerequisite:
          "Configure read-only Gmail/HubSpot adapters or run fixture mode.",
        suppressFromFounderRanking: true,
      },
    ],
    counts: {
      threadsInspected: 0,
      contactsInspected: 0,
      dealsInspected: 0,
      submissionsInspected: 0,
      identitiesResolved: 0,
      unresolvedIdentities: 0,
      signalsByType: {},
      suppressedSignalCount: 0,
    },
    topSignalId: null,
    facts: [],
    inferences: [reason],
    redacted: true,
    clientOpsHealth: "unknown",
    clientOpsSeverityCounts: { critical: 0, action: 0, watch: 0 },
  };
}

export function emptyClientAttentionRunResult(
  reportingPeriod: { start: string; end: string },
  mode: "fixture" | "live" = "live",
  reason?: string,
): ClientAttentionRunResult {
  return {
    audit: emptyClientAttentionAudit(reportingPeriod, mode, reason),
    recommendations: [],
    rankedSignals: [],
    buyerConcerns: [],
    backlogCandidates: [],
  };
}

export function runClientAttentionGuarded(
  run: () => ClientAttentionRunResult,
  reportingPeriod: { start: string; end: string },
  mode: "fixture" | "live",
): ClientAttentionRunResult {
  try {
    return run();
  } catch {
    return emptyClientAttentionRunResult(
      reportingPeriod,
      mode,
      "Client Attention analysis failed safely; Morning Brief continues without client pipeline items.",
    );
  }
}
