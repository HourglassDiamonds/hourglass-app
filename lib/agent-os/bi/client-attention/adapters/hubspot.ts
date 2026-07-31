/**
 * Read-only HubSpot adapter boundary for Client Attention.
 * Concierge write client remains separate — this never mutates CRM.
 *
 * Credentials (same token env as Concierge, when scopes allow CRM reads):
 * - HUBSPOT_ACCESS_TOKEN or HUBSPOT_PRIVATE_APP_TOKEN
 *
 * Required private-app scopes for live read:
 * - crm.objects.contacts.read
 * - crm.objects.deals.read
 * - crm.objects.tasks.read (optional; tasks may be empty)
 *
 * Live mode: pass `liveResult` from fetchHubSpotClientAttentionLive, or call
 * loadClientAttentionSourcesAsync which performs the bounded read.
 */

import { resolveHubSpotToken } from "@/lib/concierge/hubspot-client";
import type { ClientAttentionThresholds } from "../thresholds";
import { DEFAULT_CLIENT_ATTENTION_THRESHOLDS } from "../thresholds";
import type {
  HubSpotAdapterResult,
  NormalizedHubSpotContact,
  NormalizedHubSpotDeal,
  NormalizedHubSpotTask,
} from "./types";

export const HUBSPOT_READ_REQUIRED_ENV = [
  "HUBSPOT_ACCESS_TOKEN|HUBSPOT_PRIVATE_APP_TOKEN",
] as const;

export const HUBSPOT_READ_REQUIRED_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.deals.read",
] as const;

export const HUBSPOT_READ_OPTIONAL_SCOPES = [
  "crm.objects.tasks.read",
] as const;

export type LoadHubSpotOptions = {
  mode: "fixture" | "live";
  nowIso?: string;
  thresholds?: Partial<ClientAttentionThresholds>;
  fixtureContacts?: NormalizedHubSpotContact[];
  fixtureDeals?: NormalizedHubSpotDeal[];
  fixtureTasks?: NormalizedHubSpotTask[];
  forceStatus?: "failed" | "not-configured" | "empty";
  /** Prefetched live snapshot from fetchHubSpotClientAttentionLive. */
  liveResult?: HubSpotAdapterResult;
};

export function loadHubSpotClientAttention(
  options: LoadHubSpotOptions,
): HubSpotAdapterResult {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const thresholds = {
    ...DEFAULT_CLIENT_ATTENTION_THRESHOLDS,
    ...options.thresholds,
  };

  if (options.forceStatus === "failed") {
    return {
      sourceType: "hubspot",
      status: "failed",
      collectedAt: nowIso,
      recordCount: 0,
      contacts: [],
      deals: [],
      tasks: [],
      errorCode: "hubspot_adapter_failed",
      configurationNote: "HubSpot CRM read failed; other sources may continue.",
    };
  }

  if (options.forceStatus === "not-configured") {
    return notConfigured(nowIso, "Forced not-configured fixture.");
  }

  if (options.mode === "live") {
    if (options.liveResult) {
      return options.liveResult;
    }
    const { token, source } = resolveHubSpotToken();
    if (!token) {
      return notConfigured(
        nowIso,
        "No HubSpot token in environment for Agent OS CRM reads.",
      );
    }
    return {
      sourceType: "hubspot",
      status: "not-configured",
      collectedAt: nowIso,
      recordCount: 0,
      contacts: [],
      deals: [],
      tasks: [],
      missingConfiguration: [
        "async live prefetch (loadClientAttentionSourcesAsync / fetchHubSpotClientAttentionLive)",
      ],
      configurationNote: `Token present via ${source}, but live HubSpot snapshot was not prefetched. Call loadClientAttentionSourcesAsync for bounded CRM reads.`,
    };
  }

  if (options.forceStatus === "empty") {
    return {
      sourceType: "hubspot",
      status: "empty",
      collectedAt: nowIso,
      recordCount: 0,
      contacts: [],
      deals: [],
      tasks: [],
      configurationNote: "HubSpot fixture returned no contacts or deals.",
    };
  }

  const contacts = (options.fixtureContacts ?? []).slice(
    0,
    thresholds.maxHubSpotContacts,
  );
  const deals = (options.fixtureDeals ?? []).slice(0, thresholds.maxHubSpotDeals);
  const tasks = options.fixtureTasks ?? [];
  const recordCount = contacts.length + deals.length + tasks.length;

  return {
    sourceType: "hubspot",
    status: recordCount ? "fixture" : "empty",
    collectedAt: nowIso,
    recordCount,
    contacts,
    deals,
    tasks,
    configurationNote: "Deterministic HubSpot fixture snapshot.",
  };
}

function notConfigured(nowIso: string, note: string): HubSpotAdapterResult {
  return {
    sourceType: "hubspot",
    status: "not-configured",
    collectedAt: nowIso,
    recordCount: 0,
    contacts: [],
    deals: [],
    tasks: [],
    missingConfiguration: [
      ...HUBSPOT_READ_REQUIRED_ENV,
      ...HUBSPOT_READ_REQUIRED_SCOPES,
    ],
    configurationNote: note,
  };
}
