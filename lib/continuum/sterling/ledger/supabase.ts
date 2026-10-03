import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { stableJson } from "../fingerprint";
import type { SterlingProposedAction } from "../types";
import { STERLING_PROPOSALS_TABLE, sterlingLedgerStateFromError } from "./activation";
import { InMemorySterlingProposalRepository } from "./repository";
import { proposalRecordToRow, rowToProposalRecord, STERLING_PROPOSAL_COLUMNS } from "./rows";
import type {
  CreateSterlingProposalInput,
  SterlingDecisionInput,
  SterlingLedgerResult,
  SterlingProposalRecord,
  SterlingProposalRepository,
  SterlingProposalStatus,
} from "./types";

const UNIQUE_VIOLATION = "23505";

export class SupabaseSterlingProposalRepository implements SterlingProposalRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: CreateSterlingProposalInput) {
    const memory = new InMemorySterlingProposalRepository();
    const seeded = await memory.create(input);
    const row = proposalRecordToRow(seeded.record);
    const { data, error } = await this.client.from(STERLING_PROPOSALS_TABLE)
      .insert(row).select(STERLING_PROPOSAL_COLUMNS).single();
    if (error?.code === UNIQUE_VIOLATION) {
      const existing = await this.get(input.proposalId);
      if (!existing || stableJson(existing.originalProposal) !== stableJson(input.originalProposal)) {
        throw new Error("proposal-id-conflict");
      }
      return { status: "already-present" as const, record: existing };
    }
    this.throwStorage(error);
    return { status: "created" as const, record: rowToProposalRecord(data as unknown as Record<string, unknown>) };
  }

  async get(proposalId: string) {
    const { data, error } = await this.client.from(STERLING_PROPOSALS_TABLE)
      .select(STERLING_PROPOSAL_COLUMNS).eq("proposal_id", proposalId).maybeSingle();
    this.throwStorage(error);
    return data ? rowToProposalRecord(data as unknown as Record<string, unknown>) : null;
  }

  async listActive(limit = 50) {
    const { data, error } = await this.client.from(STERLING_PROPOSALS_TABLE)
      .select(STERLING_PROPOSAL_COLUMNS)
      .in("status", ["proposed", "deferred", "approved", "edited_and_approved", "executing", "failed"])
      .order("created_at", { ascending: false }).limit(limit);
    this.throwStorage(error);
    return (data ?? []).map((row) => rowToProposalRecord(row as unknown as Record<string, unknown>));
  }

  async listForEntity(entityType: SterlingProposalRecord["affectedEntityType"], entityId: string) {
    const { data, error } = await this.client.from(STERLING_PROPOSALS_TABLE)
      .select(STERLING_PROPOSAL_COLUMNS).eq("affected_entity_type", entityType)
      .eq("affected_entity_id", entityId).order("created_at", { ascending: false }).limit(100);
    this.throwStorage(error);
    return (data ?? []).map((row) => rowToProposalRecord(row as unknown as Record<string, unknown>));
  }

  async listRecentDecisions(limit = 100) {
    const { data, error } = await this.client.from(STERLING_PROPOSALS_TABLE)
      .select(STERLING_PROPOSAL_COLUMNS).not("founder_decision", "is", null)
      .order("founder_decision_at", { ascending: false }).limit(limit);
    this.throwStorage(error);
    return (data ?? []).map((row) => rowToProposalRecord(row as unknown as Record<string, unknown>));
  }

  recordApproval(proposalId: string, input: SterlingDecisionInput) {
    return this.decision(proposalId, "approved", { founder_edited_payload: null, defer_until: null }, input);
  }

  recordEditAndApproval(proposalId: string, edited: SterlingProposedAction, input: SterlingDecisionInput) {
    return this.decision(proposalId, "edited_and_approved", { founder_edited_payload: edited, defer_until: null }, input);
  }

  recordRejection(proposalId: string, input: SterlingDecisionInput) {
    return this.decision(proposalId, "rejected", { founder_edited_payload: null, defer_until: null }, input);
  }

  recordDefer(proposalId: string, deferUntil: string, input: SterlingDecisionInput) {
    return this.decision(proposalId, "deferred", { founder_edited_payload: null, defer_until: deferUntil }, input);
  }

  async markExecuting(proposalId: string) {
    const current = await this.get(proposalId);
    if (!current) return failure("not-found");
    if (current.status === "executing") return success(current, true);
    if (!["approved", "edited_and_approved", "failed"].includes(current.status)) return failure("invalid-transition");
    return this.cas(current, "executing", { execution_status: "executing", execution_error_category: null });
  }

  async markExecuted(proposalId: string, mutationId: string, payload: SterlingProposedAction, at: string) {
    const current = await this.get(proposalId);
    if (!current) return failure("not-found");
    if (current.status === "executed") {
      return current.canonicalMutationId === mutationId && stableJson(current.executedPayload) === stableJson(payload)
        ? success(current, true) : failure("decision-conflict");
    }
    if (current.status !== "executing") return failure("invalid-transition");
    return this.cas(current, "executed", {
      canonical_mutation_id: mutationId, executed_payload: payload, execution_status: "executed",
      executed_at: at, updated_at: at,
    });
  }

  async markFailed(proposalId: string, category: string, at: string) {
    const current = await this.get(proposalId);
    if (!current) return failure("not-found");
    if (current.status !== "executing") return failure("invalid-transition");
    return this.cas(current, "failed", { execution_status: "failed", execution_error_category: category, updated_at: at });
  }

  async markUnsupported(proposalId: string, category: string, at: string) {
    const current = await this.get(proposalId);
    if (!current) return failure("not-found");
    if (current.status !== "approved" && current.status !== "edited_and_approved") return failure("invalid-transition");
    return this.cas(current, current.status, {
      execution_status: "blocked_unsupported", execution_error_category: category, updated_at: at,
    });
  }

  async supersede(proposalId: string, replacementId: string | null, reason: string, at: string) {
    const current = await this.get(proposalId);
    if (!current) return failure("not-found");
    if (current.status === "superseded") {
      if (!current.supersededBy && replacementId) {
        return this.cas(current, "superseded", { superseded_by: replacementId, updated_at: at });
      }
      return success(current, true);
    }
    if (["rejected", "executed"].includes(current.status)) return failure("invalid-transition");
    return this.cas(current, "superseded", {
      superseded_by: replacementId, execution_status: "blocked_stale",
      execution_error_category: reason, updated_at: at,
    });
  }

  private async decision(
    proposalId: string,
    target: "approved" | "edited_and_approved" | "rejected" | "deferred",
    extra: Record<string, unknown>,
    input: SterlingDecisionInput,
  ): Promise<SterlingLedgerResult> {
    const current = await this.get(proposalId);
    if (!current) return failure("not-found");
    if (current.status === target && current.founderDecision === target) {
      const sameEdit = target !== "edited_and_approved" ||
        stableJson(current.founderEditedPayload) === stableJson(extra.founder_edited_payload);
      const sameDefer = target !== "deferred" || current.deferUntil === extra.defer_until;
      return sameEdit && sameDefer ? success(current, true) : failure("decision-conflict");
    }
    if (current.status !== "proposed" && current.status !== "deferred") return failure("invalid-transition");
    return this.cas(current, target, {
      founder_decision: target,
      founder_decision_at: input.decidedAt,
      founder_decision_note: input.note?.trim() || null,
      execution_status: target === "approved" || target === "edited_and_approved" ? "pending" : "not_requested",
      updated_at: input.decidedAt,
      ...extra,
    });
  }

  private async cas(current: SterlingProposalRecord, target: SterlingProposalStatus, patch: Record<string, unknown>): Promise<SterlingLedgerResult> {
    const { data, error } = await this.client.from(STERLING_PROPOSALS_TABLE)
      .update({ ...patch, status: target }).eq("proposal_id", current.proposalId)
      .eq("status", current.status).select(STERLING_PROPOSAL_COLUMNS).maybeSingle();
    this.throwStorage(error);
    if (data) return success(rowToProposalRecord(data as unknown as Record<string, unknown>), false);
    const winner = await this.get(current.proposalId);
    if (winner?.status === target) return success(winner, true);
    return failure("decision-conflict");
  }

  private throwStorage(error: { code?: string | null; message?: string | null } | null): void {
    if (!error) return;
    if (sterlingLedgerStateFromError(error) === "not-activated") throw new Error("sterling-ledger-not-activated");
    throw new Error(error.message || "sterling-ledger-unavailable");
  }
}

function success(record: SterlingProposalRecord, idempotent: boolean): SterlingLedgerResult {
  return { ok: true, record, idempotent };
}

function failure(reason: Extract<SterlingLedgerResult, { ok: false }>["reason"]): SterlingLedgerResult {
  return { ok: false, reason };
}

export function createSupabaseSterlingProposalRepository(
  client: SupabaseClient | null = getSupabaseAdmin(),
): SupabaseSterlingProposalRepository {
  if (!client) throw new Error("supabase-admin-unavailable");
  return new SupabaseSterlingProposalRepository(client);
}
