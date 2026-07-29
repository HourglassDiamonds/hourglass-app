/**
 * Concierge source adapter for Client Attention.
 * Normalizes fixture / ledger-shaped submissions — does not change live Concierge payload.
 */

import type { ClientAttentionThresholds } from "../thresholds";
import { DEFAULT_CLIENT_ATTENTION_THRESHOLDS } from "../thresholds";
import type {
  ConciergeAdapterResult,
  NormalizedConciergeSubmission,
} from "./types";

export type LoadConciergeOptions = {
  mode: "fixture" | "live";
  nowIso?: string;
  thresholds?: Partial<ClientAttentionThresholds>;
  fixtureSubmissions?: NormalizedConciergeSubmission[];
  forceStatus?: "failed" | "not-configured" | "empty";
};

/**
 * Live Concierge submissions land in HubSpot; Agent OS has no separate submission
 * ledger yet. Live mode reports via-hubspot / empty unless fixtures are supplied
 * for validation.
 */
export function loadConciergeClientAttention(
  options: LoadConciergeOptions,
): ConciergeAdapterResult {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const thresholds = {
    ...DEFAULT_CLIENT_ATTENTION_THRESHOLDS,
    ...options.thresholds,
  };

  if (options.forceStatus === "failed") {
    return {
      sourceType: "concierge",
      status: "failed",
      collectedAt: nowIso,
      recordCount: 0,
      submissions: [],
      errorCode: "concierge_adapter_failed",
      configurationNote: "Concierge snapshot failed; HubSpot/Gmail may continue.",
    };
  }

  if (options.forceStatus === "not-configured" || options.mode === "live") {
    return {
      sourceType: "concierge",
      status: "not-configured",
      collectedAt: nowIso,
      recordCount: 0,
      submissions: [],
      missingConfiguration: [
        "Agent OS Concierge submission ledger (future)",
        "or HubSpot deal properties populated by Concierge write path",
      ],
      configurationNote:
        "Concierge inquiries are written to HubSpot at submit time; Agent OS has no separate live submission ledger yet. Use fixtures or HubSpot CRM reads when available.",
    };
  }

  if (options.forceStatus === "empty") {
    return {
      sourceType: "concierge",
      status: "empty",
      collectedAt: nowIso,
      recordCount: 0,
      submissions: [],
      configurationNote: "Concierge fixture returned no submissions.",
    };
  }

  const submissions = (options.fixtureSubmissions ?? [])
    .filter((s) => s.accepted)
    .slice(0, thresholds.maxHubSpotContacts);

  return {
    sourceType: "concierge",
    status: submissions.length ? "fixture" : "empty",
    collectedAt: nowIso,
    recordCount: submissions.length,
    submissions,
    configurationNote: "Deterministic Concierge fixture snapshot.",
  };
}
