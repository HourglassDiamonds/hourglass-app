import { createHash } from "node:crypto";
import type { OpenJobActor } from "@/lib/continuum/client-memory/project-jobs/types";
import type {
  SterlingProposedCanonicalMutation,
  SterlingTodayProposal,
  SterlingTodayValidationResult,
  SterlingTodayWorkingSet,
} from "./types";

export type SterlingApprovedCanonicalOperation =
  | { operationId: string; kind: "set_project_lifecycle"; projectId: string; personId: string; expectedRecordVersion: string; expectedCurrentStage: string | null; targetLifecycleStage: string; evidenceRefs: readonly string[] }
  | { operationId: string; kind: "update_open_job_holder"; projectId: string; personId: string; jobId: string; expectedRecordVersion: string; targetResponsibleParty: OpenJobActor; evidenceRefs: readonly string[] }
  | { operationId: string; kind: "resolve_open_job" | "cancel_open_job"; projectId: string; personId: string; jobId: string; expectedRecordVersion: string; evidenceRefs: readonly string[] };

export type SterlingCanonicalApprovalEnvelope = {
  approvalId: string;
  version: 1;
  kind: "canonical_change_set";
  projectId: string;
  projectKind: "custom_new_jewelry" | "repair_service";
  evidenceRefs: readonly string[];
  sourceWatermark: string;
  operations: readonly SterlingApprovedCanonicalOperation[];
  requiresFounderApproval: true;
};

export type SterlingSourceSuppressionApproval = {
  approvalId: string;
  version: 1;
  kind: "source_suppression";
  action: "suppress";
  candidateId: string;
  sourceRefs: readonly string[];
  emailHash: string;
  expectedRecordVersion: string;
  disposition: "spam" | "terminal";
  itemId: string;
  workUnitId: string;
  cadIds: readonly string[];
  label: string;
  wording: string;
  requiresFounderApproval: true;
};

export type SterlingSourceSuppressionCompensation = Omit<
  SterlingSourceSuppressionApproval,
  "approvalId" | "action" | "itemId" | "workUnitId" | "cadIds" | "label" | "wording"
> & {
  approvalId: string;
  action: "restore";
  compensatesProposalId: string;
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

function operationFor(input: {
  mutation: SterlingProposedCanonicalMutation;
  operationId: string;
  projectId: string;
  personId: string;
  currentStage: string | null;
  evidenceRefs: readonly string[];
}): SterlingApprovedCanonicalOperation | null {
  const mutation = input.mutation;
  const version = mutation.expectedRecordVersion?.trim();
  if (!version) return null;
  if (mutation.kind === "set_project_lifecycle") {
    return mutation.targetLifecycleStage
      ? { operationId: input.operationId, kind: mutation.kind, projectId: input.projectId, personId: input.personId,
          expectedRecordVersion: version, expectedCurrentStage: input.currentStage,
          targetLifecycleStage: mutation.targetLifecycleStage, evidenceRefs: input.evidenceRefs }
      : null;
  }
  if (!mutation.jobId || mutation.kind === "create_open_job") return null;
  if (mutation.kind === "update_open_job_holder") {
    const targetResponsibleParty = actorFor(mutation.targetResponsibleParty);
    return targetResponsibleParty
      ? { operationId: input.operationId, kind: mutation.kind, projectId: input.projectId,
          personId: input.personId, jobId: mutation.jobId, expectedRecordVersion: version,
          targetResponsibleParty, evidenceRefs: input.evidenceRefs }
      : null;
  }
  return {
    operationId: input.operationId,
    kind: mutation.kind,
    projectId: input.projectId,
    personId: input.personId,
    jobId: mutation.jobId,
    expectedRecordVersion: version,
    evidenceRefs: input.evidenceRefs,
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
    const project = projects.get(mutation.projectId)!;
    if (!mutation.personId || !project.people.some((row) => row.personId === mutation.personId)) {
      reasons.push(`cross-client-collision:${mutation.proposalKey}`);
      continue;
    }
    if (project.projectKind !== "custom_new_jewelry" && project.projectKind !== "repair_service") {
      reasons.push(`unsupported-project-kind:${mutation.proposalKey}`);
      continue;
    }
    if (mutation.evidenceRefs.length === 0 || mutation.evidenceRefs.some((ref) => !evidence.has(ref))) {
      reasons.push(`exact-evidence-required:${mutation.proposalKey}`);
      continue;
    }
    const refs = [...new Set(mutation.evidenceRefs)].sort();
    const operation = operationFor({
      mutation,
      operationId: approvalUuid(`${input.proposal.runId}|${mutation.proposalKey}|${mutation.kind}`),
      projectId: mutation.projectId,
      personId: mutation.personId,
      currentStage: project.lifecycleStage,
      evidenceRefs: refs,
    });
    if (!operation) {
      reasons.push(`unsupported-or-unversioned-mutation:${mutation.proposalKey}`);
      continue;
    }
    const key = `${mutation.projectId}|${refs.join("|")}`;
    const group = groups.get(key) ?? { projectId: mutation.projectId, evidenceRefs: refs, operations: [] };
    group.operations.push(operation);
    groups.set(key, group);
  }
  if (reasons.length > 0) return { ok: false, reasons: [...new Set(reasons)].sort() };
  return {
    ok: true,
    envelopes: [...groups.entries()].map(([key, group]) => {
      const project = projects.get(group.projectId)!;
      return {
        approvalId: approvalUuid(`${input.proposal.runId}|${key}`),
        version: 1 as const,
        kind: "canonical_change_set" as const,
        projectId: group.projectId,
        projectKind: project.projectKind as "custom_new_jewelry" | "repair_service",
        evidenceRefs: group.evidenceRefs,
        sourceWatermark: input.workingSet.sourceWatermark,
        operations: group.operations,
        requiresFounderApproval: true as const,
      };
    }),
  };
}

/** Exact retained-source suppression; broad names are deliberately not accepted. */
export function prepareSterlingSourceSuppression(input: Omit<SterlingSourceSuppressionApproval, "approvalId" | "version" | "kind" | "action" | "requiresFounderApproval">): SterlingSourceSuppressionApproval | null {
  const refs = [...new Set(input.sourceRefs.map((row) => row.trim()).filter(Boolean))].sort();
  if (!/^[0-9a-f]{64}$/i.test(input.candidateId) || refs.length === 0 || !/^[0-9a-f]{64}$/i.test(input.emailHash) ||
    !/^\d+$/.test(input.expectedRecordVersion) || !input.itemId.trim() || !input.workUnitId.trim() ||
    !input.label.trim() || !input.wording.trim()) return null;
  return {
    ...input,
    sourceRefs: refs,
    approvalId: approvalUuid(`${input.candidateId}|${refs.join("|")}|${input.emailHash}|${input.disposition}`),
    version: 1,
    kind: "source_suppression",
    action: "suppress",
    requiresFounderApproval: true,
  };
}

/** A restore is a new founder approval bound to the exact executed suppression. */
export function prepareSterlingSourceSuppressionCompensation(input: Omit<SterlingSourceSuppressionCompensation, "approvalId" | "version" | "kind" | "action" | "requiresFounderApproval">): SterlingSourceSuppressionCompensation | null {
  const refs = [...new Set(input.sourceRefs.map((row) => row.trim()).filter(Boolean))].sort();
  if (!/^[0-9a-f]{64}$/i.test(input.candidateId) || !/^[0-9a-f]{64}$/i.test(input.emailHash) ||
    !/^\d+$/.test(input.expectedRecordVersion) || refs.length === 0 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.compensatesProposalId)) return null;
  return {
    ...input,
    sourceRefs: refs,
    approvalId: approvalUuid(`${input.compensatesProposalId}|restore|${input.expectedRecordVersion}`),
    version: 1,
    kind: "source_suppression",
    action: "restore",
    requiresFounderApproval: true,
  };
}
