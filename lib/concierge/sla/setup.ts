/**
 * Post-deal Concierge SLA setup: ledger → task ensure → immediate alert.
 * Customer success is already earned once the deal exists; failures here are operational.
 * No-ops when CONCIERGE_SLA_ENABLED is not exactly "true".
 */

import type { AgentOsEmailSender } from "@/lib/agent-os/cadence-delivery/send-email";
import { sendConciergeSlaAlert } from "./alerts";
import { isConciergeSlaEnabled } from "./enabled";
import {
  ensureConciergeSlaTask,
  getConfiguredHubSpotOwnerId,
} from "./hubspot-tasks";
import { getDefaultConciergeSlaStore } from "./ledger";
import { logConciergeSla } from "./log";
import { dueAtFromSubmittedAt } from "./time";
import type {
  ConciergeSlaRecord,
  ConciergeSlaSetupFailedComponent,
  ConciergeSlaStore,
} from "./types";
import type { hubspotFetchJson } from "@/lib/concierge/hubspot-client";

export type ConciergeSlaSetupInput = {
  dealId: string;
  contactId: string;
  submissionId: string;
  submittedAt?: string;
  token?: string;
  store?: ConciergeSlaStore | null;
  emailSender?: AgentOsEmailSender;
  fetchJson?: typeof hubspotFetchJson;
  ownerId?: string | null;
  /** Test override — production uses isConciergeSlaEnabled(). */
  enabled?: boolean;
};

export type ConciergeSlaSetupResult = {
  ok: boolean;
  skipped: boolean;
  record: ConciergeSlaRecord | null;
  taskId: string | null;
  immediateAlertSent: boolean;
  setupFailed: boolean;
  failedComponent: ConciergeSlaSetupFailedComponent | null;
};

async function emitSetupFailure(options: {
  dealId: string;
  submittedAt: string;
  dueAt: string;
  component: ConciergeSlaSetupFailedComponent;
  taskId?: string | null;
  emailSender?: AgentOsEmailSender;
}): Promise<void> {
  logConciergeSla("concierge_sla_setup_failed", {
    deal_id: options.dealId,
    task_id: options.taskId ?? null,
    component: options.component,
    status: "setup_failed",
  });

  const alert = await sendConciergeSlaAlert(
    {
      kind: "setup_failure",
      dealId: options.dealId,
      submittedAt: options.submittedAt,
      dueAt: options.dueAt,
      taskId: options.taskId,
      failedComponent: options.component,
    },
    { sender: options.emailSender },
  );

  if (!alert.ok) {
    // Loud fallback when Resend itself is unavailable.
    console.error("[concierge_sla_setup_failed]", {
      event: "concierge_sla_setup_failed",
      severity: "high",
      deal_id: options.dealId,
      component: options.component,
      alert_error: alert.error,
      note: "resend_unavailable_or_failed",
    });
  }
}

/**
 * After HubSpot deal creation succeeds, establish SLA protection.
 * Never throws to the Concierge customer path — always returns a result.
 * When CONCIERGE_SLA_ENABLED is not "true", returns skipped with zero side effects.
 */
export async function setupConciergeSlaAfterDeal(
  input: ConciergeSlaSetupInput,
): Promise<ConciergeSlaSetupResult> {
  const enabled =
    input.enabled !== undefined ? input.enabled : isConciergeSlaEnabled();
  if (!enabled) {
    return {
      ok: true,
      skipped: true,
      record: null,
      taskId: null,
      immediateAlertSent: false,
      setupFailed: false,
      failedComponent: null,
    };
  }

  const submittedAt = input.submittedAt ?? new Date().toISOString();
  let dueAt: string;
  try {
    dueAt = dueAtFromSubmittedAt(submittedAt);
  } catch {
    await emitSetupFailure({
      dealId: input.dealId,
      submittedAt,
      dueAt: submittedAt,
      component: "due_timestamp",
      emailSender: input.emailSender,
    });
    return {
      ok: false,
      skipped: false,
      record: null,
      taskId: null,
      immediateAlertSent: false,
      setupFailed: true,
      failedComponent: "due_timestamp",
    };
  }

  const store =
    input.store === undefined ? getDefaultConciergeSlaStore() : input.store;

  if (!store) {
    await emitSetupFailure({
      dealId: input.dealId,
      submittedAt,
      dueAt,
      component: "ledger",
      emailSender: input.emailSender,
    });
    return {
      ok: false,
      skipped: false,
      record: null,
      taskId: null,
      immediateAlertSent: false,
      setupFailed: true,
      failedComponent: "ledger",
    };
  }

  let record: ConciergeSlaRecord;
  try {
    record = await store.upsertByDealId({
      dealId: input.dealId,
      contactId: input.contactId,
      submissionId: input.submissionId,
      submittedAt,
      dueAt,
      status: "open",
      lastError: null,
      setupFailedComponent: null,
    });
    logConciergeSla("concierge_sla_created", {
      deal_id: input.dealId,
      submission_id: input.submissionId.slice(0, 12),
      due_at: dueAt,
      status: "open",
    });
  } catch {
    await emitSetupFailure({
      dealId: input.dealId,
      submittedAt,
      dueAt,
      component: "ledger",
      emailSender: input.emailSender,
    });
    return {
      ok: false,
      skipped: false,
      record: null,
      taskId: null,
      immediateAlertSent: false,
      setupFailed: true,
      failedComponent: "ledger",
    };
  }

  const ownerId =
    input.ownerId !== undefined
      ? input.ownerId
      : getConfiguredHubSpotOwnerId();

  const dueMs = Date.parse(dueAt);
  const reminderAtMs = Number.isFinite(dueMs)
    ? dueMs - 4 * 3600_000
    : null;

  const taskResult = await ensureConciergeSlaTask({
    dealId: input.dealId,
    contactId: input.contactId,
    dueAtIso: dueAt,
    token: input.token,
    ownerId,
    reminderAtMs,
    fetchJson: input.fetchJson,
  });

  if (!taskResult.ok) {
    try {
      record = await store.patch(input.dealId, {
        status: "setup_failed",
        lastError: taskResult.error,
        setupFailedComponent: taskResult.component,
      });
    } catch {
      // ledger patch failure secondary
    }
    logConciergeSla("concierge_sla_task_create_failed", {
      deal_id: input.dealId,
      submission_id: input.submissionId.slice(0, 12),
      due_at: dueAt,
      error: taskResult.error,
      component: taskResult.component,
      status: "setup_failed",
    });
    await emitSetupFailure({
      dealId: input.dealId,
      submittedAt,
      dueAt,
      component: taskResult.component,
      emailSender: input.emailSender,
    });
    return {
      ok: false,
      skipped: false,
      record,
      taskId: null,
      immediateAlertSent: false,
      setupFailed: true,
      failedComponent: taskResult.component,
    };
  }

  try {
    record = await store.patch(input.dealId, {
      taskId: taskResult.taskId,
      status: "open",
      lastError: null,
      setupFailedComponent: null,
    });
  } catch {
    // Task exists; ledger task_id update failed — still operationally loud.
    await emitSetupFailure({
      dealId: input.dealId,
      submittedAt,
      dueAt,
      component: "ledger",
      taskId: taskResult.taskId,
      emailSender: input.emailSender,
    });
  }

  if (taskResult.created) {
    logConciergeSla("concierge_sla_task_created", {
      deal_id: input.dealId,
      task_id: taskResult.taskId,
      due_at: dueAt,
      status: "open",
    });
  } else if (taskResult.recovered) {
    logConciergeSla("concierge_sla_task_recovered", {
      deal_id: input.dealId,
      task_id: taskResult.taskId,
      due_at: dueAt,
      status: "open",
      recovered: true,
    });
  }

  let immediateAlertSent = false;
  if (!record.immediateAlertedAt) {
    const alert = await sendConciergeSlaAlert(
      {
        kind: "immediate",
        dealId: input.dealId,
        submittedAt,
        dueAt,
        taskId: taskResult.taskId,
      },
      { sender: input.emailSender },
    );
    if (alert.ok) {
      immediateAlertSent = true;
      try {
        record = await store.patch(input.dealId, {
          immediateAlertedAt: new Date().toISOString(),
        });
      } catch {
        // Stamp failure — next setup/watchdog may retry; Resend idempotency key protects.
      }
      logConciergeSla("concierge_sla_immediate_alert_sent", {
        deal_id: input.dealId,
        task_id: taskResult.taskId,
        due_at: dueAt,
        status: "open",
      });
    } else {
      logConciergeSla("concierge_sla_setup_failed", {
        deal_id: input.dealId,
        task_id: taskResult.taskId,
        component: "immediate_alert",
        error: alert.error,
        status: "open",
      });
      console.error("[concierge_sla_immediate_alert_failed]", {
        event: "concierge_sla_immediate_alert_failed",
        deal_id: input.dealId,
        error: alert.error,
      });
    }
  }

  return {
    ok: true,
    skipped: false,
    record,
    taskId: taskResult.taskId,
    immediateAlertSent,
    setupFailed: false,
    failedComponent: null,
  };
}
