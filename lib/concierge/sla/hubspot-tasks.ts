/**
 * HubSpot Concierge SLA task adapter.
 * Idempotent ensure: search associations / subject before create.
 * Never uses customer email as the idempotency key — deal_id only.
 */

import {
  HubSpotRequestError,
  hubspotFetchJson,
  resolveHubSpotToken,
} from "@/lib/concierge/hubspot-client";
import {
  CONCIERGE_SLA_TASK_SUBJECT_PREFIX,
  HUBSPOT_TASK_TO_CONTACT_ASSOCIATION,
  HUBSPOT_TASK_TO_DEAL_ASSOCIATION,
  conciergeSlaTaskSubject,
  isConciergeSlaTaskSubject,
} from "./types";

export type EnsureConciergeSlaTaskInput = {
  dealId: string;
  contactId: string;
  dueAtIso: string;
  token?: string;
  ownerId?: string | null;
  /** Unix ms reminder before due — optional HubSpot-native redundancy. */
  reminderAtMs?: number | null;
  fetchJson?: typeof hubspotFetchJson;
};

export type EnsureConciergeSlaTaskResult =
  | {
      ok: true;
      taskId: string;
      created: boolean;
      recovered: boolean;
    }
  | {
      ok: false;
      error: string;
      component: "task" | "task_association" | "due_timestamp";
    };

type HubSpotObject = {
  id: string;
  properties?: Record<string, string | null | undefined>;
};

type AssociationList = {
  results?: Array<{ id: string; type?: string }>;
};

function resolveToken(explicit?: string): string | null {
  if (explicit?.trim()) return explicit.trim();
  return resolveHubSpotToken().token;
}

export function getConfiguredHubSpotOwnerId(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const value = env.HUBSPOT_OWNER_ID?.trim();
  return value || null;
}

export function getConfiguredHubSpotPortalId(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const value = env.HUBSPOT_PORTAL_ID?.trim();
  return value || null;
}

export function buildHubSpotDealUrl(
  dealId: string,
  portalId: string | null = getConfiguredHubSpotPortalId(),
): string | null {
  if (!portalId || !dealId) return null;
  return `https://app.hubspot.com/contacts/${encodeURIComponent(portalId)}/record/0-3/${encodeURIComponent(dealId)}`;
}

/**
 * Validate configured owner against HubSpot owners API.
 * Returns owner id only when the GET succeeds.
 */
export async function validateHubSpotOwnerId(
  ownerId: string,
  options?: {
    token?: string;
    fetchJson?: typeof hubspotFetchJson;
  },
): Promise<{ valid: boolean; ownerId: string | null; error?: string }> {
  const token = resolveToken(options?.token);
  if (!token) {
    return { valid: false, ownerId: null, error: "missing_hubspot_token" };
  }
  const fetchJson = options?.fetchJson ?? hubspotFetchJson;
  try {
    const owner = await fetchJson<{ id?: string | number }>(
      `/crm/v3/owners/${encodeURIComponent(ownerId)}`,
      { method: "GET" },
      { token },
    );
    if (owner?.id != null && String(owner.id) === ownerId) {
      return { valid: true, ownerId };
    }
    return { valid: false, ownerId: null, error: "owner_not_found" };
  } catch (error) {
    const message =
      error instanceof HubSpotRequestError
        ? `hubspot_${error.status}`
        : error instanceof Error
          ? error.message
          : "owner_validate_failed";
    return { valid: false, ownerId: null, error: message };
  }
}

async function listTaskIdsForDeal(
  dealId: string,
  token: string,
  fetchJson: typeof hubspotFetchJson,
): Promise<string[]> {
  const associated = await fetchJson<AssociationList>(
    `/crm/v3/objects/deals/${encodeURIComponent(dealId)}/associations/tasks`,
    { method: "GET" },
    { token },
  );
  return (associated?.results ?? []).map((r) => r.id).filter(Boolean);
}

async function readTask(
  taskId: string,
  token: string,
  fetchJson: typeof hubspotFetchJson,
): Promise<HubSpotObject | null> {
  return fetchJson<HubSpotObject>(
    `/crm/v3/objects/tasks/${encodeURIComponent(taskId)}?properties=${encodeURIComponent(
      "hs_task_subject,hs_task_status,hs_timestamp,hs_task_priority,hs_task_completion_date,hubspot_owner_id",
    )}`,
    { method: "GET" },
    { token, treatNotFoundAsEmpty: true },
  );
}

/**
 * Find an existing Concierge SLA task for a deal by association + subject match.
 * This is the duplicate-prevention path after create timeouts.
 */
export async function findExistingConciergeSlaTask(options: {
  dealId: string;
  token?: string;
  fetchJson?: typeof hubspotFetchJson;
}): Promise<{ taskId: string; status: string | null } | null> {
  const token = resolveToken(options.token);
  if (!token) return null;
  const fetchJson = options.fetchJson ?? hubspotFetchJson;

  const taskIds = await listTaskIdsForDeal(options.dealId, token, fetchJson);
  for (const taskId of taskIds) {
    const task = await readTask(taskId, token, fetchJson);
    const subject = task?.properties?.hs_task_subject ?? null;
    if (isConciergeSlaTaskSubject(subject, options.dealId)) {
      return {
        taskId,
        status: task?.properties?.hs_task_status ?? null,
      };
    }
    // Fallback: subject prefix + deal id token (defensive).
    if (
      subject?.startsWith(CONCIERGE_SLA_TASK_SUBJECT_PREFIX) &&
      subject.includes(options.dealId)
    ) {
      return {
        taskId,
        status: task?.properties?.hs_task_status ?? null,
      };
    }
  }
  return null;
}

export async function readConciergeSlaTaskStatus(options: {
  taskId: string;
  token?: string;
  fetchJson?: typeof hubspotFetchJson;
}): Promise<{
  found: boolean;
  status: string | null;
  completed: boolean;
}> {
  const token = resolveToken(options.token);
  if (!token) {
    return { found: false, status: null, completed: false };
  }
  const fetchJson = options.fetchJson ?? hubspotFetchJson;
  try {
    const task = await readTask(options.taskId, token, fetchJson);
    if (!task?.id) {
      return { found: false, status: null, completed: false };
    }
    const status = (task.properties?.hs_task_status || "").toUpperCase();
    return {
      found: true,
      status: task.properties?.hs_task_status ?? null,
      completed: status === "COMPLETED",
    };
  } catch {
    return { found: false, status: null, completed: false };
  }
}

export async function ensureConciergeSlaTask(
  input: EnsureConciergeSlaTaskInput,
): Promise<EnsureConciergeSlaTaskResult> {
  const token = resolveToken(input.token);
  if (!token) {
    return { ok: false, error: "missing_hubspot_token", component: "task" };
  }
  if (!input.dealId || !input.contactId) {
    return { ok: false, error: "missing_ids", component: "task" };
  }
  if (!Number.isFinite(Date.parse(input.dueAtIso))) {
    return {
      ok: false,
      error: "invalid_due_at",
      component: "due_timestamp",
    };
  }

  const fetchJson = input.fetchJson ?? hubspotFetchJson;

  try {
    const existing = await findExistingConciergeSlaTask({
      dealId: input.dealId,
      token,
      fetchJson,
    });
    if (existing) {
      return {
        ok: true,
        taskId: existing.taskId,
        created: false,
        recovered: true,
      };
    }
  } catch (error) {
    // Association read failure should not block create attempt, but create
    // may still duplicate if prior create succeeded — log upstream.
    if (
      error instanceof Error &&
      error.message === "hubspot_timeout"
    ) {
      // Fall through to create; watchdog recovery handles duplicates via subject.
    }
  }

  let ownerId: string | undefined;
  if (input.ownerId?.trim()) {
    const validated = await validateHubSpotOwnerId(input.ownerId.trim(), {
      token,
      fetchJson,
    });
    if (validated.valid && validated.ownerId) {
      ownerId = validated.ownerId;
    }
  }

  const properties: Record<string, string> = {
    hs_timestamp: input.dueAtIso,
    hs_task_subject: conciergeSlaTaskSubject(input.dealId),
    hs_task_status: "NOT_STARTED",
    hs_task_priority: "HIGH",
    hs_task_type: "TODO",
    hs_task_body:
      "Hourglass Concierge 24-hour first-contact SLA. Mark COMPLETED after confirmed first contact.",
  };
  if (ownerId) {
    properties.hubspot_owner_id = ownerId;
  }
  if (
    typeof input.reminderAtMs === "number" &&
    Number.isFinite(input.reminderAtMs)
  ) {
    properties.hs_task_reminders = String(Math.trunc(input.reminderAtMs));
  }

  try {
    const created = await fetchJson<{ id: string }>(
      "/crm/v3/objects/tasks",
      {
        method: "POST",
        body: JSON.stringify({
          properties,
          associations: [
            {
              to: { id: input.contactId },
              types: [
                {
                  associationCategory: "HUBSPOT_DEFINED",
                  associationTypeId: HUBSPOT_TASK_TO_CONTACT_ASSOCIATION,
                },
              ],
            },
            {
              to: { id: input.dealId },
              types: [
                {
                  associationCategory: "HUBSPOT_DEFINED",
                  associationTypeId: HUBSPOT_TASK_TO_DEAL_ASSOCIATION,
                },
              ],
            },
          ],
        }),
      },
      { token },
    );

    if (!created?.id) {
      // Timeout-after-create recovery: re-scan associations.
      const recovered = await findExistingConciergeSlaTask({
        dealId: input.dealId,
        token,
        fetchJson,
      }).catch(() => null);
      if (recovered) {
        return {
          ok: true,
          taskId: recovered.taskId,
          created: false,
          recovered: true,
        };
      }
      return {
        ok: false,
        error: "hubspot_task_create_failed",
        component: "task",
      };
    }

    return {
      ok: true,
      taskId: created.id,
      created: true,
      recovered: false,
    };
  } catch (error) {
    // Classic timeout-after-success: HubSpot may have the task already.
    const recovered = await findExistingConciergeSlaTask({
      dealId: input.dealId,
      token,
      fetchJson,
    }).catch(() => null);
    if (recovered) {
      return {
        ok: true,
        taskId: recovered.taskId,
        created: false,
        recovered: true,
      };
    }

    const message =
      error instanceof HubSpotRequestError
        ? `hubspot_${error.status}`
        : error instanceof Error
          ? error.message
          : "task_create_failed";
    return { ok: false, error: message, component: "task" };
  }
}
