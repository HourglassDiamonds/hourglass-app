/**
 * Supabase Concierge SLA ledger — server-only, service role.
 * Non-PII: deal/contact/task/submission IDs and timestamps only.
 */

import { getSupabaseAdmin } from "@/lib/supabase/client";
import { createMemoryConciergeSlaStore } from "./memory-store";
import type {
  ConciergeSlaPatch,
  ConciergeSlaRecord,
  ConciergeSlaStatus,
  ConciergeSlaStore,
  ConciergeSlaUpsertInput,
} from "./types";
import { CONCIERGE_SLA_STATUSES } from "./types";

type Row = {
  deal_id: string;
  contact_id: string | null;
  task_id: string | null;
  submission_id: string | null;
  submitted_at: string;
  due_at: string;
  completed_at: string | null;
  immediate_alerted_at: string | null;
  due_soon_alerted_at: string | null;
  overdue_alerted_at: string | null;
  last_checked_at: string | null;
  status: string;
  last_error: string | null;
  setup_failed_component: string | null;
  task_recovery_attempts: number | null;
};

function isStatus(value: string): value is ConciergeSlaStatus {
  return (CONCIERGE_SLA_STATUSES as readonly string[]).includes(value);
}

function fromRow(row: Row): ConciergeSlaRecord {
  return {
    dealId: row.deal_id,
    contactId: row.contact_id,
    taskId: row.task_id,
    submissionId: row.submission_id,
    submittedAt: row.submitted_at,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    immediateAlertedAt: row.immediate_alerted_at,
    dueSoonAlertedAt: row.due_soon_alerted_at,
    overdueAlertedAt: row.overdue_alerted_at,
    lastCheckedAt: row.last_checked_at,
    status: isStatus(row.status) ? row.status : "open",
    lastError: row.last_error,
    setupFailedComponent: row.setup_failed_component,
    taskRecoveryAttempts: row.task_recovery_attempts ?? 0,
  };
}

const PII_COLUMNS = [
  "email",
  "phone",
  "full_name",
  "name",
  "message",
  "inspiration_notes",
  "notes",
] as const;

/** Runtime guard — schema must never include these columns. */
export function assertConciergeSlaSchemaHasNoPii(
  columnNames: string[],
): void {
  for (const col of columnNames) {
    if ((PII_COLUMNS as readonly string[]).includes(col)) {
      throw new Error(`concierge_sla_pii_column_forbidden:${col}`);
    }
  }
}

export function createSupabaseConciergeSlaStore(): ConciergeSlaStore | null {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  return {
    async upsertByDealId(
      input: ConciergeSlaUpsertInput,
    ): Promise<ConciergeSlaRecord> {
      if (input.submissionId) {
        const bySub = await admin
          .from("concierge_sla_obligations")
          .select("*")
          .eq("submission_id", input.submissionId)
          .maybeSingle();
        if (bySub.data && !bySub.error) {
          const existing = fromRow(bySub.data as Row);
          if (existing.dealId !== input.dealId) {
            return existing;
          }
        }
      }

      const { data: existing, error: readError } = await admin
        .from("concierge_sla_obligations")
        .select("*")
        .eq("deal_id", input.dealId)
        .maybeSingle();

      if (readError) {
        throw new Error(`concierge_sla_read_failed:${readError.code ?? "db"}`);
      }

      if (existing) {
        const patch: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (input.contactId) patch.contact_id = input.contactId;
        if (input.taskId) patch.task_id = input.taskId;
        if (input.submissionId) patch.submission_id = input.submissionId;
        if (input.status) patch.status = input.status;
        if (input.lastError !== undefined) patch.last_error = input.lastError;
        if (input.setupFailedComponent !== undefined) {
          patch.setup_failed_component = input.setupFailedComponent;
        }

        const { data, error } = await admin
          .from("concierge_sla_obligations")
          .update(patch)
          .eq("deal_id", input.dealId)
          .select("*")
          .single();
        if (error || !data) {
          throw new Error(`concierge_sla_update_failed:${error?.code ?? "db"}`);
        }
        return fromRow(data as Row);
      }

      const insert = {
        deal_id: input.dealId,
        contact_id: input.contactId ?? null,
        task_id: input.taskId ?? null,
        submission_id: input.submissionId ?? null,
        submitted_at: input.submittedAt,
        due_at: input.dueAt,
        status: input.status ?? "open",
        last_error: input.lastError ?? null,
        setup_failed_component: input.setupFailedComponent ?? null,
        task_recovery_attempts: 0,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await admin
        .from("concierge_sla_obligations")
        .insert(insert)
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(`concierge_sla_insert_failed:${error?.code ?? "db"}`);
      }
      return fromRow(data as Row);
    },

    async getByDealId(dealId: string): Promise<ConciergeSlaRecord | null> {
      const { data, error } = await admin
        .from("concierge_sla_obligations")
        .select("*")
        .eq("deal_id", dealId)
        .maybeSingle();
      if (error) {
        throw new Error(`concierge_sla_read_failed:${error.code ?? "db"}`);
      }
      return data ? fromRow(data as Row) : null;
    },

    async getBySubmissionId(
      submissionId: string,
    ): Promise<ConciergeSlaRecord | null> {
      const { data, error } = await admin
        .from("concierge_sla_obligations")
        .select("*")
        .eq("submission_id", submissionId)
        .maybeSingle();
      if (error) {
        throw new Error(`concierge_sla_read_failed:${error.code ?? "db"}`);
      }
      return data ? fromRow(data as Row) : null;
    },

    async listOpen(): Promise<ConciergeSlaRecord[]> {
      const { data, error } = await admin
        .from("concierge_sla_obligations")
        .select("*")
        .in("status", ["open", "setup_failed"]);
      if (error) {
        throw new Error(`concierge_sla_list_failed:${error.code ?? "db"}`);
      }
      return (data as Row[] | null)?.map(fromRow) ?? [];
    },

    async listOverdueOpen(nowIso: string): Promise<ConciergeSlaRecord[]> {
      const { data, error } = await admin
        .from("concierge_sla_obligations")
        .select("*")
        .in("status", ["open", "setup_failed"])
        .lte("due_at", nowIso)
        .is("completed_at", null);
      if (error) {
        throw new Error(`concierge_sla_list_failed:${error.code ?? "db"}`);
      }
      return (data as Row[] | null)?.map(fromRow) ?? [];
    },

    async patch(
      dealId: string,
      patch: ConciergeSlaPatch,
    ): Promise<ConciergeSlaRecord> {
      const row: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (patch.contactId !== undefined) row.contact_id = patch.contactId;
      if (patch.taskId !== undefined) row.task_id = patch.taskId;
      if (patch.submissionId !== undefined) {
        row.submission_id = patch.submissionId;
      }
      if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
      if (patch.immediateAlertedAt !== undefined) {
        row.immediate_alerted_at = patch.immediateAlertedAt;
      }
      if (patch.dueSoonAlertedAt !== undefined) {
        row.due_soon_alerted_at = patch.dueSoonAlertedAt;
      }
      if (patch.overdueAlertedAt !== undefined) {
        row.overdue_alerted_at = patch.overdueAlertedAt;
      }
      if (patch.lastCheckedAt !== undefined) {
        row.last_checked_at = patch.lastCheckedAt;
      }
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.lastError !== undefined) row.last_error = patch.lastError;
      if (patch.setupFailedComponent !== undefined) {
        row.setup_failed_component = patch.setupFailedComponent;
      }
      if (patch.taskRecoveryAttempts !== undefined) {
        row.task_recovery_attempts = patch.taskRecoveryAttempts;
      }

      const { data, error } = await admin
        .from("concierge_sla_obligations")
        .update(row)
        .eq("deal_id", dealId)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`concierge_sla_patch_failed:${error?.code ?? "db"}`);
      }
      return fromRow(data as Row);
    },
  };
}

export function getDefaultConciergeSlaStore(): ConciergeSlaStore | null {
  // Deterministic in-process store for unit/route tests — never for production.
  if (
    process.env.CONCIERGE_SLA_TEST_MEMORY === "1" &&
    process.env.NODE_ENV !== "production"
  ) {
    const g = globalThis as {
      __conciergeSlaTestStore?: ConciergeSlaStore;
    };
    if (!g.__conciergeSlaTestStore) {
      g.__conciergeSlaTestStore = createMemoryConciergeSlaStore();
    }
    return g.__conciergeSlaTestStore;
  }
  return createSupabaseConciergeSlaStore();
}

export function resetConciergeSlaTestStore(): void {
  delete (globalThis as { __conciergeSlaTestStore?: ConciergeSlaStore })
    .__conciergeSlaTestStore;
}
