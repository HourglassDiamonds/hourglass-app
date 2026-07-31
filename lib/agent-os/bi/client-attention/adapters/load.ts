/**
 * Load Client Attention source bundle (gather only).
 */

import { registerConnector } from "../../../permissions";
import type { ClientAttentionThresholds } from "../thresholds";
import { loadConciergeClientAttention } from "./concierge";
import { loadGmailClientAttention } from "./gmail";
import { loadHubSpotClientAttention } from "./hubspot";
import { fetchHubSpotClientAttentionLive } from "./hubspot-live";
import type {
  ClientAttentionSourceBundle,
  ConciergeAdapterResult,
  GmailAdapterResult,
  HubSpotAdapterResult,
  NormalizedConciergeSubmission,
  NormalizedGmailThread,
  NormalizedHubSpotContact,
  NormalizedHubSpotDeal,
  NormalizedHubSpotTask,
} from "./types";

registerConnector({
  id: "agent-os-gmail-client-attention-read",
  capability: "read-only",
  description:
    "Bounded Gmail metadata adapter for Client Attention (fixture / not-configured until gmail.readonly)",
});

registerConnector({
  id: "agent-os-hubspot-client-attention-read",
  capability: "read-only",
  description:
    "Bounded HubSpot CRM read adapter for Client Attention (fixture or live read-only)",
});

export type LoadClientAttentionSourcesOptions = {
  mode: "fixture" | "live";
  nowIso?: string;
  thresholds?: Partial<ClientAttentionThresholds>;
  gmail?: {
    forceStatus?: "failed" | "not-configured" | "empty";
    threads?: NormalizedGmailThread[];
    liveResult?: GmailAdapterResult;
  };
  hubspot?: {
    forceStatus?: "failed" | "not-configured" | "empty";
    contacts?: NormalizedHubSpotContact[];
    deals?: NormalizedHubSpotDeal[];
    tasks?: NormalizedHubSpotTask[];
    liveResult?: HubSpotAdapterResult;
  };
  concierge?: {
    forceStatus?: "failed" | "not-configured" | "empty";
    submissions?: NormalizedConciergeSubmission[];
    liveResult?: ConciergeAdapterResult;
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
      liveResult: options.gmail?.liveResult,
    }),
    hubspot: loadHubSpotClientAttention({
      mode: options.mode,
      nowIso: options.nowIso,
      thresholds: options.thresholds,
      fixtureContacts: options.hubspot?.contacts,
      fixtureDeals: options.hubspot?.deals,
      fixtureTasks: options.hubspot?.tasks,
      forceStatus: options.hubspot?.forceStatus,
      liveResult: options.hubspot?.liveResult,
    }),
    concierge: loadConciergeClientAttention({
      mode: options.mode,
      nowIso: options.nowIso,
      thresholds: options.thresholds,
      fixtureSubmissions: options.concierge?.submissions,
      forceStatus: options.concierge?.forceStatus,
      liveResult: options.concierge?.liveResult,
    }),
  };
}

/**
 * Async gather for live mode — HubSpot bounded CRM reads + Concierge reconstruction.
 * Gmail remains at the not-configured boundary until gmail.readonly exists.
 */
export async function loadClientAttentionSourcesAsync(
  options: LoadClientAttentionSourcesOptions,
): Promise<ClientAttentionSourceBundle> {
  if (options.mode === "fixture") {
    return loadClientAttentionSources(options);
  }

  if (
    options.hubspot?.forceStatus ||
    options.hubspot?.liveResult ||
    options.concierge?.liveResult
  ) {
    return loadClientAttentionSources(options);
  }

  const live = await fetchHubSpotClientAttentionLive({
    nowIso: options.nowIso,
    thresholds: options.thresholds,
  });

  return loadClientAttentionSources({
    ...options,
    hubspot: {
      ...options.hubspot,
      liveResult: live.hubspot,
    },
    concierge: {
      ...options.concierge,
      liveResult: live.concierge,
    },
  });
}
