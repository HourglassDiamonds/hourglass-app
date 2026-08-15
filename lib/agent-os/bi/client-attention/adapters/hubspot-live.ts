/**
 * Live read-only HubSpot fetch for Client Attention.
 * Reuses Concierge hubspotFetchJson / resolveHubSpotToken.
 * Never creates, updates, or deletes CRM objects.
 */

import {
  HubSpotRequestError,
  hubspotFetchJson,
  resolveHubSpotToken,
} from "@/lib/concierge/hubspot-client";
import { normalizeEmail, normalizePhone } from "../hash";
import type { ClientAttentionThresholds } from "../thresholds";
import { DEFAULT_CLIENT_ATTENTION_THRESHOLDS } from "../thresholds";
import { ATTRIBUTION_PRIMARY_LOOKBACK_DAYS } from "../../attribution/types";
import {
  enrichContactsFromConciergeDeals,
  reconstructConciergeFromHubSpot,
} from "./concierge-from-hubspot";
import {
  HUBSPOT_READ_OPTIONAL_SCOPES,
  HUBSPOT_READ_REQUIRED_ENV,
  HUBSPOT_READ_REQUIRED_SCOPES,
} from "./hubspot";
import type {
  ConciergeAdapterResult,
  HubSpotAdapterResult,
  NormalizedHubSpotContact,
  NormalizedHubSpotDeal,
  NormalizedHubSpotTask,
} from "./types";

const CONTACT_PROPERTIES = [
  "email",
  "firstname",
  "lastname",
  "phone",
  "mobilephone",
  "lifecyclestage",
  "hs_lead_status",
  "notes_last_contacted",
  "notes_next_activity_date",
  "hubspot_owner_id",
  "preferred_contact_method",
  "lastmodifieddate",
  "hs_lastmodifieddate",
  "createdate",
] as const;

const DEAL_PROPERTIES = [
  "dealname",
  "dealstage",
  "pipeline",
  "amount",
  "closedate",
  "createdate",
  "hs_lastmodifieddate",
  "hubspot_owner_id",
  "description",
  "hs_is_closed",
  "notes_last_updated",
  "hs_next_step",
] as const;

const TASK_PROPERTIES = [
  "hs_task_subject",
  "hs_task_status",
  "hs_timestamp",
  "hs_task_completion_date",
  "hs_task_body",
] as const;

type HubSpotListResponse<T> = {
  results?: T[];
  paging?: { next?: { after?: string } };
};

type HubSpotObject = {
  id: string;
  properties?: Record<string, string | null | undefined>;
  createdAt?: string;
  updatedAt?: string;
  associations?: Record<
    string,
    { results?: Array<{ id: string; type?: string }> }
  >;
};

export type FetchHubSpotLiveOptions = {
  nowIso?: string;
  thresholds?: Partial<ClientAttentionThresholds>;
  /** Injected for tests — never use write methods. */
  fetchJson?: typeof hubspotFetchJson;
  token?: string;
  /** Observability for tests / one-off verification. Path only — no bodies. */
  onRequest?: (path: string) => void;
};

export type HubSpotLiveFetchBundle = {
  hubspot: HubSpotAdapterResult;
  concierge: ConciergeAdapterResult;
  dealDescriptions: Record<string, string | undefined>;
};

/**
 * Bounded HubSpot CRM reads for Client Attention + Concierge reconstruction.
 */
export async function fetchHubSpotClientAttentionLive(
  options: FetchHubSpotLiveOptions = {},
): Promise<HubSpotLiveFetchBundle> {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const thresholds = {
    ...DEFAULT_CLIENT_ATTENTION_THRESHOLDS,
    ...options.thresholds,
  };
  const innerFetch = options.fetchJson ?? hubspotFetchJson;
  const fetchJson: typeof hubspotFetchJson = async (path, init, fetchOptions) => {
    options.onRequest?.(path);
    return innerFetch(path, init, fetchOptions);
  };
  const { token, source } = options.token
    ? { token: options.token, source: "injected" as const }
    : resolveHubSpotToken();

  if (!token) {
    const hubspot = notConfigured(
      nowIso,
      "No HubSpot token in environment for Agent OS CRM reads.",
    );
    return {
      hubspot,
      concierge: viaHubSpotNotConfigured(nowIso),
      dealDescriptions: {},
    };
  }

  const nowMs = options.nowIso ? Date.parse(options.nowIso) : Date.now();
  const lookbackMs =
    (Number.isFinite(nowMs) ? nowMs : Date.now()) -
    thresholds.lookbackDays * 24 * 60 * 60 * 1000;
  const lookbackValue = String(lookbackMs);

  try {
    const [contactsRaw, dealsRaw, tasksOutcome] = await Promise.all([
      searchObjects(fetchJson, token, "contacts", {
        properties: [...CONTACT_PROPERTIES],
        limit: thresholds.maxHubSpotContacts,
        filterProperty: "lastmodifieddate",
        filterValue: lookbackValue,
        sortProperty: "lastmodifieddate",
        associations: ["deals"],
      }),
      searchObjects(fetchJson, token, "deals", {
        properties: [...DEAL_PROPERTIES],
        limit: thresholds.maxHubSpotDeals,
        filterProperty: "hs_lastmodifieddate",
        filterValue: lookbackValue,
        sortProperty: "hs_lastmodifieddate",
        associations: ["contacts"],
      }),
      searchObjects(fetchJson, token, "tasks", {
        properties: [...TASK_PROPERTIES],
        limit: Math.min(40, thresholds.maxHubSpotDeals),
        filterProperty: "hs_lastmodifieddate",
        filterValue: lookbackValue,
        sortProperty: "hs_lastmodifieddate",
        associations: ["contacts", "deals"],
      }).then(
        (results) => ({ ok: true as const, results }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
    ]);

    const dealDescriptions: Record<string, string | undefined> = {};
    let deals = dealsRaw.map((obj) => {
      const description = obj.properties?.description || undefined;
      if (description) dealDescriptions[obj.id] = description;
      return normalizeDeal(obj);
    });

    let contacts = contactsRaw.map(normalizeContact);

    // Ensure deal-associated contacts are present for identity merge.
    const missingContactIds = new Set<string>();
    for (const deal of deals) {
      for (const id of deal.contactIds) {
        if (!contacts.some((c) => c.contactId === id)) missingContactIds.add(id);
      }
    }
    if (missingContactIds.size > 0) {
      const extra = await batchReadContacts(
        fetchJson,
        token,
        [...missingContactIds].slice(0, thresholds.maxHubSpotContacts),
      );
      const seen = new Set(contacts.map((c) => c.contactId));
      for (const c of extra) {
        if (!seen.has(c.contactId)) {
          contacts.push(c);
          seen.add(c.contactId);
        }
      }
      contacts = contacts.slice(0, thresholds.maxHubSpotContacts);
    }

    contacts = enrichContactsFromConciergeDeals(
      contacts,
      deals,
      dealDescriptions,
    );

    let tasks: NormalizedHubSpotTask[] = [];
    let taskNote: string | undefined;
    if (tasksOutcome.ok) {
      tasks = tasksOutcome.results.map(normalizeTask);
    } else if (
      tasksOutcome.error instanceof HubSpotRequestError &&
      (tasksOutcome.error.status === 403 || tasksOutcome.error.status === 401)
    ) {
      taskNote = `Tasks skipped — optional scope ${HUBSPOT_READ_OPTIONAL_SCOPES[0]} may be missing.`;
    } else {
      taskNote = "Tasks read failed; contacts/deals may still be usable.";
    }

    deals = deals.slice(0, thresholds.maxHubSpotDeals);
    const recordCount = contacts.length + deals.length + tasks.length;

    const hubspot: HubSpotAdapterResult = {
      sourceType: "hubspot",
      status: recordCount ? "ok" : "empty",
      collectedAt: nowIso,
      recordCount,
      contacts,
      deals,
      tasks,
      configurationNote: [
        `Live HubSpot CRM read via ${source} (bounded ${thresholds.lookbackDays}d window).`,
        "Read-only: contacts, deals, optional tasks — no mutations.",
        taskNote,
      ]
        .filter(Boolean)
        .join(" "),
    };

    const concierge = reconstructConciergeFromHubSpot({
      deals,
      contacts,
      dealDescriptions,
      nowIso,
      maxSubmissions: thresholds.maxHubSpotContacts,
    });

    return { hubspot, concierge, dealDescriptions };
  } catch (error) {
    if (error instanceof HubSpotRequestError) {
      const missingScopes =
        error.status === 403
          ? [...HUBSPOT_READ_REQUIRED_SCOPES]
          : undefined;
      const hubspot: HubSpotAdapterResult = {
        sourceType: "hubspot",
        status: error.status === 401 || error.status === 403 ? "not-configured" : "failed",
        collectedAt: nowIso,
        recordCount: 0,
        contacts: [],
        deals: [],
        tasks: [],
        errorCode:
          error.status === 403
            ? "hubspot_missing_read_scopes"
            : "hubspot_adapter_failed",
        missingConfiguration: missingScopes
          ? [...HUBSPOT_READ_REQUIRED_ENV, ...missingScopes]
          : undefined,
        configurationNote:
          error.status === 403
            ? "HubSpot token rejected CRM reads — confirm contacts.read and deals.read on the private app."
            : `HubSpot CRM read failed (HTTP ${error.status}); other sources may continue.`,
      };
      return {
        hubspot,
        concierge: viaHubSpotNotConfigured(nowIso),
        dealDescriptions: {},
      };
    }

    const hubspot: HubSpotAdapterResult = {
      sourceType: "hubspot",
      status: "failed",
      collectedAt: nowIso,
      recordCount: 0,
      contacts: [],
      deals: [],
      tasks: [],
      errorCode: "hubspot_adapter_failed",
      configurationNote:
        "HubSpot CRM read failed; other sources may continue.",
    };
    return {
      hubspot,
      concierge: viaHubSpotNotConfigured(nowIso),
      dealDescriptions: {},
    };
  }
}

export type SharedLiveCrmLoad = {
  attribution: HubSpotLiveFetchBundle;
  clientAttention: HubSpotLiveFetchBundle;
  requestPaths: string[];
};

/**
 * One bounded HubSpot reconstruction per Agent OS run.
 * Attribution consumes the requested 90-day search window.
 * Client Attention derives its 30-day view in memory — no second CRM search.
 */
export async function loadSharedLiveCrmForAgentOs(
  options: FetchHubSpotLiveOptions & {
    clientAttentionLookbackDays?: number;
  } = {},
): Promise<SharedLiveCrmLoad> {
  const requestPaths: string[] = [];
  const attributionLookbackDays =
    options.thresholds?.lookbackDays ?? ATTRIBUTION_PRIMARY_LOOKBACK_DAYS;
  const attribution = await fetchHubSpotClientAttentionLive({
    ...options,
    thresholds: {
      ...options.thresholds,
      lookbackDays: attributionLookbackDays,
    },
    onRequest: (path) => {
      requestPaths.push(path);
      options.onRequest?.(path);
    },
  });
  const clientAttention = sliceHubSpotLiveBundleForLookback(attribution, {
    lookbackDays:
      options.clientAttentionLookbackDays ??
      DEFAULT_CLIENT_ATTENTION_THRESHOLDS.lookbackDays,
    nowIso: options.nowIso ?? attribution.hubspot.collectedAt,
    maxHubSpotDeals:
      options.thresholds?.maxHubSpotDeals ??
      DEFAULT_CLIENT_ATTENTION_THRESHOLDS.maxHubSpotDeals,
    maxHubSpotContacts:
      options.thresholds?.maxHubSpotContacts ??
      DEFAULT_CLIENT_ATTENTION_THRESHOLDS.maxHubSpotContacts,
  });
  return { attribution, clientAttention, requestPaths };
}

/**
 * Filter a shared CRM reconstruction to a shorter last-modified window.
 * Does not call HubSpot. Preserves failed / not-configured status.
 */
export function sliceHubSpotLiveBundleForLookback(
  bundle: HubSpotLiveFetchBundle,
  options: {
    lookbackDays: number;
    nowIso?: string;
    maxHubSpotDeals?: number;
    maxHubSpotContacts?: number;
  },
): HubSpotLiveFetchBundle {
  if (
    bundle.hubspot.status === "failed" ||
    bundle.hubspot.status === "not-configured"
  ) {
    return bundle;
  }

  const nowIso = options.nowIso ?? bundle.hubspot.collectedAt;
  const maxDeals =
    options.maxHubSpotDeals ??
    DEFAULT_CLIENT_ATTENTION_THRESHOLDS.maxHubSpotDeals;
  const maxContacts =
    options.maxHubSpotContacts ??
    DEFAULT_CLIENT_ATTENTION_THRESHOLDS.maxHubSpotContacts;
  const cutoffMs =
    Date.parse(nowIso) - options.lookbackDays * 24 * 60 * 60 * 1000;

  const deals = bundle.hubspot.deals
    .filter((deal) => recordInLookbackWindow(deal, cutoffMs))
    .slice(0, maxDeals);
  const keptDealIds = new Set(deals.map((deal) => deal.dealId));
  const contactIdsFromDeals = new Set(deals.flatMap((deal) => deal.contactIds));

  const contacts = bundle.hubspot.contacts
    .filter(
      (contact) =>
        recordInLookbackWindow(contact, cutoffMs) ||
        contactIdsFromDeals.has(contact.contactId),
    )
    .slice(0, maxContacts);
  const keptContactIds = new Set(contacts.map((contact) => contact.contactId));

  const tasks = bundle.hubspot.tasks.filter(
    (task) =>
      recordInLookbackWindow(task, cutoffMs) ||
      (task.contactId != null && keptContactIds.has(task.contactId)) ||
      (task.dealId != null && keptDealIds.has(task.dealId)),
  );

  const dealDescriptions: Record<string, string | undefined> = {};
  for (const dealId of keptDealIds) {
    if (Object.prototype.hasOwnProperty.call(bundle.dealDescriptions, dealId)) {
      dealDescriptions[dealId] = bundle.dealDescriptions[dealId];
    }
  }

  const recordCount = contacts.length + deals.length + tasks.length;
  const hubspot: HubSpotAdapterResult = {
    ...bundle.hubspot,
    status: recordCount ? bundle.hubspot.status : "empty",
    recordCount,
    contacts,
    deals,
    tasks,
    configurationNote: [
      bundle.hubspot.configurationNote,
      `Client Attention ${options.lookbackDays}d view derived in-memory from the shared CRM read. No second HubSpot search.`,
    ]
      .filter(Boolean)
      .join(" "),
  };

  const concierge =
    bundle.concierge.status === "failed" ||
    bundle.concierge.status === "not-configured"
      ? bundle.concierge
      : reconstructConciergeFromHubSpot({
          deals,
          contacts,
          dealDescriptions,
          nowIso,
          maxSubmissions: maxContacts,
        });

  return { hubspot, concierge, dealDescriptions };
}

function recordInLookbackWindow(
  record: {
    lastModifiedAt?: string;
    lastActivityAt?: string;
    createdAt?: string;
    dueAt?: string;
    completedAt?: string;
  },
  cutoffMs: number,
): boolean {
  const iso =
    record.lastModifiedAt ||
    record.lastActivityAt ||
    record.createdAt ||
    record.dueAt ||
    record.completedAt;
  if (!iso) return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return t >= cutoffMs;
}

async function searchObjects(
  fetchJson: typeof hubspotFetchJson,
  token: string,
  objectType: "contacts" | "deals" | "tasks",
  opts: {
    properties: string[];
    limit: number;
    filterProperty: string;
    filterValue: string;
    sortProperty: string;
    associations?: string[];
  },
): Promise<HubSpotObject[]> {
  const body: Record<string, unknown> = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: opts.filterProperty,
            operator: "GTE",
            value: opts.filterValue,
          },
        ],
      },
    ],
    sorts: [
      {
        propertyName: opts.sortProperty,
        direction: "DESCENDING",
      },
    ],
    properties: opts.properties,
    limit: opts.limit,
  };

  const path = `/crm/v3/objects/${objectType}/search`;
  const response = await fetchJson<HubSpotListResponse<HubSpotObject>>(
    path,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    { token },
  );

  const results = response?.results ?? [];

  if (opts.associations?.length && results.length > 0) {
    return hydrateAssociations(
      fetchJson,
      token,
      objectType,
      results,
      opts.associations,
    );
  }

  return results;
}

async function hydrateAssociations(
  fetchJson: typeof hubspotFetchJson,
  token: string,
  objectType: string,
  objects: HubSpotObject[],
  associations: string[],
): Promise<HubSpotObject[]> {
  const byId = new Map(objects.map((o) => [o.id, { ...o }]));

  for (const toObject of associations) {
    try {
      const assocResponse = await fetchJson<{
        results?: Array<{
          from?: { id?: string };
          to?: Array<{ toObjectId?: string; id?: string }>;
          toObjectId?: string;
        }>;
      }>(
        `/crm/v4/associations/${objectType}/${toObject}/batch/read`,
        {
          method: "POST",
          body: JSON.stringify({
            inputs: objects.map((o) => ({ id: o.id })),
          }),
        },
        { token },
      );

      for (const row of assocResponse?.results ?? []) {
        const fromId = row.from?.id;
        if (!fromId) continue;
        const current = byId.get(fromId);
        if (!current) continue;
        const targets = (row.to ?? [])
          .map((t) => {
            const raw = t.toObjectId ?? t.id;
            return raw == null || raw === "" ? null : String(raw);
          })
          .filter((id): id is string => Boolean(id));
        current.associations = {
          ...current.associations,
          [toObject]: {
            results: targets.map((id) => ({ id })),
          },
        };
        byId.set(fromId, current);
      }
    } catch {
      // Associations are best-effort; objects remain usable without them.
    }
  }

  return objects.map((o) => byId.get(o.id) ?? o);
}

async function batchReadContacts(
  fetchJson: typeof hubspotFetchJson,
  token: string,
  ids: string[],
): Promise<NormalizedHubSpotContact[]> {
  if (!ids.length) return [];
  const response = await fetchJson<{ results?: HubSpotObject[] }>(
    "/crm/v3/objects/contacts/batch/read",
    {
      method: "POST",
      body: JSON.stringify({
        properties: [...CONTACT_PROPERTIES],
        inputs: ids.map((id) => ({ id })),
      }),
    },
    { token },
  );
  return (response?.results ?? []).map(normalizeContact);
}

function normalizeContact(obj: HubSpotObject): NormalizedHubSpotContact {
  const p = obj.properties || {};
  return {
    contactId: obj.id,
    normalizedEmail: normalizeEmail(p.email) ?? undefined,
    normalizedPhone:
      normalizePhone(p.phone) ?? normalizePhone(p.mobilephone) ?? undefined,
    firstName: p.firstname || undefined,
    lastName: p.lastname || undefined,
    lifecycleStage: p.lifecyclestage || undefined,
    leadStatus: p.hs_lead_status || undefined,
    lastActivityAt:
      hubspotDateToIso(p.notes_last_contacted) ||
      hubspotDateToIso(p.hs_lastmodifieddate) ||
      hubspotDateToIso(obj.updatedAt),
    lastModifiedAt:
      hubspotDateToIso(p.lastmodifieddate) ||
      hubspotDateToIso(p.hs_lastmodifieddate) ||
      hubspotDateToIso(obj.updatedAt),
    nextActivityAt: hubspotDateToIso(p.notes_next_activity_date),
    ownerId: p.hubspot_owner_id || undefined,
    conciergePreferredContact: p.preferred_contact_method || undefined,
  };
}

function normalizeDeal(obj: HubSpotObject): NormalizedHubSpotDeal {
  const p = obj.properties || {};
  const contactIds =
    obj.associations?.contacts?.results?.map((r) => r.id) ?? [];
  const closed =
    p.hs_is_closed === "true" ||
    /closed|won|lost/i.test(p.dealstage || "");

  return {
    dealId: obj.id,
    contactIds,
    dealName: p.dealname || undefined,
    stage: p.dealstage || undefined,
    pipeline: p.pipeline || undefined,
    ownerId: p.hubspot_owner_id || undefined,
    amount: p.amount != null && p.amount !== "" ? Number(p.amount) : null,
    targetDate: hubspotDateToIso(p.closedate),
    lastActivityAt:
      hubspotDateToIso(p.notes_last_updated) ||
      hubspotDateToIso(p.hs_lastmodifieddate) ||
      hubspotDateToIso(obj.updatedAt),
    lastModifiedAt:
      hubspotDateToIso(p.hs_lastmodifieddate) ||
      hubspotDateToIso(obj.updatedAt),
    createdAt: hubspotDateToIso(p.createdate) || hubspotDateToIso(obj.createdAt),
    closed,
    deferred: /deferred|nurture|on.?hold/i.test(p.dealstage || ""),
  };
}

function normalizeTask(obj: HubSpotObject): NormalizedHubSpotTask {
  const p = obj.properties || {};
  const statusRaw = (p.hs_task_status || "").toLowerCase();
  let status: NormalizedHubSpotTask["status"] = "unknown";
  if (statusRaw.includes("complet")) status = "completed";
  else if (statusRaw.includes("not_started") || statusRaw.includes("in_progress") || statusRaw === "waiting")
    status = "open";
  else if (statusRaw) status = "open";

  return {
    taskId: obj.id,
    contactId: obj.associations?.contacts?.results?.[0]?.id,
    dealId: obj.associations?.deals?.results?.[0]?.id,
    subject: p.hs_task_subject || undefined,
    dueAt: hubspotDateToIso(p.hs_timestamp),
    lastModifiedAt:
      hubspotDateToIso(p.hs_lastmodifieddate) ||
      hubspotDateToIso(obj.updatedAt),
    status,
    completedAt: hubspotDateToIso(p.hs_task_completion_date),
  };
}

export function hubspotDateToIso(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (Number.isFinite(n) && n > 1_000_000_000_000) {
    return new Date(n).toISOString();
  }
  if (Number.isFinite(n) && n > 1_000_000_000) {
    return new Date(n * 1000).toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
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

function viaHubSpotNotConfigured(nowIso: string): ConciergeAdapterResult {
  return {
    sourceType: "concierge",
    status: "not-configured",
    collectedAt: nowIso,
    recordCount: 0,
    submissions: [],
    missingConfiguration: [
      "HubSpot CRM read (for Concierge reconstruction)",
      "or Agent OS Concierge submission ledger (future)",
    ],
    configurationNote:
      "Concierge reconstruction waits on HubSpot deal description reads.",
  };
}
