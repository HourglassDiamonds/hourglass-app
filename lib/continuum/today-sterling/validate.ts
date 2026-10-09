import { createHash } from "node:crypto";
import { isLifecycleKind, isStageAllowedForKind } from "@/lib/continuum/client-memory/project-lifecycle";
import { parseSterlingTodayProposal } from "./schema";
import type {
  SterlingProposedCanonicalMutation, SterlingTodayProposal, SterlingTodayValidationResult, SterlingTodayWorkingSet,
} from "./types";

function validationId(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function validateSterlingTodayProposal(
  workingSet: SterlingTodayWorkingSet,
  raw: unknown,
): SterlingTodayValidationResult {
  const proposal = parseSterlingTodayProposal(raw);
  if (!proposal) return { accepted: false, proposal: null, errors: ["invalid-structured-contract"], mutationValidations: [] };
  const errors: string[] = [];
  if (proposal.runId !== workingSet.runId) errors.push("run-id-mismatch");
  if (proposal.evidenceSnapshotId !== workingSet.evidenceSnapshotId) errors.push("evidence-snapshot-mismatch");
  const projects = new Map(workingSet.projects.map(row => [row.projectId, row]));
  const people = new Set(workingSet.people.map(row => row.personId));
  const evidence = new Set(workingSet.evidence.map(row => row.evidenceId));
  const jobs = new Map(workingSet.jobs.map(row => [row.jobId, row]));
  const workUnits = new Map(workingSet.workUnits.map(row => [row.workUnitId, row]));
  const assessments = new Map<string, SterlingTodayProposal["portfolioAssessments"][number]>();
  for (const assessment of proposal.portfolioAssessments) {
    const workUnit = workUnits.get(assessment.workUnitId);
    if (!assessment.workUnitId.trim() || assessments.has(assessment.workUnitId)) {
      errors.push(`duplicate-or-empty-assessment:${assessment.workUnitId}`);
    }
    assessments.set(assessment.workUnitId, assessment);
    if (!workUnit) {
      errors.push(`unknown-work-unit:${assessment.workUnitId}`);
      continue;
    }
    if (assessment.projectId !== workUnit.projectId) errors.push(`work-unit-project-mismatch:${assessment.workUnitId}`);
    if (workUnit.kind === "canonical_project" && assessment.identityStatus !== "canonical_project") {
      errors.push(`canonical-identity-mismatch:${assessment.workUnitId}`);
    }
    if (workUnit.kind === "provisional_evidence" && assessment.identityStatus === "canonical_project") {
      errors.push(`fabricated-canonical-identity:${assessment.workUnitId}`);
    }
    if (assessment.todayDisposition === "presented") {
      if (!assessment.recommendationItemId) errors.push(`presented-without-recommendation:${assessment.workUnitId}`);
      if (assessment.omissionReason !== null) errors.push(`presented-with-omission-reason:${assessment.workUnitId}`);
    } else {
      if (assessment.recommendationItemId !== null) errors.push(`omitted-with-recommendation:${assessment.workUnitId}`);
      if (!assessment.omissionReason?.trim()) errors.push(`missing-omission-reason:${assessment.workUnitId}`);
    }
    const refs = [...assessment.evidenceRefs, ...assessment.currentStage.evidenceRefs,
      ...assessment.obligations.flatMap(row => row.evidenceRefs)];
    if (assessment.evidenceRefs.length === 0) errors.push(`missing-assessment-provenance:${assessment.workUnitId}`);
    for (const ref of refs) {
      if (!evidence.has(ref)) errors.push(`unknown-evidence:${assessment.workUnitId}:${ref}`);
      else if (!workUnit.evidenceRefs.includes(ref)) errors.push(`cross-work-unit-evidence:${assessment.workUnitId}:${ref}`);
    }
    const project = assessment.projectId ? projects.get(assessment.projectId) : null;
    if (assessment.currentStage.stage && project && isLifecycleKind(project.projectKind) &&
        !isStageAllowedForKind(project.projectKind, assessment.currentStage.stage)) {
      errors.push(`invalid-assessment-stage:${assessment.workUnitId}`);
    }
  }
  for (const workUnitId of workUnits.keys()) {
    if (!assessments.has(workUnitId)) errors.push(`missing-work-unit-assessment:${workUnitId}`);
  }

  const itemIds = new Set<string>();
  const recommendations = new Map<string, SterlingTodayProposal["recommendations"][number]>();
  for (const item of proposal.recommendations) {
    if (!item.itemId.trim() || itemIds.has(item.itemId)) errors.push(`duplicate-or-empty-item:${item.itemId}`);
    itemIds.add(item.itemId);
    recommendations.set(item.itemId, item);
    const workUnit = workUnits.get(item.workUnitId);
    const assessment = assessments.get(item.workUnitId);
    if (!workUnit) errors.push(`unknown-work-unit:${item.itemId}`);
    if (workUnit && item.projectId !== workUnit.projectId) errors.push(`recommendation-project-mismatch:${item.itemId}`);
    if (!assessment || assessment.recommendationItemId !== item.itemId || assessment.todayDisposition !== "presented") {
      errors.push(`recommendation-assessment-mismatch:${item.itemId}`);
    } else {
      if (item.responsibleParty !== assessment.nextStepOwner) errors.push(`next-step-owner-mismatch:${item.itemId}`);
      if (item.projectStage.stage !== assessment.currentStage.stage) errors.push(`project-stage-reconciliation-mismatch:${item.itemId}`);
      const assessedObligations = new Map(assessment.obligations.map(row => [row.obligationId, row]));
      const recommendationObligationIds = new Set<string>();
      for (const obligation of item.obligations) {
        recommendationObligationIds.add(obligation.obligationId);
        const assessed = assessedObligations.get(obligation.obligationId);
        if (!assessed || assessed.status !== obligation.status || assessed.responsibleParty !== obligation.responsibleParty) {
          errors.push(`obligation-reconciliation-mismatch:${item.itemId}:${obligation.obligationId}`);
        }
      }
      for (const obligation of assessment.obligations) {
        if ((obligation.status === "open" || obligation.status === "ambiguous") &&
            !recommendationObligationIds.has(obligation.obligationId)) {
          errors.push(`missing-actionable-obligation:${item.itemId}:${obligation.obligationId}`);
        }
      }
    }
    if (item.projectId && !projects.has(item.projectId)) errors.push(`unknown-project:${item.itemId}`);
    if (item.personId && !people.has(item.personId)) errors.push(`unknown-person:${item.itemId}`);
    if (item.projectId && item.personId && !projects.get(item.projectId)?.people.some(row => row.personId === item.personId)) {
      errors.push(`cross-client-collision:${item.itemId}`);
    }
    for (const ref of [...item.evidenceRefs, ...item.projectStage.evidenceRefs, ...item.obligations.flatMap(row => row.evidenceRefs)]) {
      if (!evidence.has(ref)) errors.push(`unknown-evidence:${item.itemId}:${ref}`);
      else if (workUnit && !workUnit.evidenceRefs.includes(ref)) errors.push(`cross-work-unit-evidence:${item.itemId}:${ref}`);
    }
    if (item.evidenceRefs.length === 0) errors.push(`missing-provenance:${item.itemId}`);
    const project = item.projectId ? projects.get(item.projectId) : null;
    if (item.projectStage.stage && project && isLifecycleKind(project.projectKind) &&
        !isStageAllowedForKind(project.projectKind, item.projectStage.stage)) {
      errors.push(`invalid-project-stage:${item.itemId}`);
    }
  }
  for (const assessment of assessments.values()) {
    if (assessment.recommendationItemId && !recommendations.has(assessment.recommendationItemId)) {
      errors.push(`missing-linked-recommendation:${assessment.workUnitId}`);
    }
  }

  const seenKeys = new Set<string>();
  const mutationValidations = proposal.proposedCanonicalMutations.map(mutation => {
    const reasons = validateMutation(mutation, { projects, people, evidence, jobs, seenKeys, workingSet });
    seenKeys.add(mutation.proposalKey);
    return {
      proposalKey: mutation.proposalKey,
      validationId: validationId([workingSet.evidenceSnapshotId, mutation]),
      status: reasons.length === 0 ? "approved_for_founder_review" as const : "rejected" as const,
      reasons,
      rollback: rollbackFor(mutation),
    };
  });
  return { accepted: errors.length === 0, proposal: errors.length === 0 ? proposal : null, errors, mutationValidations };
}

function validateMutation(
  mutation: SterlingProposedCanonicalMutation,
  context: {
    projects: Map<string, SterlingTodayWorkingSet["projects"][number]>;
    people: Set<string>; evidence: Set<string>; jobs: Map<string, SterlingTodayWorkingSet["jobs"][number]>;
    seenKeys: Set<string>; workingSet: SterlingTodayWorkingSet;
  },
): string[] {
  const reasons: string[] = [];
  if (!mutation.proposalKey.trim() || context.seenKeys.has(mutation.proposalKey)) reasons.push("duplicate-or-empty-proposal-key");
  if (mutation.requiresFounderApproval !== true) reasons.push("founder-approval-required");
  if (mutation.evidenceRefs.length === 0) reasons.push("evidence-required");
  for (const ref of mutation.evidenceRefs) if (!context.evidence.has(ref)) reasons.push(`unknown-evidence:${ref}`);
  const project = mutation.projectId ? context.projects.get(mutation.projectId) : null;
  const job = mutation.jobId ? context.jobs.get(mutation.jobId) : null;
  if (mutation.projectId && !project) reasons.push("unknown-project");
  if (mutation.personId && !context.people.has(mutation.personId)) reasons.push("unknown-person");
  if (mutation.projectId && mutation.personId && !project?.people.some(row => row.personId === mutation.personId)) reasons.push("cross-client-collision");

  if (mutation.kind === "set_project_lifecycle") {
    if (!project || mutation.jobId || !mutation.targetLifecycleStage) reasons.push("invalid-lifecycle-target");
    if (!mutation.expectedRecordVersion || mutation.expectedRecordVersion !== project?.recordVersion) reasons.push("stale-project-version");
    if (!project || !isLifecycleKind(project.projectKind) || !isStageAllowedForKind(project.projectKind, mutation.targetLifecycleStage)) reasons.push("invalid-lifecycle-transition");
  } else if (mutation.kind === "create_open_job") {
    if (mutation.jobId || !mutation.newJob) reasons.push("invalid-create-job-target");
    if (!project) reasons.push("canonical-project-required");
    if (project && mutation.expectedRecordVersion !== project.recordVersion) reasons.push("stale-project-version");
    const duplicate = context.workingSet.jobs.some(row => (row.state === "open" || row.state === "snoozed") &&
      row.projectId === mutation.projectId && normalize(row.subject) === normalize(mutation.newJob?.subject ?? ""));
    if (duplicate) reasons.push("duplicate-open-job");
  } else {
    if (!job) reasons.push("unknown-job");
    if (job && mutation.projectId !== job.projectId) reasons.push("job-project-mismatch");
    if (!mutation.expectedRecordVersion || mutation.expectedRecordVersion !== job?.recordVersion) reasons.push("stale-job-version");
    if (job && job.state !== "open" && job.state !== "snoozed") reasons.push("invalid-job-state");
    if (mutation.kind === "resolve_open_job" && mutation.targetJobState !== "resolved") reasons.push("invalid-resolve-transition");
    if (mutation.kind === "cancel_open_job" && mutation.targetJobState !== "cancelled") reasons.push("invalid-cancel-transition");
    if (mutation.kind === "update_open_job_holder" && !mutation.targetResponsibleParty) reasons.push("missing-target-holder");
  }
  return [...new Set(reasons)];
}

function rollbackFor(mutation: SterlingProposedCanonicalMutation): string {
  if (mutation.kind === "set_project_lifecycle") return "Append a founder-approved lifecycle event restoring the prior stage; never delete history.";
  if (mutation.kind === "create_open_job") return "Cancel the created Job through the canonical writer using a new audited mutation.";
  if (mutation.kind === "resolve_open_job" || mutation.kind === "cancel_open_job") return "Restore the prior Job state through a founder-approved compensating canonical mutation.";
  return "Restore the prior waiting actor through the canonical Job writer using a new audited mutation.";
}

function normalize(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
