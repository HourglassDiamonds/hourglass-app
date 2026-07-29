/**
 * Load Client Attention source bundle (gather only).
 */

import { registerConnector } from "../../../permissions";
import type { ClientAttentionThresholds } from "../thresholds";
import { loadConciergeClientAttention } from "./concierge";
import { loadGmailClientAttention } from "./gmail";
import { loadHubSpotClientAttention } from "./hubspot";
import type {
  ClientAttentionSourceBundle,
  NormalizedConciergeSubmission,
  NormalizedGmailThread,
  NormalizedHubSpotContact,
  NormalizedHubSpotDeal,
  NormalizedHubSpotTask,
} from "./types";

registerConnector({
  id: "agent-os-gmail-client-attention-read",
  capability: "read-only",
  description: "Bounded Gmail metadata adapter for Client Attention (fixture / not-configured)",
});

registerConnector({
  id: "agent-os-hubspot-client-attention-read",
  capability: "read-only",
  description: "Bounded HubSpot CRM read adapter for Client Attention (fixture / not-configured)",
});

export type LoadClientAttentionSourcesOptions = {
  mode: "fixture" | "live";
  nowIso?: string;
  thresholds?: Partial<ClientAttentionThresholds>;
  gmail?: {
    forceStatus?: "failed" | "not-configured" | "empty";
    threads?: NormalizedGmailThread[];
  };
  hubspot?: {
    forceStatus?: "failed" | "not-configured" | "empty";
    contacts?: NormalizedHubSpotContact[];
    deals?: NormalizedHubSpotDeal[];
    tasks?: NormalizedHubSpotTask[];
  };
  concierge?: {
    forceStatus?: "failed" | "not-configured" | "empty";
    submissions?: NormalizedConciergeSubmission[];
  };
};

export function loadClientAttentionSources(
  options: LoadClientAttentionSourcesOptions,
): ClientAttentionSourceBundle {
  return {
    gmail: loadGmailClientAttention({
      mode: options.mode,
      nowIso: options.nowIso,
      thresholds: options.thresholds,
      fixtureThreads: options.gmail?.threads,
      forceStatus: options.gmail?.forceStatus,
    }),
    hubspot: loadHubSpotClientAttention({
      mode: options.mode,
      nowIso: options.nowIso,
      thresholds: options.thresholds,
      fixtureContacts: options.hubspot?.contacts,
      fixtureDeals: options.hubspot?.deals,
      fixtureTasks: options.hubspot?.tasks,
      forceStatus: options.hubspot?.forceStatus,
    }),
    concierge: loadConciergeClientAttention({
      mode: options.mode,
      nowIso: options.nowIso,
      thresholds: options.thresholds,
      fixtureSubmissions: options.concierge?.submissions,
      forceStatus: options.concierge?.forceStatus,
    }),
  };
}
