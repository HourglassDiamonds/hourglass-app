import type { ConditionalHoldRecord, ConditionalHoldRepository, CreateConditionalHoldInput, ResumeEvidence } from "./types";

export class InMemoryConditionalHoldRepository implements ConditionalHoldRepository {
  private readonly rows = new Map<string, ConditionalHoldRecord>();
  async create(input: CreateConditionalHoldInput) {
    const existing = this.rows.get(input.holdId);
    if (existing) {
      if (existing.approvalProposalId !== input.approvalProposalId || existing.entityId !== input.entityId) throw new Error("hold-id-conflict");
      return { record: existing, idempotent: true };
    }
    const duplicate = [...this.rows.values()].find((row) => row.approvalProposalId === input.approvalProposalId);
    if (duplicate) return { record: duplicate, idempotent: true };
    const record: ConditionalHoldRecord = { ...input, status: "active", conditionMetAt: null, resumedAt: null, resumeEvidence: null };
    this.rows.set(record.holdId, record);
    return { record, idempotent: false };
  }
  async get(id: string) { return this.rows.get(id) ?? null; }
  async listActive() { return [...this.rows.values()].filter((row) => row.status === "active" || row.status === "condition_met"); }
  async listForEntity(entityId: string) { return [...this.rows.values()].filter((row) => row.entityId === entityId); }
  async markConditionMet(id: string, at: string, evidence: ResumeEvidence) {
    const row = this.must(id); if (row.status !== "active") return { record: row, idempotent: true };
    return this.save({ ...row, status: "condition_met", conditionMetAt: at, resumeEvidence: evidence });
  }
  async resume(id: string, at: string, evidence: ResumeEvidence) {
    const row = this.must(id); if (row.status === "resumed") return { record: row, idempotent: true };
    if (row.status !== "condition_met") throw new Error("hold-condition-not-met");
    return this.save({ ...row, status: "resumed", resumedAt: at, resumeEvidence: evidence });
  }
  async resumeNow(id: string, at: string, evidence: ResumeEvidence) {
    const row = this.must(id); if (row.status === "resumed") return { record: row, idempotent: true };
    if (row.status !== "active" && row.status !== "condition_met") throw new Error("hold-terminal");
    return this.save({ ...row, status: "resumed", conditionMetAt: row.conditionMetAt ?? at, resumedAt: at, resumeEvidence: evidence });
  }
  async keepHolding(id: string, at: string) {
    const row = this.must(id); if (row.status === "active") return { record: row, idempotent: true };
    if (row.status !== "condition_met") throw new Error("hold-not-reviewable");
    return this.save({ ...row, status: "active", activatedAt: at, conditionMetAt: null, resumeEvidence: null });
  }
  async close(id: string, status: "cancelled" | "closed_terminal", at: string) {
    const row = this.must(id); if (row.status === status) return { record: row, idempotent: true };
    if (["resumed", "cancelled", "closed_terminal"].includes(row.status)) throw new Error("hold-terminal");
    return this.save({ ...row, status, resumedAt: at });
  }
  private must(id: string) { const row = this.rows.get(id); if (!row) throw new Error("hold-not-found"); return row; }
  private save(record: ConditionalHoldRecord) { this.rows.set(record.holdId, record); return { record, idempotent: false }; }
}
