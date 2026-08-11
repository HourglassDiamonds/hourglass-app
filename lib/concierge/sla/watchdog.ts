/**
 * Hourly Concierge SLA watchdog — independent of Chief of Staff.
 * Idempotent threshold alerts; task completion is canonical first-contact signal.
 */

import type { AgentOsEmailSender } from "@/lib/agent-os/cadence-delivery/send-email";
import type { hubspotFetchJson } from "@/lib/concierge/hubspot-client";
import { resolveHubSpotToken } from "@/lib/concierge/hubspot-client";
import { sendConciergeSlaAlert } from "./alerts";
import { isConciergeSlaEnabled } from "./enabled";
import {
  ensureConciergeSlaTask,
  findExistingConciergeSlaTask,
  getConfiguredHubSpotOwnerId,
  readConciergeSlaTaskStatus,
} from "./hubspot-tasks";
import { getDefaultConciergeSlaStore } from "./ledger";
import { logConciergeSla } from "./log";
import { ageHours, isDueSoonWindow, isOverdueWindow } from "./time";
import {
  CONCIERGE_SLA_MAX_TASK_RECOVERY_ATTEMPTS,
  type ConciergeSlaRecord,
  type ConciergeSlaStore,
} from "./types";

export type ConciergeSlaWatchdogOptions = {
  nowIso?: string;
  store?: ConciergeSlaStore | null;
  emailSender?: AgentOsEmailSender;
  fetchJson?: typeof hubspotFetchJson;
  token?: string;
  /** Test override — production uses isConciergeSlaEnabled(). */
  enabled?: boolean;
};

export type ConciergeSlaWatchdogResult = {
  ok: boolean;
  enabled: boolean;
  checked: number;
  completed: number;
  dueSoonSent: number;
  overdueSent: number;
  recoveredTasks: number;
  errors: number;
  alertsSent: number;
};

async function reconcileOne(
  record: ConciergeSlaRecord,
  options: {
    nowIso: string;
    store: ConciergeSlaStore;
    emailSender?: AgentOsEmailSender;
    fetchJson?: typeof hubspotFetchJson;
    token?: string;
  },
): Promise<{
  completed: boolean;
  dueSoonSent: boolean;
  overdueSent: boolean;
  recovered: boolean;
  error: boolean;
}> {
  const out = {
    completed: false,
    dueSoonSent: false,
    overdueSent: false,
    recovered: false,
    error: false,
  };

  let current = record;
  const token =
    options.token ?? resolveHubSpotToken().token ?? undefined;

  await options.store.patch(current.dealId, {
    lastCheckedAt: options.nowIso,
  });

  // --- Reconcile HubSpot task completion / missing task ---
  if (token) {
    try {
      if (current.taskId) {
        const status = await readConciergeSlaTaskStatus({
          taskId: current.taskId,
          token,
          fetchJson: options.fetchJson,
        });
        if (status.found && status.completed) {
          current = await options.store.patch(current.dealId, {
            status: "completed",
            completedAt: options.nowIso,
            lastError: null,
          });
          logConciergeSla("concierge_sla_completed", {
            deal_id: current.dealId,
            task_id: current.taskId,
            due_at: current.dueAt,
            age_hours: Math.round(ageHours(current.submittedAt, options.nowIso)),
            status: "completed",
          });
          out.completed = true;
          return out;
        }
        if (!status.found) {
          // Missing/deleted task — not completed. Recover if under attempt cap.
          if (
            current.taskRecoveryAttempts < CONCIERGE_SLA_MAX_TASK_RECOVERY_ATTEMPTS &&
            current.contactId
          ) {
            const ensured = await ensureConciergeSlaTask({
              dealId: current.dealId,
              contactId: current.contactId,
              dueAtIso: current.dueAt,
              token,
              ownerId: getConfiguredHubSpotOwnerId(),
              fetchJson: options.fetchJson,
            });
            current = await options.store.patch(current.dealId, {
              taskRecoveryAttempts: current.taskRecoveryAttempts + 1,
              taskId: ensured.ok ? ensured.taskId : current.taskId,
              lastError: ensured.ok ? null : ensured.error,
              status: ensured.ok ? "open" : current.status,
            });
            if (ensured.ok) {
              out.recovered = true;
              logConciergeSla("concierge_sla_task_recovered", {
                deal_id: current.dealId,
                task_id: ensured.taskId,
                due_at: current.dueAt,
                status: "open",
                recovered: true,
              });
            }
          }
        }
      } else if (current.contactId) {
        // No task_id on ledger — try find or recreate.
        const existing = await findExistingConciergeSlaTask({
          dealId: current.dealId,
          token,
          fetchJson: options.fetchJson,
        });
        if (existing) {
          if ((existing.status || "").toUpperCase() === "COMPLETED") {
            current = await options.store.patch(current.dealId, {
              taskId: existing.taskId,
              status: "completed",
              completedAt: options.nowIso,
            });
            out.completed = true;
            logConciergeSla("concierge_sla_completed", {
              deal_id: current.dealId,
              task_id: existing.taskId,
              due_at: current.dueAt,
              status: "completed",
            });
            return out;
          }
          current = await options.store.patch(current.dealId, {
            taskId: existing.taskId,
            status: "open",
          });
          out.recovered = true;
        } else if (
          current.taskRecoveryAttempts < CONCIERGE_SLA_MAX_TASK_RECOVERY_ATTEMPTS
        ) {
          const ensured = await ensureConciergeSlaTask({
            dealId: current.dealId,
            contactId: current.contactId,
            dueAtIso: current.dueAt,
            token,
            ownerId: getConfiguredHubSpotOwnerId(),
            fetchJson: options.fetchJson,
          });
          current = await options.store.patch(current.dealId, {
            taskRecoveryAttempts: current.taskRecoveryAttempts + 1,
            taskId: ensured.ok ? ensured.taskId : null,
            lastError: ensured.ok ? null : ensured.error,
          });
          if (ensured.ok) {
            out.recovered = true;
            logConciergeSla("concierge_sla_task_recovered", {
              deal_id: current.dealId,
              task_id: ensured.taskId,
              due_at: current.dueAt,
              recovered: true,
            });
          }
        }
      }
    } catch {
      // HubSpot unavailable — leave SLA open; retry next hour.
      out.error = true;
      return out;
    }
  }

  if (current.status === "completed" || current.completedAt) {
    out.completed = true;
    return out;
  }

  const age = ageHours(current.submittedAt, options.nowIso);

  // Immediate alert retry if never stamped (deal existed; Resend failed earlier).
  if (!current.immediateAlertedAt) {
    const alert = await sendConciergeSlaAlert(
      {
        kind: "immediate",
        dealId: current.dealId,
        submittedAt: current.submittedAt,
        dueAt: current.dueAt,
        taskId: current.taskId,
      },
      { sender: options.emailSender },
    );
    if (alert.ok) {
      current = await options.store.patch(current.dealId, {
        immediateAlertedAt: options.nowIso,
      });
      logConciergeSla("concierge_sla_immediate_alert_sent", {
        deal_id: current.dealId,
        task_id: current.taskId,
        due_at: current.dueAt,
        age_hours: Math.round(age),
      });
    }
  }

  if (
    isDueSoonWindow(current.submittedAt, options.nowIso) &&
    !current.dueSoonAlertedAt
  ) {
    const alert = await sendConciergeSlaAlert(
      {
        kind: "due_soon",
        dealId: current.dealId,
        submittedAt: current.submittedAt,
        dueAt: current.dueAt,
        taskId: current.taskId,
      },
      { sender: options.emailSender },
    );
    if (alert.ok) {
      await options.store.patch(current.dealId, {
        dueSoonAlertedAt: options.nowIso,
      });
      out.dueSoonSent = true;
      logConciergeSla("concierge_sla_due_soon", {
        deal_id: current.dealId,
        task_id: current.taskId,
        due_at: current.dueAt,
        age_hours: Math.round(age),
        status: current.status,
      });
    }
    return out;
  }

  if (
    isOverdueWindow(current.submittedAt, options.nowIso) &&
    !current.overdueAlertedAt
  ) {
    const alert = await sendConciergeSlaAlert(
      {
        kind: "overdue",
        dealId: current.dealId,
        submittedAt: current.submittedAt,
        dueAt: current.dueAt,
        taskId: current.taskId,
      },
      { sender: options.emailSender },
    );
    if (alert.ok) {
      await options.store.patch(current.dealId, {
        overdueAlertedAt: options.nowIso,
      });
      out.overdueSent = true;
      logConciergeSla("concierge_sla_overdue", {
        deal_id: current.dealId,
        task_id: current.taskId,
        due_at: current.dueAt,
        age_hours: Math.round(age),
        status: current.status,
      });
    }
  }

  return out;
}

export async function runConciergeSlaWatchdog(
  options: ConciergeSlaWatchdogOptions = {},
): Promise<ConciergeSlaWatchdogResult> {
  const enabled =
    options.enabled !== undefined ? options.enabled : isConciergeSlaEnabled();
  if (!enabled) {
    return {
      ok: true,
      enabled: false,
      checked: 0,
      completed: 0,
      dueSoonSent: 0,
      overdueSent: 0,
      recoveredTasks: 0,
      errors: 0,
      alertsSent: 0,
    };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  const store =
    options.store === undefined
      ? getDefaultConciergeSlaStore()
      : options.store;

  if (!store) {
    logConciergeSla("concierge_sla_watchdog_failed", {
      error: "ledger_unavailable",
      status: "failed",
    });
    return {
      ok: false,
      enabled: true,
      checked: 0,
      completed: 0,
      dueSoonSent: 0,
      overdueSent: 0,
      recoveredTasks: 0,
      errors: 1,
      alertsSent: 0,
    };
  }

  let open: ConciergeSlaRecord[];
  try {
    open = await store.listOpen();
  } catch (error) {
    logConciergeSla("concierge_sla_watchdog_failed", {
      error: error instanceof Error ? error.message : "list_failed",
    });
    return {
      ok: false,
      enabled: true,
      checked: 0,
      completed: 0,
      dueSoonSent: 0,
      overdueSent: 0,
      recoveredTasks: 0,
      errors: 1,
      alertsSent: 0,
    };
  }

  const result: ConciergeSlaWatchdogResult = {
    ok: true,
    enabled: true,
    checked: 0,
    completed: 0,
    dueSoonSent: 0,
    overdueSent: 0,
    recoveredTasks: 0,
    errors: 0,
    alertsSent: 0,
  };

  for (const record of open) {
    result.checked += 1;
    try {
      const one = await reconcileOne(record, {
        nowIso,
        store,
        emailSender: options.emailSender,
        fetchJson: options.fetchJson,
        token: options.token,
      });
      if (one.completed) result.completed += 1;
      if (one.dueSoonSent) result.dueSoonSent += 1;
      if (one.overdueSent) result.overdueSent += 1;
      if (one.recovered) result.recoveredTasks += 1;
      if (one.error) result.errors += 1;
    } catch (error) {
      result.errors += 1;
      logConciergeSla("concierge_sla_watchdog_failed", {
        deal_id: record.dealId,
        error: error instanceof Error ? error.message : "reconcile_failed",
      });
    }
  }

  result.alertsSent = result.dueSoonSent + result.overdueSent;
  result.ok = result.errors === 0;
  return result;
}

/** Live overdue count for Chief of Staff secondary escalation. */
export async function countOverdueConciergeSla(
  options: {
    nowIso?: string;
    store?: ConciergeSlaStore | null;
    enabled?: boolean;
  } = {},
): Promise<number> {
  const enabled =
    options.enabled !== undefined ? options.enabled : isConciergeSlaEnabled();
  if (!enabled) return 0;

  const nowIso = options.nowIso ?? new Date().toISOString();
  const store =
    options.store === undefined
      ? getDefaultConciergeSlaStore()
      : options.store;
  if (!store) return 0;
  try {
    const overdue = await store.listOverdueOpen(nowIso);
    return overdue.filter((r) => !r.completedAt).length;
  } catch {
    return 0;
  }
}
