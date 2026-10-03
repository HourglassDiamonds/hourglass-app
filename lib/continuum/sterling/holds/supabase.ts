import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConditionalHoldRecord, ConditionalHoldRepository, CreateConditionalHoldInput, ResumeEvidence } from "./types";

export const CONDITIONAL_HOLDS_TABLE = "continuum_conditional_holds" as const;
const COLUMNS = "hold_id,entity_type,entity_id,project_id,created_at,created_by,reason,condition,source_refs,approval_proposal_id,provenance,activated_at,expected_entity_updated_at,current_state_fingerprint,status,condition_met_at,resumed_at,resume_evidence";

export class SupabaseConditionalHoldRepository implements ConditionalHoldRepository {
  constructor(private readonly client: SupabaseClient) {}
  async create(input: CreateConditionalHoldInput) {
    const row = toRow({ ...input, status: "active", conditionMetAt: null, resumedAt: null, resumeEvidence: null });
    const { data, error } = await this.client.from(CONDITIONAL_HOLDS_TABLE).insert(row).select(COLUMNS).single();
    if (error?.code === "23505") {
      const existing = await this.get(input.holdId) ?? (await this.byProposal(input.approvalProposalId));
      if (!existing || existing.entityId !== input.entityId) throw new Error("hold-id-conflict");
      return { record: existing, idempotent: true };
    }
    if (error || !data) throw new Error(`conditional-hold-storage:${error?.code ?? "missing-row"}`);
    return { record: fromRow(data as Record<string, unknown>), idempotent: false };
  }
  async get(id: string) { const { data, error } = await this.client.from(CONDITIONAL_HOLDS_TABLE).select(COLUMNS).eq("hold_id", id).maybeSingle(); if (error) throw error; return data ? fromRow(data as Record<string, unknown>) : null; }
  async listActive() { const { data, error } = await this.client.from(CONDITIONAL_HOLDS_TABLE).select(COLUMNS).in("status", ["active", "condition_met"]).order("created_at", { ascending: false }); if (error) throw error; return (data ?? []).map((row) => fromRow(row as Record<string, unknown>)); }
  async listForEntity(id: string) { const { data, error } = await this.client.from(CONDITIONAL_HOLDS_TABLE).select(COLUMNS).eq("entity_id", id).order("created_at", { ascending: false }); if (error) throw error; return (data ?? []).map((row) => fromRow(row as Record<string, unknown>)); }
  async markConditionMet(id: string, at: string, evidence: ResumeEvidence) { return this.transition(id, ["active"], "condition_met", { condition_met_at: at, resume_evidence: evidence }); }
  async resume(id: string, at: string, evidence: ResumeEvidence) { return this.transition(id, ["condition_met"], "resumed", { resumed_at: at, resume_evidence: evidence }); }
  async resumeNow(id: string, at: string, evidence: ResumeEvidence) { return this.transition(id, ["active", "condition_met"], "resumed", { condition_met_at: at, resumed_at: at, resume_evidence: evidence }); }
  async keepHolding(id: string, at: string) { return this.transition(id, ["condition_met"], "active", { activated_at: at, condition_met_at: null, resume_evidence: null }); }
  async close(id: string, status: "cancelled" | "closed_terminal", at: string) { return this.transition(id, ["active", "condition_met"], status, { resumed_at: at }); }
  private async byProposal(id: string) { const { data, error } = await this.client.from(CONDITIONAL_HOLDS_TABLE).select(COLUMNS).eq("approval_proposal_id", id).maybeSingle(); if (error) throw error; return data ? fromRow(data as Record<string, unknown>) : null; }
  private async transition(id: string, from: string[], status: ConditionalHoldRecord["status"], patch: Record<string, unknown>) {
    const { data, error } = await this.client.from(CONDITIONAL_HOLDS_TABLE).update({ status, ...patch }).eq("hold_id", id).in("status", from).select(COLUMNS).maybeSingle();
    if (error) throw error; if (data) return { record: fromRow(data as Record<string, unknown>), idempotent: false };
    const existing = await this.get(id); if (!existing) throw new Error("hold-not-found");
    if (existing.status === status || (status === "resumed" && existing.status === "resumed")) return { record: existing, idempotent: true };
    throw new Error("hold-transition-conflict");
  }
}
function toRow(row: ConditionalHoldRecord) { return { hold_id: row.holdId, entity_type: row.entityType, entity_id: row.entityId, project_id: row.projectId, created_at: row.createdAt, created_by: row.createdBy, reason: row.reason, condition: row.condition, source_refs: row.sourceRefs, approval_proposal_id: row.approvalProposalId, provenance: row.provenance, activated_at: row.activatedAt, expected_entity_updated_at: row.expectedEntityUpdatedAt, current_state_fingerprint: row.currentStateFingerprint, status: row.status, condition_met_at: row.conditionMetAt, resumed_at: row.resumedAt, resume_evidence: row.resumeEvidence }; }
function fromRow(row: Record<string, unknown>): ConditionalHoldRecord { return { holdId: String(row.hold_id), entityType: "job", entityId: String(row.entity_id), projectId: row.project_id ? String(row.project_id) : null, createdAt: String(row.created_at), createdBy: String(row.created_by), reason: String(row.reason), condition: row.condition as ConditionalHoldRecord["condition"], sourceRefs: (row.source_refs ?? []) as string[], approvalProposalId: String(row.approval_proposal_id), provenance: "sterling-founder-approved", activatedAt: String(row.activated_at), expectedEntityUpdatedAt: String(row.expected_entity_updated_at), currentStateFingerprint: String(row.current_state_fingerprint), status: row.status as ConditionalHoldRecord["status"], conditionMetAt: row.condition_met_at ? String(row.condition_met_at) : null, resumedAt: row.resumed_at ? String(row.resumed_at) : null, resumeEvidence: (row.resume_evidence as ResumeEvidence | null) ?? null }; }
