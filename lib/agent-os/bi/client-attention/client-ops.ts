/**
 * Client Ops overlay on the existing Client Attention specialist.
 * Lives under Business Intelligence. Not a sixth executive. Not a CRM.
 *
 * V1 question: is there a real client / inquiry that needs founder attention now?
 * HubSpot-only. Consumes the shared per-run CRM reconstruction.
 */

import type { ConciergeSlaOverdueIdentity } from "@/lib/concierge/sla/types";
import type { ClientAttentionSourceAvailability, ClientAttentionSignal } from "./types";
import {
  MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES,
  type ClientAttentionSignalType,
  type RankedClientAttentionSignal,
} from "./types";

export type { ConciergeSlaOverdueIdentity };

export const CLIENT_OPS_HEALTH_STATES = [
  "healthy",
  "exceptions",
  "unknown",
] as const;

export type ClientOpsHealth = (typeof CLIENT_OPS_HEALTH_STATES)[number];

export const CLIENT_OPS_SEVERITIES = [
  "critical",
  "action",
  "watch",
  "none",
] as const;

export type ClientOpsSeverity = (typeof CLIENT_OPS_SEVERITIES)[number];

/**
 * HubSpot-supported V1 founder-facing exceptions.
 * Live CRM read: contacts, deals, optional tasks — no email engagements.
 */
export const HUBSPOT_V1_CLIENT_OPS_SIGNAL_TYPES = [
  "follow-up-due",
  "stalled-conversation",
  "missing-next-step",
  "proposal-date-approaching",
  "appointment-approaching",
  "deal-stage-risk",
  "new-inquiry-needs-review",
  "new-inquiry",
] as const;

/**
 * Reply-state signals require inbound/outbound message ordering.
 * Live HubSpot does not fetch engagements/emails, so these are Gmail-future only.
 */
export const GMAIL_DEPENDENT_CLIENT_OPS_SIGNAL_TYPES = [
  "reply-overdue",
  "unanswered-inbound",
] as const;

/** Catalog of Client Ops signal types. Founder-facing V1 is HubSpot-only unless Gmail is live. */
export const V1_CLIENT_OPS_SIGNAL_TYPES = [
  ...HUBSPOT_V1_CLIENT_OPS_SIGNAL_TYPES,
  ...GMAIL_DEPENDENT_CLIENT_OPS_SIGNAL_TYPES,
] as const;

export type V1ClientOpsSignalType = (typeof V1_CLIENT_OPS_SIGNAL_TYPES)[number];
export type HubSpotV1ClientOpsSignalType =
  (typeof HUBSPOT_V1_CLIENT_OPS_SIGNAL_TYPES)[number];
export type GmailDependentClientOpsSignalType =
  (typeof GMAIL_DEPENDENT_CLIENT_OPS_SIGNAL_TYPES)[number];

export type ClientOpsSeverityCounts = {
  critical: number;
  action: number;
  watch: number;
};

const FIRST_CONTACT_SIGNAL_TYPES = new Set<ClientAttentionSignalType>([
  "new-inquiry",
  "new-inquiry-needs-review",
  "reply-overdue",
  "unanswered-inbound",
  "follow-up-due",
  "missing-next-step",
  "stalled-conversation",
  "deal-stage-risk",
]);

export function isV1ClientOpsSignalType(
  signalType: ClientAttentionSignalType,
): signalType is V1ClientOpsSignalType {
  return (V1_CLIENT_OPS_SIGNAL_TYPES as readonly string[]).includes(signalType);
}

export function isHubSpotV1ClientOpsSignalType(
  signalType: ClientAttentionSignalType,
): signalType is HubSpotV1ClientOpsSignalType {
  return (HUBSPOT_V1_CLIENT_OPS_SIGNAL_TYPES as readonly string[]).includes(
    signalType,
  );
}

export function isGmailDependentClientOpsSignalType(
  signalType: ClientAttentionSignalType,
): signalType is GmailDependentClientOpsSignalType {
  return (GMAIL_DEPENDENT_CLIENT_OPS_SIGNAL_TYPES as readonly string[]).includes(
    signalType,
  );
}

/**
 * Live HubSpot search is contacts/deals/tasks only.
 * notes_last_contacted / lastmodifieddate do not prove inbound-without-later-reply.
 */
export function hubSpotLiveCanProveInboundWithoutLaterReply(): false {
  return false;
}

/** Live Gmail metadata read succeeded — not fixture, not missing. */
export function gmailLiveCanConfirmReplyState(
  gmail: ClientAttentionSourceAvailability["gmail"],
): boolean {
  return gmail === "ok" || gmail === "empty";
}

function isFounderFacingClientOpsSignal(
  signalType: ClientAttentionSignalType,
  gmail: ClientAttentionSourceAvailability["gmail"],
): boolean {
  if (isGmailDependentClientOpsSignalType(signalType)) {
    return gmailLiveCanConfirmReplyState(gmail);
  }
  return isHubSpotV1ClientOpsSignalType(signalType);
}

/**
 * HubSpot is the V1 Client Ops source. Failed / not-configured reads are
 * UNKNOWN — never a claim of zero client issues, never fabricated exceptions.
 */
export function clientOpsHealthFromHubSpot(
  availability: Pick<ClientAttentionSourceAvailability, "hubspot">,
): Exclude<ClientOpsHealth, "exceptions"> | "ready" {
  if (
    availability.hubspot === "failed" ||
    availability.hubspot === "not-configured"
  ) {
    return "unknown";
  }
  return "ready";
}

export function severityForClientOpsSignal(
  signal: Pick<ClientAttentionSignal, "urgency">,
): Exclude<ClientOpsSeverity, "none"> {
  if (signal.urgency === "critical" || signal.urgency === "high") {
    return "critical";
  }
  if (signal.urgency === "medium") return "action";
  return "watch";
}

export function isActionableClientOpsSeverity(
  severity: ClientOpsSeverity,
): boolean {
  return severity === "critical" || severity === "action";
}

export function countClientOpsSeverities(
  ranked: RankedClientAttentionSignal[],
  gmail: ClientAttentionSourceAvailability["gmail"] = "not-configured",
): ClientOpsSeverityCounts {
  const counts: ClientOpsSeverityCounts = {
    critical: 0,
    action: 0,
    watch: 0,
  };
  for (const item of ranked) {
    if (!isFounderFacingClientOpsSignal(item.signal.signalType, gmail)) continue;
    if (item.signal.founderRankable === false) continue;
    const severity = severityForClientOpsSignal(item.signal);
    counts[severity] += 1;
  }
  return counts;
}

export function resolveClientOpsHealth(input: {
  hubspotAvailability: ClientAttentionSourceAvailability["hubspot"];
  actionableCount: number;
}): ClientOpsHealth {
  const hub = clientOpsHealthFromHubSpot({
    hubspot: input.hubspotAvailability,
  });
  if (hub === "unknown") return "unknown";
  return input.actionableCount > 0 ? "exceptions" : "healthy";
}

/**
 * Founder-facing Client Ops exceptions: V1 types, actionable severity, capped.
 * UNKNOWN HubSpot yields an empty list — callers must not treat that as "zero issues."
 */
export function selectFounderClientOpsExceptions(
  ranked: RankedClientAttentionSignal[],
  health: ClientOpsHealth,
  max = MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES,
  gmail: ClientAttentionSourceAvailability["gmail"] = "not-configured",
): RankedClientAttentionSignal[] {
  if (health === "unknown") return [];
  return ranked
    .filter((r) => r.signal.founderRankable !== false)
    .filter((r) => isFounderFacingClientOpsSignal(r.signal.signalType, gmail))
    .filter((r) =>
      isActionableClientOpsSeverity(severityForClientOpsSignal(r.signal)),
    )
    .slice(0, max);
}

export function clientAttentionSignalOverlapsConciergeSla(
  signal: Pick<ClientAttentionSignal, "signalType" | "contactId" | "dealId">,
  identities: readonly ConciergeSlaOverdueIdentity[],
): boolean {
  if (!identities.length) return false;
  if (!FIRST_CONTACT_SIGNAL_TYPES.has(signal.signalType)) return false;
  return identities.some((id) => {
    if (signal.dealId && id.dealId && signal.dealId === id.dealId) return true;
    if (signal.contactId && id.contactId && signal.contactId === id.contactId) {
      return true;
    }
    return false;
  });
}

/** Suppress overlapping first-contact Client Ops when Concierge SLA already owns the object. */
export function suppressClientOpsOverlappingConciergeSla(
  signals: ClientAttentionSignal[],
  identities: readonly ConciergeSlaOverdueIdentity[] | undefined,
): ClientAttentionSignal[] {
  if (!identities?.length) return signals;
  return signals.map((signal) => {
    if (!clientAttentionSignalOverlapsConciergeSla(signal, identities)) {
      return signal;
    }
    return {
      ...signal,
      founderRankable: false,
      suppressReason:
        signal.suppressReason ??
        "Concierge SLA already owns first-contact for this inquiry.",
    };
  });
}

export function founderFacingContainsDisallowedAmount(text: string): boolean {
  return /\$\s*\d|\bdeal amount\b|\bamount:\s*\d/i.test(text);
}
