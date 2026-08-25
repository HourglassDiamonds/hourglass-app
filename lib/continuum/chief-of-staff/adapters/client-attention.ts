/**
 * Client Attention → SpecialistObservation.
 * Consumes specialist output. Does not crawl HubSpot.
 */

import {
  isActionableClientOpsSeverity,
  isGmailDependentClientOpsSignalType,
  gmailLiveCanConfirmReplyState,
  severityForClientOpsSignal,
  type ClientOpsHealth,
} from "@/lib/agent-os/bi/client-attention/client-ops";
import type {
  ClientAttentionSignal,
  ClientAttentionSourceAvailability,
} from "@/lib/agent-os/bi/client-attention/types";
import type { SpecialistObservation } from "../types";

export type ClientAttentionAdapterInput = {
  clientOpsHealth: ClientOpsHealth;
  hubspotAvailability: ClientAttentionSourceAvailability["hubspot"];
  gmailAvailability: ClientAttentionSourceAvailability["gmail"];
  signals: ClientAttentionSignal[];
  observedAt: string;
};

function observationKind(signalType: ClientAttentionSignal["signalType"]): string {
  if (signalType === "follow-up-due") return "client-follow-up-due";
  if (signalType === "stalled-conversation") return "client-stalled";
  if (signalType === "missing-next-step") return "client-missing-next-step";
  if (signalType === "new-inquiry" || signalType === "new-inquiry-needs-review") {
    return "client-new-inquiry";
  }
  return `client-${signalType}`;
}

function sourceHealthAdequate(
  hubspot: ClientAttentionSourceAvailability["hubspot"],
  health: ClientOpsHealth,
): boolean {
  if (health === "unknown") return false;
  if (hubspot === "failed" || hubspot === "not-configured") return false;
  return true;
}

export function observationsFromClientAttention(
  input: ClientAttentionAdapterInput,
): SpecialistObservation[] {
  if (!sourceHealthAdequate(input.hubspotAvailability, input.clientOpsHealth)) {
    return [];
  }
  if (input.clientOpsHealth === "healthy") return [];

  const gmailOk = gmailLiveCanConfirmReplyState(input.gmailAvailability);
  const out: SpecialistObservation[] = [];

  for (const signal of input.signals) {
    if (signal.founderRankable === false) continue;
    if (isGmailDependentClientOpsSignalType(signal.signalType) && !gmailOk) {
      continue;
    }
    const severity = severityForClientOpsSignal(signal);
    if (!isActionableClientOpsSeverity(severity)) continue;

    const audience =
      signal.urgency === "critical" || signal.urgency === "high"
        ? "urgent-founder-action"
        : "founder-action";
    const urgencyHint =
      signal.urgency === "critical" ? "now" : signal.urgency === "high" ? "today" : "today";

    out.push({
      specialist: "client-attention",
      kind: observationKind(signal.signalType),
      subject: {},
      summary: signal.recommendedAction || signal.summary,
      whyItMatters: signal.whyItMatters,
      recommendedAction: signal.recommendedAction,
      epistemicClass: "observed",
      importanceHint: severity === "critical" ? "high" : "medium",
      urgencyHint,
      audienceHint: audience,
      confidence: signal.confidence,
      evidenceIds: signal.evidence.map((row) => row.id),
      observationIds: [],
      observedAt: input.observedAt,
      dedupeKey: `client-attention:${signal.signalType}:${signal.subjectKey}`,
      changeClass: "novel",
    });
  }

  return out;
}
