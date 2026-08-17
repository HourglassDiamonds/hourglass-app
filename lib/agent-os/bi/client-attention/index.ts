/**
 * Business Intelligence — Client Attention entrypoint.
 * Adapters gather → identity resolve → signals → rank → recommendations.
 * Recently Completed: deferred (no reliable deployment-completion source
 * without broad new persistence work).
 */

import {
  loadClientAttentionSources,
  loadClientAttentionSourcesAsync,
  type LoadClientAttentionSourcesOptions,
} from "./adapters/load";
import type { ClientAttentionSourceBundle } from "./adapters/types";
import { buildClientActionBacklogCandidates } from "./backlog-candidates";
import {
  buildSuccessFixtureSources,
  CLIENT_ATTENTION_FIXTURE_NOW,
} from "./fixtures";
import { resolveClientIdentities } from "./identity";
import { rankClientAttentionSignals } from "./ranking";
import {
  countClientOpsSeverities,
  resolveClientOpsHealth,
  selectFounderClientOpsExceptions,
  suppressClientOpsOverlappingConciergeSla,
  type ConciergeSlaOverdueIdentity,
} from "./client-ops";
import { clientAttentionToRecommendations } from "./recommendations";
import { redactClientAttentionAudit } from "./redaction";
import {
  emptyClientAttentionRunResult,
  runClientAttentionGuarded,
  type ClientAttentionRunResult,
} from "./resilience";
import { generateClientAttentionSignals } from "./signals";
import type {
  ClientAttentionAudit,
  ClientAttentionDataGap,
  ClientAttentionSignalType,
  ClientAttentionSourceAvailability,
} from "./types";
import type { ClientAttentionThresholds } from "./thresholds";
import { mergeThresholds } from "./thresholds";

export type {
  BuyerConcernSignal,
  ClientActionBacklogCandidate,
  ClientAttentionAudit,
  ClientAttentionConfidence,
  ClientAttentionDataGap,
  ClientAttentionDiscrepancyClass,
  ClientAttentionEvidenceKind,
  ClientAttentionOwner,
  ClientAttentionOwnedDomain,
  ClientAttentionSignal,
  ClientAttentionSignalType,
  ClientAttentionSourceAvailability,
  ClientAttentionSourceType,
  ClientSignalEvidence,
  RankedClientAttentionSignal,
} from "./types";

export {
  CLIENT_ATTENTION_CONFIDENCE_LEVELS,
  CLIENT_ATTENTION_DISCREPANCY_CLASSES,
  CLIENT_ATTENTION_EVIDENCE_KINDS,
  CLIENT_ATTENTION_RECOMMENDATION_PREFIX,
  CLIENT_ATTENTION_SIGNAL_TYPES,
  CLIENT_ATTENTION_SOURCE_OWNERSHIP,
  CLIENT_ATTENTION_SOURCE_TYPES,
  MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES,
  MAX_CLIENT_ATTENTION_SIGNALS,
  ownerForClientAttentionDomain,
} from "./types";

export { applyClientAttentionFounderRankingGate } from "./ranking-policy";
export { isClientAttentionRecommendationId } from "./recommendations";
export { formatClientAttentionReport, summarizeAuditJson } from "./report";
export {
  emptyClientAttentionAudit,
  emptyClientAttentionRunResult,
  runClientAttentionGuarded,
} from "./resilience";
export type { ClientAttentionRunResult } from "./resilience";
export { redactClientAttentionAudit, founderFacingTextsAreSafe, founderFacingOverstatesUnknownReply } from "./redaction";
export {
  gmailCanConfirmReplyState,
  isTerminalDeal,
  generateClientAttentionSignals,
} from "./signals";
export { DEFAULT_CLIENT_ATTENTION_THRESHOLDS, mergeThresholds } from "./thresholds";
export { buildSuccessFixtureSources, CLIENT_ATTENTION_FIXTURE_NOW } from "./fixtures";
export {
  loadClientAttentionSources,
  loadClientAttentionSourcesAsync,
} from "./adapters/load";
export { fetchHubSpotClientAttentionLive } from "./adapters/hubspot-live";
export {
  loadSharedLiveCrmForAgentOs,
  sliceHubSpotLiveBundleForLookback,
} from "./adapters/hubspot-live";
export {
  conciergeReconstructionQualityReport,
  parseConciergeDealDescription,
  reconstructConciergeFromHubSpot,
} from "./adapters/concierge-from-hubspot";
export { gmailLiveReadiness } from "./adapters/gmail";
export {
  classifyClientOpsPermissionTier,
  clientOpsMayExecute,
  CLIENT_OPS_GREEN_CAPABILITIES,
  CLIENT_OPS_YELLOW_CAPABILITIES,
  CLIENT_OPS_RED_CAPABILITIES,
} from "./permissions";
export {
  V1_CLIENT_OPS_SIGNAL_TYPES,
  HUBSPOT_V1_CLIENT_OPS_SIGNAL_TYPES,
  GMAIL_DEPENDENT_CLIENT_OPS_SIGNAL_TYPES,
  CLIENT_OPS_HEALTH_STATES,
  CLIENT_OPS_SEVERITIES,
  isV1ClientOpsSignalType,
  isHubSpotV1ClientOpsSignalType,
  isGmailDependentClientOpsSignalType,
  hubSpotLiveCanProveInboundWithoutLaterReply,
  gmailLiveCanConfirmReplyState,
  severityForClientOpsSignal,
  selectFounderClientOpsExceptions,
  resolveClientOpsHealth,
  clientAttentionSignalOverlapsConciergeSla,
  founderFacingContainsDisallowedAmount,
} from "./client-ops";
export type {
  ClientOpsHealth,
  ClientOpsSeverity,
  ConciergeSlaOverdueIdentity,
  ClientOpsSeverityCounts,
} from "./client-ops";
export {
  injectUrgentClientOpsIntoSurfacePool,
  isUrgentClientOpsRecommendation,
} from "./cos-escalation";

export type ClientAttentionFixturePreset =
  | "success"
  | "gmail-failure"
  | "hubspot-failure"
  | "both-failure"
  | "recovery";

export type RunClientAttentionAnalysisInput = {
  mode: "fixture" | "live";
  nowIso?: string;
  reportingPeriod: { start: string; end: string };
  thresholds?: Partial<ClientAttentionThresholds>;
  sourceOverrides?: Partial<LoadClientAttentionSourcesOptions>;
  /** Prefetched live/fixture bundle — skips adapter load when provided. */
  prefetchedSources?: ClientAttentionSourceBundle;
  fixturePreset?: ClientAttentionFixturePreset;
  /**
   * Overdue Concierge SLA identities (deal/contact/submission ids only).
   * When the same object is already a first-contact SLA exception, Client Ops
   * suppresses the duplicate founder action.
   */
  conciergeSlaOverdueIdentities?: ConciergeSlaOverdueIdentity[];
};

export function runClientAttentionAnalysis(
  input: RunClientAttentionAnalysisInput,
): ClientAttentionRunResult {
  return runClientAttentionGuarded(
    () => runClientAttentionAnalysisUnsafe(input),
    input.reportingPeriod,
    input.mode,
  );
}

/**
 * Live path: async HubSpot CRM reads + Concierge reconstruction, then sync analysis.
 * Never fabricates fixtures in live mode.
 */
export async function runClientAttentionAnalysisAsync(
  input: RunClientAttentionAnalysisInput,
): Promise<ClientAttentionRunResult> {
  try {
    if (input.prefetchedSources) {
      return runClientAttentionAnalysis(input);
    }
    const nowIso =
      input.nowIso ??
      (input.mode === "fixture"
        ? CLIENT_ATTENTION_FIXTURE_NOW
        : new Date().toISOString());
    const thresholds = mergeThresholds(input.thresholds);
    const preset =
      input.fixturePreset ?? (input.mode === "fixture" ? "success" : undefined);
    const loadOpts = buildLoadOptions(
      input.mode,
      preset,
      input.sourceOverrides,
      nowIso,
      thresholds,
    );
    const prefetchedSources = await loadClientAttentionSourcesAsync(loadOpts);
    return runClientAttentionAnalysis({ ...input, prefetchedSources, nowIso });
  } catch {
    return emptyClientAttentionRunResult(
      input.reportingPeriod,
      input.mode,
      "Client Attention analysis failed safely; Morning Brief continues without client pipeline items.",
    );
  }
}

function runClientAttentionAnalysisUnsafe(
  input: RunClientAttentionAnalysisInput,
): ClientAttentionRunResult {
  if (input.mode === "live" && input.fixturePreset && input.fixturePreset !== "recovery") {
    // Live refuses fixture presets except documenting recovery semantics via live adapters.
  }

  const nowIso =
    input.nowIso ??
    (input.mode === "fixture" ? CLIENT_ATTENTION_FIXTURE_NOW : new Date().toISOString());
  const thresholds = mergeThresholds(input.thresholds);
  const preset = input.fixturePreset ?? (input.mode === "fixture" ? "success" : undefined);

  const loadOpts = buildLoadOptions(input.mode, preset, input.sourceOverrides, nowIso, thresholds);
  const bundle =
    input.prefetchedSources ?? loadClientAttentionSources(loadOpts);

  const identityResult = resolveClientIdentities(bundle);
  const generated = generateClientAttentionSignals({
    bundle,
    identities: identityResult.identities,
    nowIso,
    thresholds,
  });
  const signals = suppressClientOpsOverlappingConciergeSla(
    generated.signals,
    input.conciergeSlaOverdueIdentities,
  );
  const rankedSignals = rankClientAttentionSignals(signals);
  const sourceAvailability = toAvailability(bundle);
  const severityCounts = countClientOpsSeverities(
    rankedSignals,
    sourceAvailability.gmail,
  );
  const clientOpsHealth = resolveClientOpsHealth({
    hubspotAvailability: sourceAvailability.hubspot,
    actionableCount:
      severityCounts.critical + severityCounts.action,
  });
  const founderExceptions = selectFounderClientOpsExceptions(
    rankedSignals,
    clientOpsHealth,
    undefined,
    sourceAvailability.gmail,
  );
  const recommendations = clientAttentionToRecommendations(
    founderExceptions,
    input.reportingPeriod,
    nowIso,
  );
  const backlogCandidates = buildClientActionBacklogCandidates(
    founderExceptions,
  );

  const dataGaps = buildDataGaps(
    sourceAvailability,
    identityResult.possibleDuplicatePairs.length,
    preset,
  );

  const signalsByType: Partial<Record<ClientAttentionSignalType, number>> = {};
  for (const s of signals) {
    signalsByType[s.signalType] = (signalsByType[s.signalType] ?? 0) + 1;
  }

  const facts: string[] = [];
  const inferences: string[] = [];
  if (clientOpsHealth === "exceptions" && founderExceptions[0]) {
    facts.push(
      `Top client attention: ${founderExceptions[0].signal.displayName} — ${founderExceptions[0].signal.signalType}.`,
    );
  }
  if (clientOpsHealth === "unknown") {
    inferences.push(
      "Client Ops is UNKNOWN because HubSpot CRM evidence was unavailable; this is not a finding of zero client issues.",
    );
  }
  if (
    clientOpsHealth !== "unknown" &&
    (sourceAvailability.gmail === "not-configured" ||
      sourceAvailability.gmail === "failed")
  ) {
    inferences.push(
      "Gmail client-thread checks were incomplete; HubSpot/Concierge may still contribute.",
    );
  }
  if (preset === "recovery") {
    facts.push("Client Attention recovered on this run; prior source failures cleared.");
  }

  const auditRaw: ClientAttentionAudit = {
    collectedAt: nowIso,
    reportingPeriod: input.reportingPeriod,
    mode: input.mode,
    sourceAvailability,
    signals,
    rankedSignals,
    buyerConcerns: generated.buyerConcerns,
    backlogCandidates,
    dataGaps,
    counts: {
      threadsInspected: bundle.gmail.recordCount,
      contactsInspected: bundle.hubspot.contacts.length,
      dealsInspected: bundle.hubspot.deals.length,
      submissionsInspected: bundle.concierge.submissions.length,
      identitiesResolved: identityResult.resolvedCount,
      unresolvedIdentities: identityResult.unresolvedCount,
      signalsByType,
      suppressedSignalCount: generated.suppressedCount,
    },
    topSignalId: rankedSignals[0]?.signal.id ?? null,
    facts,
    inferences,
    redacted: false,
    clientOpsHealth,
    clientOpsSeverityCounts: severityCounts,
  };

  const audit = redactClientAttentionAudit(auditRaw);

  return {
    audit,
    recommendations,
    rankedSignals: audit.rankedSignals,
    buyerConcerns: audit.buyerConcerns,
    backlogCandidates: audit.backlogCandidates,
  };
}

function buildLoadOptions(
  mode: "fixture" | "live",
  preset: ClientAttentionFixturePreset | undefined,
  overrides: Partial<LoadClientAttentionSourcesOptions> | undefined,
  nowIso: string,
  thresholds: ClientAttentionThresholds,
): LoadClientAttentionSourcesOptions {
  const success = buildSuccessFixtureSources();
  const base: LoadClientAttentionSourcesOptions = {
    mode,
    nowIso,
    thresholds,
    gmail: { threads: mode === "fixture" ? success.threads : undefined },
    hubspot: {
      contacts: mode === "fixture" ? success.contacts : undefined,
      deals: mode === "fixture" ? success.deals : undefined,
      tasks: mode === "fixture" ? success.tasks : undefined,
    },
    concierge: {
      submissions: mode === "fixture" ? success.submissions : undefined,
    },
  };

  if (mode === "fixture" && preset) {
    switch (preset) {
      case "success":
      case "recovery":
        break;
      case "gmail-failure":
        base.gmail = { forceStatus: "failed" };
        break;
      case "hubspot-failure":
        base.hubspot = { forceStatus: "failed" };
        break;
      case "both-failure":
        base.gmail = { forceStatus: "failed" };
        base.hubspot = { forceStatus: "failed" };
        base.concierge = { forceStatus: "failed" };
        break;
    }
  }

  return {
    ...base,
    ...overrides,
    mode,
    nowIso,
    thresholds,
    gmail: { ...base.gmail, ...overrides?.gmail },
    hubspot: { ...base.hubspot, ...overrides?.hubspot },
    concierge: { ...base.concierge, ...overrides?.concierge },
  };
}

function toAvailability(
  bundle: ClientAttentionSourceBundle,
): ClientAttentionSourceAvailability {
  return {
    gmail: bundle.gmail.status === "fixture" ? "fixture" : bundle.gmail.status,
    hubspot:
      bundle.hubspot.status === "fixture" ? "fixture" : bundle.hubspot.status,
    concierge:
      bundle.concierge.status === "fixture"
        ? "fixture"
        : bundle.concierge.status === "not-configured"
          ? "via-hubspot"
          : bundle.concierge.status === "ok"
            ? "ok"
            : bundle.concierge.status,
  };
}

function buildDataGaps(
  availability: ClientAttentionSourceAvailability,
  duplicatePairCount: number,
  preset?: ClientAttentionFixturePreset,
): ClientAttentionDataGap[] {
  const gaps: ClientAttentionDataGap[] = [];

  if (availability.gmail === "failed" || availability.gmail === "not-configured") {
    gaps.push({
      id: "business-intelligence:client-attention:source-gap:gmail",
      source: "gmail",
      scope:
        availability.gmail === "failed"
          ? "Gmail follow-up checks did not complete."
          : "Gmail read-only access is not configured.",
      affectedAnalyses: ["unanswered-inbound", "reply-overdue"],
      founderRelevance: "diagnostic",
      resolutionPrerequisite:
        "Add gmail.readonly scope and AGENT_OS_GMAIL_USER, then enable the live adapter.",
      suppressFromFounderRanking: true,
    });
  }

  if (availability.hubspot === "failed" || availability.hubspot === "not-configured") {
    gaps.push({
      id: "business-intelligence:client-attention:source-gap:hubspot",
      source: "hubspot",
      scope:
        availability.hubspot === "failed"
          ? "HubSpot CRM reads did not complete."
          : "HubSpot CRM read adapter is not live-connected.",
      affectedAnalyses: ["follow-up-due", "stalled-conversation", "deal-stage-risk"],
      founderRelevance: "diagnostic",
      resolutionPrerequisite:
        "Confirm crm.objects.contacts.read and crm.objects.deals.read, then enable the live read adapter.",
      suppressFromFounderRanking: true,
    });
  }

  if (
    (availability.gmail === "failed" || availability.gmail === "not-configured") &&
    (availability.hubspot === "failed" || availability.hubspot === "not-configured")
  ) {
    gaps.push({
      id: "business-intelligence:client-attention:source-gap:pipeline-incomplete",
      source: "cross-cutting",
      scope:
        "Client pipeline intelligence was incomplete this morning because HubSpot and Gmail data were unavailable.",
      affectedAnalyses: ["client-attention"],
      founderRelevance: "diagnostic",
      resolutionPrerequisite: "Restore at least one client data source.",
      suppressFromFounderRanking: true,
    });
  }

  if (duplicatePairCount > 0) {
    gaps.push({
      id: "business-intelligence:client-attention:source-gap:possible-duplicates",
      source: "hubspot",
      scope: "Possible duplicate HubSpot contacts may represent one person.",
      affectedAnalyses: ["identity-resolution"],
      founderRelevance: "diagnostic",
      resolutionPrerequisite: "Review duplicate contacts before merging CRM records.",
      suppressFromFounderRanking: true,
    });
  }

  if (preset === "recovery") {
    // Recovery run clears prior failure messaging by not forcing failures.
  }

  return gaps;
}
