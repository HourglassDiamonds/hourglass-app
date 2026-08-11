/**
 * In-memory Concierge SLA store — tests and local fallback only.
 * Production uses Supabase via createSupabaseConciergeSlaStore.
 */

import type {
  ConciergeSlaPatch,
  ConciergeSlaRecord,
  ConciergeSlaStore,
  ConciergeSlaUpsertInput,
} from "./types";

function clone(record: ConciergeSlaRecord): ConciergeSlaRecord {
  return { ...record };
}

export function createMemoryConciergeSlaStore(): ConciergeSlaStore & {
  _rows: Map<string, ConciergeSlaRecord>;
} {
  const rows = new Map<string, ConciergeSlaRecord>();

  const store: ConciergeSlaStore & { _rows: Map<string, ConciergeSlaRecord> } = {
    _rows: rows,

    async upsertByDealId(input: ConciergeSlaUpsertInput): Promise<ConciergeSlaRecord> {
      const existing = rows.get(input.dealId);
      if (existing) {
        const next: ConciergeSlaRecord = {
          ...existing,
          contactId: input.contactId ?? existing.contactId,
          taskId: input.taskId ?? existing.taskId,
          submissionId: input.submissionId ?? existing.submissionId,
          submittedAt: existing.submittedAt || input.submittedAt,
          dueAt: existing.dueAt || input.dueAt,
          status: input.status ?? existing.status,
          lastError:
            input.lastError !== undefined ? input.lastError : existing.lastError,
          setupFailedComponent:
            input.setupFailedComponent !== undefined
              ? input.setupFailedComponent
              : existing.setupFailedComponent,
        };
        rows.set(input.dealId, next);
        return clone(next);
      }

      if (input.submissionId) {
        for (const row of rows.values()) {
          if (row.submissionId === input.submissionId) {
            return clone(row);
          }
        }
      }

      const created: ConciergeSlaRecord = {
        dealId: input.dealId,
        contactId: input.contactId ?? null,
        taskId: input.taskId ?? null,
        submissionId: input.submissionId ?? null,
        submittedAt: input.submittedAt,
        dueAt: input.dueAt,
        completedAt: null,
        immediateAlertedAt: null,
        dueSoonAlertedAt: null,
        overdueAlertedAt: null,
        lastCheckedAt: null,
        status: input.status ?? "open",
        lastError: input.lastError ?? null,
        setupFailedComponent: input.setupFailedComponent ?? null,
        taskRecoveryAttempts: 0,
      };
      rows.set(input.dealId, created);
      return clone(created);
    },

    async getByDealId(dealId: string): Promise<ConciergeSlaRecord | null> {
      const row = rows.get(dealId);
      return row ? clone(row) : null;
    },

    async getBySubmissionId(
      submissionId: string,
    ): Promise<ConciergeSlaRecord | null> {
      for (const row of rows.values()) {
        if (row.submissionId === submissionId) return clone(row);
      }
      return null;
    },

    async listOpen(): Promise<ConciergeSlaRecord[]> {
      return [...rows.values()]
        .filter((r) => r.status === "open" || r.status === "setup_failed")
        .map(clone);
    },

    async listOverdueOpen(nowIso: string): Promise<ConciergeSlaRecord[]> {
      const now = Date.parse(nowIso);
      return [...rows.values()]
        .filter(
          (r) =>
            (r.status === "open" || r.status === "setup_failed") &&
            Date.parse(r.dueAt) <= now &&
            !r.completedAt,
        )
        .map(clone);
    },

    async patch(
      dealId: string,
      patch: ConciergeSlaPatch,
    ): Promise<ConciergeSlaRecord> {
      const existing = rows.get(dealId);
      if (!existing) {
        throw new Error("concierge_sla_not_found");
      }
      const next: ConciergeSlaRecord = { ...existing, ...patch };
      rows.set(dealId, next);
      return clone(next);
    },
  };

  return store;
}
