/**
 * Future handoff interfaces.
 *
 * Long-term flow:
 *   Studio Event → Diamond Studio Agent → Client/Sales Agent (when the
 *   same normalized email later matches a Concierge identity) →
 *   Chief of Staff → founder only if material.
 *
 * Email This View is identified Studio activity, not an inquiry.
 * This sprint does not build autonomous client follow-up.
 */

import type { StudioHandoffEnvelope } from "./types";
import type { StudioActivitySummary } from "./types";

export function studioHandoffToChiefOfStaff(
  summary: StudioActivitySummary,
): StudioHandoffEnvelope | null {
  if (summary.identityInvented) return null;
  if (summary.materialSignals.length === 0) return null;
  return {
    from: "diamond-studio-agent",
    to: "chief-of-staff",
    reason:
      "Material Studio integrity or intent signals — not a founder-facing metric dump",
    requiresIdentity: false,
    material: true,
  };
}

export function studioHandoffToClientAgent(input: {
  hasLegitimateIdentity: boolean;
  matchedByNormalizedEmail: boolean;
  summary: StudioActivitySummary;
}): StudioHandoffEnvelope | null {
  if (!input.hasLegitimateIdentity || !input.matchedByNormalizedEmail) {
    return null;
  }
  if (input.summary.eventCount === 0) return null;
  return {
    from: "diamond-studio-agent",
    to: "client-sales-agent",
    reason:
      "Exact normalized-email match to a Concierge identity — attach Studio history",
    requiresIdentity: true,
    material: true,
  };
}

export const STUDIO_CHIEF_OF_STAFF_RELATIONSHIP = {
  specialist: "diamond-studio-agent",
  reportsTo: "chief-of-staff",
  peerWhenIdentityExists: "client-sales-agent",
  founderRule: "Surface only if follow-up is warranted after CoS ranking",
  v1Status: "documented-interfaces-only",
} as const;
