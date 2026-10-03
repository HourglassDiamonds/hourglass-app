import { stableJson } from "../fingerprint";
import { canTransitionSterlingProposal, isActiveSterlingProposal } from "./state-machine";
import {
  STERLING_LEDGER_VERSION,
  type CreateSterlingProposalInput,
  type SterlingDecisionInput,
  type SterlingFounderDecision,
  type SterlingLedgerResult,
  type SterlingProposalRecord,
  type SterlingProposalRepository,
  type SterlingProposalStatus,
} from "./types";
import type { SterlingProposedAction } from "../types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function initialRecord(input: CreateSterlingProposalInput): SterlingProposalRecord {
  return {
    ...clone(input),
    status: "proposed",
    founderDecision: null,
    founderDecisionAt: null,
    founderDecisionNote: null,
    founderEditedPayload: null,
    deferUntil: null,
    canonicalMutationId: null,
    executedPayload: null,
    executionStatus: "not_requested",
    executionErrorCategory: null,
    supersededBy: null,
    updatedAt: input.createdAt,
    executedAt: null,
    ledgerVersion: STERLING_LEDGER_VERSION,
  };
}

export class InMemorySterlingProposalRepository implements SterlingProposalRepository {
  private readonly rows = new Map<string, SterlingProposalRecord>();

  async create(input: CreateSterlingProposalInput) {
    const existing = this.rows.get(input.proposalId);
    if (existing) {
      if (stableJson(existing.originalProposal) !== stableJson(input.originalProposal)) {
        throw new Error("proposal-id-conflict");
      }
      return { status: "already-present" as const, record: clone(existing) };
    }
    const record = initialRecord(input);
    this.rows.set(record.proposalId, record);
    return { status: "created" as const, record: clone(record) };
  }

  async get(proposalId: string) {
    const row = this.rows.get(proposalId);
    return row ? clone(row) : null;
  }

  async listActive(limit = 50) {
    return this.list((row) => isActiveSterlingProposal(row.status), limit);
  }

  async listForEntity(entityType: SterlingProposalRecord["affectedEntityType"], entityId: string) {
    return this.list((row) => row.affectedEntityType === entityType && row.affectedEntityId === entityId, 100);
  }

  async listRecentDecisions(limit = 100) {
    return this.list((row) => row.founderDecision != null, limit);
  }

  recordApproval(proposalId: string, input: SterlingDecisionInput) {
    return this.decide(proposalId, "approved", null, null, input);
  }

  recordEditAndApproval(proposalId: string, edited: SterlingProposedAction, input: SterlingDecisionInput) {
    return this.decide(proposalId, "edited_and_approved", edited, null, input);
  }

  recordRejection(proposalId: string, input: SterlingDecisionInput) {
    return this.decide(proposalId, "rejected", null, null, input);
  }

  recordDefer(proposalId: string, deferUntil: string, input: SterlingDecisionInput) {
    return this.decide(proposalId, "deferred", null, deferUntil, input);
  }

  markExecuting(proposalId: string) {
    const current = this.rows.get(proposalId);
    if (current?.status === "executing") return Promise.resolve(ok(current, true));
    return Promise.resolve(this.transition(proposalId, "executing", (row) => ({
      ...row,
      executionStatus: "executing",
      executionErrorCategory: null,
    })));
  }

  markExecuted(proposalId: string, mutationId: string, payload: SterlingProposedAction, at: string) {
    const current = this.rows.get(proposalId);
    if (current?.status === "executed") {
      const same = current.canonicalMutationId === mutationId && stableJson(current.executedPayload) === stableJson(payload);
      return Promise.resolve(same ? ok(current, true) : fail("decision-conflict"));
    }
    return Promise.resolve(this.transition(proposalId, "executed", (row) => ({
      ...row,
      canonicalMutationId: mutationId,
      executedPayload: clone(payload),
      executionStatus: "executed",
      executedAt: at,
      updatedAt: at,
    })));
  }

  markFailed(proposalId: string, category: string, at: string) {
    return Promise.resolve(this.transition(proposalId, "failed", (row) => ({
      ...row,
      executionStatus: "failed",
      executionErrorCategory: category,
      updatedAt: at,
    })));
  }

  async markUnsupported(proposalId: string, category: string, at: string): Promise<SterlingLedgerResult> {
    const row = this.rows.get(proposalId);
    if (!row) return fail("not-found");
    if (row.status !== "approved" && row.status !== "edited_and_approved") return fail("invalid-transition");
    const next = { ...row, executionStatus: "blocked_unsupported" as const, executionErrorCategory: category, updatedAt: at };
    this.rows.set(proposalId, next);
    return ok(next, false);
  }

  supersede(proposalId: string, replacementId: string | null, reason: string, at: string) {
    const current = this.rows.get(proposalId);
    if (current?.status === "superseded") {
      if (!current.supersededBy && replacementId) {
        const linked = { ...current, supersededBy: replacementId, updatedAt: at };
        this.rows.set(proposalId, linked);
        return Promise.resolve(ok(linked, false));
      }
      return Promise.resolve(ok(current, true));
    }
    return Promise.resolve(this.transition(proposalId, "superseded", (row) => ({
      ...row,
      supersededBy: replacementId,
      executionStatus: "blocked_stale",
      executionErrorCategory: reason,
      updatedAt: at,
    })));
  }

  private async decide(
    proposalId: string,
    decision: SterlingFounderDecision,
    edited: SterlingProposedAction | null,
    deferUntil: string | null,
    input: SterlingDecisionInput,
  ): Promise<SterlingLedgerResult> {
    const current = this.rows.get(proposalId);
    if (!current) return fail("not-found");
    const target = decision as SterlingProposalStatus;
    if (current.status === target && current.founderDecision === decision) {
      const same = stableJson(current.founderEditedPayload) === stableJson(edited) && current.deferUntil === deferUntil;
      return same ? ok(current, true) : fail("decision-conflict");
    }
    return this.transition(proposalId, target, (row) => ({
      ...row,
      founderDecision: decision,
      founderDecisionAt: input.decidedAt,
      founderDecisionNote: input.note?.trim() || null,
      founderEditedPayload: edited ? clone(edited) : null,
      deferUntil,
      executionStatus: decision === "approved" || decision === "edited_and_approved" ? "pending" : "not_requested",
      updatedAt: input.decidedAt,
    }));
  }

  private transition(
    proposalId: string,
    target: SterlingProposalStatus,
    update: (row: SterlingProposalRecord) => SterlingProposalRecord,
  ): SterlingLedgerResult {
    const current = this.rows.get(proposalId);
    if (!current) return fail("not-found");
    if (!canTransitionSterlingProposal(current.status, target)) return fail("invalid-transition");
    const next = update({ ...current, status: target });
    this.rows.set(proposalId, next);
    return ok(next, false);
  }

  private list(predicate: (row: SterlingProposalRecord) => boolean, limit: number) {
    return [...this.rows.values()]
      .filter(predicate)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(clone);
  }
}

function ok(record: SterlingProposalRecord, idempotent: boolean): SterlingLedgerResult {
  return { ok: true, record: clone(record), idempotent };
}

function fail(reason: Extract<SterlingLedgerResult, { ok: false }>["reason"]): SterlingLedgerResult {
  return { ok: false, reason };
}
