import { createHash } from "node:crypto";
import type { OpenJobActor } from "@/lib/continuum/client-memory/project-jobs/types";
import type {
  SterlingProposedCanonicalMutation,
  SterlingTodayProposal,
  SterlingTodayValidationResult,
  SterlingTodayWorkingSet,
} from "./types";

export type SterlingApprovedCanonicalOperation =
  | { kind: "set_project_lifecycle"; projectId: string; expectedRecordVersion: string; stage: string }
  | { kind: "update_open_job_holder"; projectId: string | null; jobId: string; expectedRecordVersion: string; waitingOnActor: OpenJobActor }
  | { kind: "resolve_open_job" | "cancel_open_job"; projectId: string | null; jobId: string; expectedRecordVersion: string };

export type SterlingCanonicalApprovalEnvelope = {
  approvalId: string;
  proposalType: "canonical_change_set";
  projectId: string;
  evidenceRefs: readonly string[];
  sourceWatermark: string;
  operations: readonly SterlingApprovedCanonicalOperation[];
  requiresFounderApproval: true;
};

export type SterlingSourceSuppressionApproval = {
  approvalId: string;
  proposalType: "source_suppression";
  candidateId: string;
  sourceRefs: readonly string[];
  emailHash: string;
  expectedRecordVersion: string;
  disposition: "spam" | "terminal";
  requiresFounderApproval: true;
};

export type PrepareApprovalResult =
  | { ok: true; envelopes: readonly SterlingCanonicalApprovalEnvelope[] }
  | { ok: false; reasons: readonly string[] };

function approvalUuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16]!, 16) % 4]!;
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

function actorFor(value: SterlingProposedCanonicalMutation["targetResponsibleParty"]): OpenJobActor | null {
  if (value === "vendor_shop") return "vendor";
  if (value === "founder") return "founder";
  if (value === "client") return "client";
  if (value === "unknown") return "unknown";
  return null;
}

function operationFor(mutation: SterlingProposedCanonicalMutation): SterlingApprovedCanonicalOperation | null {
  const version = mutation.expectedRecordVersion?.trim();
  if (!version) return null;
  if (mutation.kind === "set_project_lifecycle") {
    return mutation.projectId && mutation.targetLifecycleStage
      ? { kind: mutation.kind, projectId: mutation.projectId, expectedRecordVersion: version, stage: mutation.targetLifecycleStage }
      : null;
  }
  if (!mutation.jobId || mutation.kind === "create_open_job") return null;
  if (mutation.kind === "update_open_job_holder") {
    const waitingOnActor = actorFor(mutation.targetResponsibleParty);
    return waitingOnActor
      ? { kind: mutation.kind, projectId: mutation.projectId, jobId: mutation.jobId, expectedRecordVersion: version, waitingOnActor }
      : null;
  }
  return {
    kind: mutation.kind,
    projectId: mutation.projectId,
    jobId: mutation.jobId,
    expectedRecordVersion: version,
  };
}

/**
 * Converts fully validated v6 mutations into founder-reviewable atomic groups.
 * It intentionally does not write the legacy ledger until the transaction RPC
 * described in the migration design is approved and available.
 */
export function prepareSterlingCanonicalApprovals(input: {
  workingSet: SterlingTodayWorkingSet;
  proposal: SterlingTodayProposal;
  validation: SterlingTodayValidationResult;
}): PrepareApprovalResult {
  const reasons: string[] = [];
  if (!input.validation.accepted || input.validation.proposal !== input.proposal) {
    reasons.push("proposal-not-accepted");
  }
  const validationByKey = new Map(input.validation.mutationValidations.map((row) => [row.proposalKey, row] as const));
  const evidence = new Set(input.workingSet.evidence.map((row) => row.evidenceId));
  const projects = new Map(input.workingSet.projects.map((row) => [row.projectId, row] as const));
  const groups = new Map<string, { projectId: string; evidenceRefs: string[]; operations: SterlingApprovedCanonicalOperation[] }>();
  for (const mutation of input.proposal.proposedCanonicalMutations) {
    const validation = validationByKey.get(mutation.proposalKey);
    if (!validation || validation.status !== "approved_for_founder_review") {
      reasons.push(`mutation-not-reviewable:${mutation.proposalKey}`);
      continue;
    }
    if (!mutation.projectId || !projects.has(mutation.projectId)) {
      reasons.push(`exact-project-required:${mutation.proposalKey}`);
      continue;
    }
    if (mutation.personId && !projects.get(mutation.projectId)?.people.some((row) => row.personId === mutation.personId)) {
      reasons.push(`cross-client-collision:${mutation.proposalKey}`);
      continue;
    }
    if (mutation.evidenceRefs.length === 0 || mutation.evidenceRefs.some((ref) => !evidence.has(ref))) {
      reasons.push(`exact-evidence-required:${mutation.proposalKey}`);
      continue;
    }
    const operation = operationFor(mutation);
    if (!operation) {
      reasons.push(`unsupported-or-unversioned-mutation:${mutation.proposalKey}`);
      continue;
    }
    const refs = [...new Set(mutation.evidenceRefs)].sort();
    const key = `${mutation.projectId}|${refs.join("|")}`;
    const group = groups.get(key) ?? { projectId: mutation.projectId, evidenceRefs: refs, operations: [] };
    group.operations.push(operation);
    groups.set(key, group);
  }
  if (reasons.length > 0) return { ok: false, reasons: [...new Set(reasons)].sort() };
  return {
    ok: true,
    envelopes: [...groups.entries()].map(([key, group]) => ({
      approvalId: approvalUuid(`${input.proposal.runId}|${key}`),
      proposalType: "canonical_change_set",
      projectId: group.projectId,
      evidenceRefs: group.evidenceRefs,
      sourceWatermark: input.workingSet.sourceWatermark,
      operations: group.operations,
      requiresFounderApproval: true,
    })),
  };
}

/** Exact retained-source suppression; broad names are deliberately not accepted. */
export function prepareSterlingSourceSuppression(input: Omit<SterlingSourceSuppressionApproval, "approvalId" | "proposalType" | "requiresFounderApproval">): SterlingSourceSuppressionApproval | null {
  const refs = [...new Set(input.sourceRefs.map((row) => row.trim()).filter(Boolean))].sort();
  if (!input.candidateId.trim() || refs.length === 0 || !/^[0-9a-f]{64}$/i.test(input.emailHash) ||
    !input.expectedRecordVersion.trim()) return null;
  return {
    ...input,
    sourceRefs: refs,
    approvalId: approvalUuid(`${input.candidateId}|${refs.join("|")}|${input.emailHash}|${input.disposition}`),
    proposalType: "source_suppression",
    requiresFounderApproval: true,
  };
}
