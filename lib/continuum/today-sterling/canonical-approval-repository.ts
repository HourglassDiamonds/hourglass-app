import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fingerprintCanonicalState, stableJson } from "@/lib/continuum/sterling/fingerprint";
import { STERLING_LEDGER_VERSION } from "@/lib/continuum/sterling/ledger/types";
import type {
  SterlingApprovedCanonicalOperation,
  SterlingCanonicalApprovalEnvelope,
  SterlingSourceSuppressionApproval,
  SterlingSourceSuppressionCompensation,
} from "./canonical-approval-adapter";

export type SterlingCanonicalApprovalPayload =
  | SterlingCanonicalApprovalEnvelope
  | SterlingSourceSuppressionApproval
  | SterlingSourceSuppressionCompensation;

export type CanonicalApprovalMetadata = {
  runId: string;
  createdAt: string;
  reasoningSummary: string;
  model: string;
  modelConfiguration: string;
  contractVersion: string;
  promptVersion: string;
  traceId?: string | null;
};

export type CanonicalApprovalRow = {
  proposalId: string;
  proposalType: SterlingCanonicalApprovalPayload["kind"];
  status: string;
  recordVersion: number;
  createdAt: string;
  reasoningSummary: string;
  evidenceRefs: readonly string[];
  originalPayload: SterlingCanonicalApprovalPayload;
  approvedPayload: SterlingCanonicalApprovalPayload | null;
  founderDecision: "approved" | "edited_and_approved" | "rejected" | "deferred" | null;
  founderDecisionAt: string | null;
  founderDecisionNote: string | null;
  founderDecidedBy: string | null;
  executionStatus: string;
  executionReceipt: unknown;
};

export type CanonicalApprovalExecutionResult =
  | { ok: true; status: "executed" | "already-present"; recordVersion: number; receipt: unknown }
  | { ok: false; reason: string; approvalRecorded?: false }
  | { ok: false; reason: string; approvalRecorded: true; recordVersion: number };

export type CanonicalApprovalRejectionResult =
  | { ok: true; status: "rejected" | "already-present"; recordVersion: number }
  | { ok: false; reason: string };

const CANONICAL_COLUMNS = [
  "proposal_id", "proposal_type", "status", "record_version", "created_at",
  "reasoning_summary", "evidence_refs", "original_proposal", "approved_payload",
  "founder_decision", "founder_decision_at", "founder_decision_note", "founder_decided_by",
  "execution_status", "execution_receipt",
].join(", ");

/**
 * Rebinds v6's read-model version to the canonical row versions used by the
 * executor. This happens before the founder sees/approves the durable payload.
 */
export async function bindCanonicalApprovalVersions(
  client: SupabaseClient,
  envelope: SterlingCanonicalApprovalEnvelope,
): Promise<SterlingCanonicalApprovalEnvelope> {
  const profile = await client.from("continuum_project_profiles")
    .select("project_id, project_kind").eq("project_id", envelope.projectId).maybeSingle();
  if (profile.error || !profile.data) throw new Error("project-not-found");
  if (profile.data.project_kind !== envelope.projectKind) throw new Error("project-kind-conflict");

  const lifecycle = await client.from("continuum_project_lifecycle_states")
    .select("stage, updated_at").eq("project_id", envelope.projectId)
    .eq("project_kind", envelope.projectKind).maybeSingle();
  if (lifecycle.error) throw new Error("lifecycle-version-unavailable");

  const people = [...new Set(envelope.operations.map((operation) => operation.personId))];
  for (const personId of people) {
    const [forward, reverse] = await Promise.all([
      client.from("continuum_relationships").select("id").eq("kind", "client-project")
        .eq("status", "active").eq("from_entity_id", personId).eq("to_entity_id", envelope.projectId).limit(1),
      client.from("continuum_relationships").select("id").eq("kind", "client-project")
        .eq("status", "active").eq("from_entity_id", envelope.projectId).eq("to_entity_id", personId).limit(1),
    ]);
    if (forward.error || reverse.error || ((forward.data?.length ?? 0) + (reverse.data?.length ?? 0) === 0)) {
      throw new Error("person-not-on-project");
    }
  }

  const operations: SterlingApprovedCanonicalOperation[] = [];
  for (const operation of envelope.operations) {
    if (operation.kind === "set_project_lifecycle") {
      const currentStage = lifecycle.data?.stage == null ? null : String(lifecycle.data.stage);
      if (currentStage !== operation.expectedCurrentStage) throw new Error("stale-lifecycle-stage");
      operations.push({
        ...operation,
        expectedRecordVersion: lifecycle.data?.updated_at == null ? "absent" : String(lifecycle.data.updated_at),
      });
      continue;
    }
    const job = await client.from("continuum_project_jobs")
      .select("job_id, project_id, associated_person_id, updated_at, state")
      .eq("job_id", operation.jobId).maybeSingle();
    if (job.error || !job.data) throw new Error("job-not-found");
    if (job.data.project_id !== envelope.projectId) throw new Error("wrong-project");
    if (job.data.associated_person_id !== operation.personId) throw new Error("cross-client-reassignment");
    if (String(job.data.updated_at) !== operation.expectedRecordVersion) throw new Error("stale-job-version");
    if (!["open", "snoozed"].includes(String(job.data.state))) throw new Error("invalid-job-state");
    operations.push({ ...operation, expectedRecordVersion: String(job.data.updated_at) });
  }
  return { ...envelope, operations };
}

export class SupabaseSterlingCanonicalApprovalRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(payload: SterlingCanonicalApprovalPayload, metadata: CanonicalApprovalMetadata) {
    if (!isCanonicalApprovalPayload(payload)) throw new Error("invalid-canonical-approval-payload");
    if (payload.kind === "source_suppression") {
      const candidate = await this.client.from("continuum_candidates")
        .select("candidate_id, source_system, source_ref, payload, record_version")
        .eq("candidate_id", payload.candidateId).maybeSingle();
      if (candidate.error || !candidate.data) throw new Error("candidate-not-found");
      const bindingError = sourceSuppressionBindingError(payload, candidate.data as Record<string, unknown>);
      if (bindingError) throw new Error(bindingError);
    }
    const affectedEntityType = payload.kind === "canonical_change_set" ? "project" : "candidate";
    const affectedEntityId = payload.kind === "canonical_change_set" ? payload.projectId : payload.candidateId;
    const row = {
      proposal_id: payload.approvalId,
      created_at: metadata.createdAt,
      updated_at: metadata.createdAt,
      proposal_type: payload.kind,
      status: "proposed",
      affected_entity_type: affectedEntityType,
      affected_entity_id: affectedEntityId,
      current_state_fingerprint: fingerprintCanonicalState(payload),
      current_state_snapshot: payload,
      entity_version: versionSummary(payload),
      original_proposal: payload,
      evidence_refs: payload.kind === "canonical_change_set" ? payload.evidenceRefs : payload.sourceRefs,
      reasoning_summary: metadata.reasoningSummary,
      confidence: "high",
      source_workflow: "sterling-today-v6-canonical-approval",
      source_watermark: payload.kind === "canonical_change_set" ? payload.sourceWatermark : null,
      provider: "openai",
      model: metadata.model,
      model_configuration: metadata.modelConfiguration,
      run_id: metadata.runId,
      trace_id: metadata.traceId ?? null,
      execution_status: "not_requested",
      ledger_version: STERLING_LEDGER_VERSION,
      contract_version: metadata.contractVersion,
      prompt_version: metadata.promptVersion,
    };
    const inserted = await this.client.from("continuum_sterling_proposals")
      .insert(row).select(CANONICAL_COLUMNS).single();
    if (inserted.error?.code === "23505") {
      const existing = await this.get(payload.approvalId);
      if (!existing || stableJson(existing.originalPayload) !== stableJson(payload)) {
        throw new Error("approval-idempotency-conflict");
      }
      return { status: "already-present" as const, record: existing };
    }
    if (inserted.error) throw new Error(inserted.error.message || "canonical-approval-create-failed");
    return { status: "created" as const, record: rowToCanonicalApproval(inserted.data as unknown as Record<string, unknown>) };
  }

  async get(proposalId: string): Promise<CanonicalApprovalRow | null> {
    const result = await this.client.from("continuum_sterling_proposals")
      .select(CANONICAL_COLUMNS).eq("proposal_id", proposalId).maybeSingle();
    if (result.error) throw new Error(result.error.message || "canonical-approval-read-failed");
    return result.data ? rowToCanonicalApproval(result.data as unknown as Record<string, unknown>) : null;
  }

  async list(limit = 50): Promise<CanonicalApprovalRow[]> {
    const result = await this.client.from("continuum_sterling_proposals")
      .select(CANONICAL_COLUMNS)
      .in("proposal_type", ["canonical_change_set", "source_suppression"])
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100));
    if (result.error) throw new Error(result.error.message || "canonical-approval-list-failed");
    return (result.data ?? []).map((row) => rowToCanonicalApproval(row as unknown as Record<string, unknown>));
  }

  async approveAndExecute(input: {
    proposalId: string;
    expectedRecordVersion: number;
    decision: "approved" | "edited_and_approved";
    approvedPayload?: SterlingCanonicalApprovalPayload;
    actor: string;
    note?: string | null;
    now: string;
  }): Promise<CanonicalApprovalExecutionResult> {
    const current = await this.get(input.proposalId);
    if (!current) return { ok: false, reason: "proposal-not-found" };
    const payload = input.decision === "approved"
      ? current.originalPayload
      : input.approvedPayload;
    if (!payload || !isCanonicalApprovalPayload(payload) || payload.approvalId !== input.proposalId ||
      payload.kind !== current.proposalType) return { ok: false, reason: "invalid-approved-payload" };
    if (current.status === "executed" && current.executionStatus === "executed") {
      const exactReplay = current.founderDecision === input.decision && current.approvedPayload != null &&
        stableJson(current.approvedPayload) === stableJson(payload);
      return exactReplay
        ? { ok: true, status: "already-present", recordVersion: current.recordVersion, receipt: current.executionReceipt }
        : { ok: false, reason: "approval-idempotency-conflict" };
    }

    const decision = await this.client.rpc("continuum_sterling_record_canonical_decision", {
      p_proposal_id: input.proposalId,
      p_expected_record_version: input.expectedRecordVersion,
      p_decision: input.decision,
      p_approved_payload: payload,
      p_decided_at: input.now,
      p_actor: input.actor,
      p_note: input.note?.trim() || null,
    });
    if (decision.error) return { ok: false, reason: decision.error.message || "approval-failed" };
    const approvedVersion = Number(decision.data?.recordVersion);
    if (!Number.isSafeInteger(approvedVersion) || approvedVersion < 1) {
      return { ok: false, reason: "invalid-approved-record-version" };
    }
    const execution = await this.client.rpc("continuum_sterling_execute_approved_change_set", {
      p_proposal_id: input.proposalId,
      p_expected_record_version: approvedVersion,
      p_actor: input.actor,
      p_executed_at: input.now,
    });
    if (execution.error) {
      return {
        ok: false,
        reason: execution.error.message || "canonical-execution-failed",
        approvalRecorded: true,
        recordVersion: approvedVersion,
      };
    }
    const status = execution.data?.status;
    const recordVersion = Number(execution.data?.recordVersion);
    if ((status !== "executed" && status !== "already-present") || !Number.isSafeInteger(recordVersion)) {
      return {
        ok: false,
        reason: "invalid-canonical-execution-result",
        approvalRecorded: true,
        recordVersion: approvedVersion,
      };
    }
    return { ok: true, status, recordVersion, receipt: execution.data?.receipt ?? null };
  }

  async reject(input: {
    proposalId: string;
    expectedRecordVersion: number;
    actor: string;
    note?: string | null;
    now: string;
  }): Promise<CanonicalApprovalRejectionResult> {
    const current = await this.get(input.proposalId);
    if (!current) return { ok: false, reason: "proposal-not-found" };
    const note = input.note?.trim() || null;
    if (current.founderDecision === "rejected" && current.status === "rejected") {
      const exactReplay = current.founderDecisionNote === note && current.founderDecidedBy === input.actor.trim();
      return exactReplay
        ? { ok: true, status: "already-present", recordVersion: current.recordVersion }
        : { ok: false, reason: "rejection-idempotency-conflict" };
    }
    if (current.recordVersion !== input.expectedRecordVersion) {
      return { ok: false, reason: "stale-ledger-version" };
    }
    if (current.status !== "proposed" || current.founderDecision != null) {
      return { ok: false, reason: "invalid-transition" };
    }
    const result = await this.client.from("continuum_sterling_proposals")
      .update({
        status: "rejected",
        founder_decision: "rejected",
        founder_decision_at: input.now,
        founder_decision_note: note,
        founder_decided_by: input.actor.trim(),
        execution_status: "not_requested",
        updated_at: input.now,
      })
      .eq("proposal_id", input.proposalId)
      .eq("proposal_type", current.proposalType)
      .eq("status", "proposed")
      .eq("record_version", input.expectedRecordVersion)
      .select(CANONICAL_COLUMNS)
      .maybeSingle();
    if (result.error) return { ok: false, reason: result.error.message || "rejection-failed" };
    if (!result.data) return { ok: false, reason: "stale-ledger-version" };
    const updated = rowToCanonicalApproval(result.data as unknown as Record<string, unknown>);
    return { ok: true, status: "rejected", recordVersion: updated.recordVersion };
  }
}

/** Fail closed before founder review as well as inside the database executor. */
export function sourceSuppressionBindingError(
  payload: SterlingSourceSuppressionApproval | SterlingSourceSuppressionCompensation,
  candidate: Record<string, unknown>,
): string | null {
  if (candidate.source_system !== "gmail") return "candidate-source-mismatch";
  if (payload.sourceRefs.length !== 1 || payload.sourceRefs[0] !== candidate.source_ref) {
    return "candidate-source-ref-mismatch";
  }
  if (String(candidate.record_version) !== payload.expectedRecordVersion) return "stale-candidate-version";
  const candidatePayload = isRecord(candidate.payload) ? candidate.payload : null;
  if (candidatePayload?.kind !== "person_association") return "candidate-email-identity-unsupported";
  if (candidatePayload.emailHash !== payload.emailHash) return "candidate-email-hash-mismatch";
  return null;
}

function rowToCanonicalApproval(row: Record<string, unknown>): CanonicalApprovalRow {
  if (!isCanonicalApprovalPayload(row.original_proposal)) throw new Error("invalid-canonical-approval-row");
  const approved = row.approved_payload == null ? null : row.approved_payload;
  if (approved != null && !isCanonicalApprovalPayload(approved)) throw new Error("invalid-approved-payload-row");
  return {
    proposalId: String(row.proposal_id),
    proposalType: String(row.proposal_type) as CanonicalApprovalRow["proposalType"],
    status: String(row.status),
    recordVersion: Number(row.record_version),
    createdAt: String(row.created_at),
    reasoningSummary: String(row.reasoning_summary),
    evidenceRefs: Array.isArray(row.evidence_refs) ? row.evidence_refs.map(String) : [],
    originalPayload: row.original_proposal,
    approvedPayload: approved,
    founderDecision: row.founder_decision == null ? null : String(row.founder_decision) as CanonicalApprovalRow["founderDecision"],
    founderDecisionAt: row.founder_decision_at == null ? null : String(row.founder_decision_at),
    founderDecisionNote: row.founder_decision_note == null ? null : String(row.founder_decision_note),
    founderDecidedBy: row.founder_decided_by == null ? null : String(row.founder_decided_by),
    executionStatus: String(row.execution_status),
    executionReceipt: row.execution_receipt ?? null,
  };
}

function versionSummary(payload: SterlingCanonicalApprovalPayload): string {
  return payload.kind === "canonical_change_set"
    ? payload.operations.map((operation) => `${operation.operationId}:${operation.expectedRecordVersion}`).join("|")
    : payload.expectedRecordVersion;
}

export function isCanonicalApprovalPayload(value: unknown): value is SterlingCanonicalApprovalPayload {
  if (!isRecord(value) || value.version !== 1 || !uuid(value.approvalId) ||
    value.requiresFounderApproval !== true) return false;
  if (value.kind === "canonical_change_set") {
    return uuid(value.projectId) &&
      (value.projectKind === "custom_new_jewelry" || value.projectKind === "repair_service") &&
      typeof value.sourceWatermark === "string" && stringArray(value.evidenceRefs) && value.evidenceRefs.length > 0 &&
      Array.isArray(value.operations) && value.operations.length > 0 &&
      value.operations.every((operation) => isCanonicalOperation(operation) && operation.projectId === value.projectId);
  }
  if (value.kind !== "source_suppression" || (value.action !== "suppress" && value.action !== "restore")) return false;
  if (!sha256(value.candidateId) || !stringArray(value.sourceRefs) || value.sourceRefs.length !== 1 ||
    !sha256(value.emailHash) || !positiveIntegerString(value.expectedRecordVersion) ||
    (value.disposition !== "spam" && value.disposition !== "terminal")) return false;
  return value.action === "restore"
    ? uuid(value.compensatesProposalId)
    : typeof value.itemId === "string" && typeof value.workUnitId === "string" &&
      stringArray(value.cadIds) && typeof value.label === "string" && typeof value.wording === "string";
}

function isCanonicalOperation(value: unknown): boolean {
  if (!isRecord(value) || !uuid(value.operationId) || !uuid(value.projectId) ||
    !uuid(value.personId) || typeof value.expectedRecordVersion !== "string" ||
    !stringArray(value.evidenceRefs) || value.evidenceRefs.length === 0) return false;
  if (value.kind === "set_project_lifecycle") {
    return (value.expectedCurrentStage == null || typeof value.expectedCurrentStage === "string") &&
      typeof value.targetLifecycleStage === "string";
  }
  if (value.kind === "update_open_job_holder") {
    return uuid(value.jobId) && ["founder", "hourglass", "client", "vendor", "unknown"].includes(
      String(value.targetResponsibleParty),
    );
  }
  return (value.kind === "resolve_open_job" || value.kind === "cancel_open_job") && uuid(value.jobId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function positiveIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value);
}
