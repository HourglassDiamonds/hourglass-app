import type { SterlingProposal, SterlingProposedAction } from "../types";
import {
  STERLING_LEDGER_VERSION,
  STERLING_PROPOSAL_STATUSES,
  type SterlingExecutionStatus,
  type SterlingFounderDecision,
  type SterlingProposalRecord,
  type SterlingProposalStatus,
} from "./types";

export const STERLING_PROPOSAL_COLUMNS = [
  "proposal_id", "created_at", "updated_at", "proposal_type", "status",
  "affected_entity_type", "affected_entity_id", "current_state_fingerprint",
  "current_state_snapshot", "entity_version", "original_proposal", "evidence_refs",
  "reasoning_summary", "confidence", "source_workflow", "source_watermark",
  "provider", "model", "model_configuration", "run_id", "trace_id",
  "founder_decision", "founder_decision_at", "founder_decision_note",
  "founder_edited_payload", "defer_until", "canonical_mutation_id", "executed_payload",
  "execution_status", "execution_error_category", "superseded_by", "replaces_proposal_id",
  "executed_at", "ledger_version", "contract_version", "prompt_version",
].join(", ");

export function proposalRecordToRow(record: SterlingProposalRecord): Record<string, unknown> {
  return {
    proposal_id: record.proposalId,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    proposal_type: record.proposalType,
    status: record.status,
    affected_entity_type: record.affectedEntityType,
    affected_entity_id: record.affectedEntityId,
    current_state_fingerprint: record.currentStateFingerprint,
    current_state_snapshot: record.currentStateSnapshot,
    entity_version: record.entityVersion,
    original_proposal: record.originalProposal,
    evidence_refs: record.evidenceRefs,
    reasoning_summary: record.reasoningSummary,
    confidence: record.confidence,
    source_workflow: record.sourceWorkflow,
    source_watermark: record.sourceWatermark,
    provider: record.provider,
    model: record.model,
    model_configuration: record.modelConfiguration,
    run_id: record.runId,
    trace_id: record.traceId,
    founder_decision: record.founderDecision,
    founder_decision_at: record.founderDecisionAt,
    founder_decision_note: record.founderDecisionNote,
    founder_edited_payload: record.founderEditedPayload,
    defer_until: record.deferUntil,
    canonical_mutation_id: record.canonicalMutationId,
    executed_payload: record.executedPayload,
    execution_status: record.executionStatus,
    execution_error_category: record.executionErrorCategory,
    superseded_by: record.supersededBy,
    replaces_proposal_id: record.replacesProposalId,
    executed_at: record.executedAt,
    ledger_version: record.ledgerVersion,
    contract_version: record.contractVersion,
    prompt_version: record.promptVersion,
  };
}

export function rowToProposalRecord(row: Record<string, unknown>): SterlingProposalRecord {
  if (!(STERLING_PROPOSAL_STATUSES as readonly unknown[]).includes(row.status)) {
    throw new Error("invalid-sterling-proposal-status");
  }
  if (row.ledger_version !== STERLING_LEDGER_VERSION) throw new Error("invalid-sterling-ledger-version");
  return {
    proposalId: String(row.proposal_id),
    proposalType: String(row.proposal_type) as SterlingProposal["kind"],
    status: row.status as SterlingProposalStatus,
    affectedEntityType: String(row.affected_entity_type) as SterlingProposalRecord["affectedEntityType"],
    affectedEntityId: String(row.affected_entity_id),
    currentStateFingerprint: String(row.current_state_fingerprint),
    currentStateSnapshot: row.current_state_snapshot,
    entityVersion: nullableString(row.entity_version),
    originalProposal: row.original_proposal as SterlingProposal,
    evidenceRefs: Array.isArray(row.evidence_refs) ? row.evidence_refs.map(String) : [],
    reasoningSummary: String(row.reasoning_summary),
    confidence: String(row.confidence) as SterlingProposalRecord["confidence"],
    sourceWorkflow: String(row.source_workflow),
    sourceWatermark: nullableString(row.source_watermark),
    provider: "openai",
    model: String(row.model),
    modelConfiguration: String(row.model_configuration),
    runId: String(row.run_id),
    traceId: nullableString(row.trace_id),
    founderDecision: nullableString(row.founder_decision) as SterlingFounderDecision | null,
    founderDecisionAt: nullableString(row.founder_decision_at),
    founderDecisionNote: nullableString(row.founder_decision_note),
    founderEditedPayload: (row.founder_edited_payload as SterlingProposedAction | null) ?? null,
    deferUntil: nullableString(row.defer_until),
    canonicalMutationId: nullableString(row.canonical_mutation_id),
    executedPayload: (row.executed_payload as SterlingProposedAction | null) ?? null,
    executionStatus: String(row.execution_status) as SterlingExecutionStatus,
    executionErrorCategory: nullableString(row.execution_error_category),
    supersededBy: nullableString(row.superseded_by),
    replacesProposalId: nullableString(row.replaces_proposal_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    executedAt: nullableString(row.executed_at),
    ledgerVersion: STERLING_LEDGER_VERSION,
    contractVersion: String(row.contract_version),
    promptVersion: String(row.prompt_version),
  };
}

function nullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}
