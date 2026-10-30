import { createHash } from "node:crypto";
import type {
  SterlingEvidence,
  SterlingFounderDisposition,
  SterlingPortfolioAssessment,
  SterlingResponsibleParty,
  SterlingTodayCategory,
  SterlingProposedCanonicalMutation,
  SterlingTodayProposal,
  SterlingTodayRecommendation,
  SterlingTodayWorkingSet,
} from "./types";

type FounderEvidence = SterlingEvidence & {
  founderDirective: NonNullable<SterlingEvidence["founderDirective"]>;
};

const TERMINAL_DISPOSITIONS = new Set<SterlingFounderDisposition>([
  "completed",
  "declined",
  "dormant",
  "rejected_junk",
  "solicitation",
]);

function latestFounderEvidence(
  workingSet: SterlingTodayWorkingSet,
  workUnitId: string,
  evidenceRefs: readonly string[],
): FounderEvidence | null {
  const allowed = new Set(evidenceRefs);
  return workingSet.evidence
    .filter((row): row is FounderEvidence => allowed.has(row.evidenceId) && Boolean(row.founderDirective) &&
      (!row.founderDirective?.workUnitId || row.founderDirective.workUnitId === workUnitId))
    .sort((left, right) => {
      const byTime = Date.parse(left.timestamp) - Date.parse(right.timestamp);
      return byTime || left.evidenceId.localeCompare(right.evidenceId);
    })
    .at(-1) ?? null;
}

function categoryFor(
  owner: SterlingResponsibleParty,
  lifecycleStage: string | null,
  priority: SterlingPortfolioAssessment["attentionPriority"],
): SterlingTodayCategory {
  if (priority === "action_now") return owner === "founder" ? "founder_actions" : "up_next";
  if (lifecycleStage === "production" || lifecycleStage === "bench" || lifecycleStage === "quality_control") {
    return "in_production";
  }
  if (lifecycleStage === "ready_for_delivery" || lifecycleStage === "ready_for_return") return "ready_delivery";
  if (owner === "client") return "waiting_on_client";
  if (owner === "vendor_shop") return "waiting_on_shop";
  return "held_watching";
}

function addEvidence(refs: readonly string[], evidenceId: string): string[] {
  return [...new Set([...refs, evidenceId])];
}

function founderItemId(workUnitId: string, directiveId: string): string {
  return `founder:${createHash("sha256").update(`${workUnitId}|${directiveId}`).digest("hex").slice(0, 20)}`;
}

function founderMutationKey(directiveId: string, kind: string, targetId: string): string {
  return `founder-mutation:${createHash("sha256").update(`${directiveId}|${kind}|${targetId}`).digest("hex").slice(0, 20)}`;
}

function founderCanonicalMutations(
  workingSet: SterlingTodayWorkingSet,
  directives: ReadonlyMap<string, FounderEvidence>,
): SterlingProposedCanonicalMutation[] {
  const mutations: SterlingProposedCanonicalMutation[] = [];
  for (const [workUnitId, evidence] of directives) {
    const unit = workingSet.workUnits.find((row) => row.workUnitId === workUnitId);
    const project = unit?.projectId
      ? workingSet.projects.find((row) => row.projectId === unit.projectId)
      : null;
    if (!project) continue;
    const directive = evidence.founderDirective;
    const base = {
      projectId: project.projectId,
      personId: null,
      evidenceRefs: [evidence.evidenceId],
      requiresFounderApproval: true as const,
    };
    if (directive.lifecycleStage != null && directive.lifecycleStage !== project.lifecycleStage) {
      mutations.push({
        ...base,
        proposalKey: founderMutationKey(directive.directiveId, "set_project_lifecycle", project.projectId),
        kind: "set_project_lifecycle",
        jobId: null,
        expectedRecordVersion: project.recordVersion,
        targetLifecycleStage: directive.lifecycleStage,
        targetJobState: null,
        targetResponsibleParty: null,
        newJob: null,
        reason: "Founder-authoritative lifecycle correction; review before canonical application.",
      });
    }
    const openJobs = workingSet.jobs.filter((job) => job.projectId === project.projectId &&
      (job.state === "open" || job.state === "snoozed"));
    const terminal = directive.disposition != null && TERMINAL_DISPOSITIONS.has(directive.disposition);
    for (const job of openJobs) {
      if (terminal) {
        const completed = directive.disposition === "completed";
        mutations.push({
          ...base,
          proposalKey: founderMutationKey(
            directive.directiveId,
            completed ? "resolve_open_job" : "cancel_open_job",
            job.jobId,
          ),
          kind: completed ? "resolve_open_job" : "cancel_open_job",
          jobId: job.jobId,
          expectedRecordVersion: job.recordVersion,
          targetLifecycleStage: null,
          targetJobState: completed ? "resolved" : "cancelled",
          targetResponsibleParty: null,
          newJob: null,
          reason: completed
            ? "Founder-confirmed completion; review resolution of the remaining canonical open job."
            : "Founder-confirmed terminal disposition; review cancellation of the stale canonical open job.",
        });
      } else if (openJobs.length === 1 && directive.waitingOn && directive.waitingOn !== job.responsibleParty) {
        mutations.push({
          ...base,
          proposalKey: founderMutationKey(directive.directiveId, "update_open_job_holder", job.jobId),
          kind: "update_open_job_holder",
          jobId: job.jobId,
          expectedRecordVersion: job.recordVersion,
          targetLifecycleStage: null,
          targetJobState: null,
          targetResponsibleParty: directive.waitingOn,
          newJob: null,
          reason: "Founder-authoritative waiting-on correction; review before canonical job update.",
        });
      }
    }
  }
  return mutations;
}

function mutationAxis(mutation: SterlingProposedCanonicalMutation): string {
  if (mutation.kind === "set_project_lifecycle") return `lifecycle:${mutation.projectId}`;
  if (mutation.kind === "update_open_job_holder") return `holder:${mutation.jobId}`;
  if (mutation.kind === "resolve_open_job" || mutation.kind === "cancel_open_job") return `job-state:${mutation.jobId}`;
  return `create-job:${mutation.projectId}:${mutation.proposalKey}`;
}

function reconciledAssessment(
  assessment: SterlingPortfolioAssessment,
  evidence: FounderEvidence,
): SterlingPortfolioAssessment {
  const directive = evidence.founderDirective;
  const terminal = directive.disposition != null && TERMINAL_DISPOSITIONS.has(directive.disposition);
  const priority = terminal ? "no_attention" : directive.attentionPriority ?? assessment.attentionPriority;
  const owner = directive.waitingOn ?? assessment.nextStepOwner;
  const disposition = terminal || priority === "no_attention" ? "suppressed" : "presented";
  const recommendationItemId = disposition === "presented"
    ? assessment.recommendationItemId ?? founderItemId(assessment.workUnitId, directive.directiveId)
    : null;
  return {
    ...assessment,
    todayDisposition: disposition,
    recommendationItemId,
    currentStage: {
      ...assessment.currentStage,
      canonicalLifecycleStage: directive.lifecycleStage === undefined
        ? assessment.currentStage.canonicalLifecycleStage
        : directive.lifecycleStage,
      responsibleParty: owner,
      confidence: "high",
      explanation: `Founder-authoritative directive recorded at ${evidence.timestamp}.`,
      evidenceRefs: addEvidence(assessment.currentStage.evidenceRefs, evidence.evidenceId),
    },
    obligations: terminal
      ? assessment.obligations.map((row) => ({
          ...row,
          status: row.status === "open" || row.status === "ambiguous" ? "superseded" as const : row.status,
          confidence: "high" as const,
          evidenceRefs: addEvidence(row.evidenceRefs, evidence.evidenceId),
        }))
      : assessment.obligations,
    nextStepOwner: owner,
    attentionPriority: priority,
    confidence: "high",
    evidenceRefs: addEvidence(assessment.evidenceRefs, evidence.evidenceId),
    ambiguities: [],
    explanation: `Founder authority supersedes older inference. ${assessment.explanation}`,
    omissionReason: disposition === "suppressed"
      ? `Founder-authoritative disposition: ${directive.disposition ?? "no_attention"}. History is retained.`
      : null,
  };
}

function reconciledRecommendation(input: {
  assessment: SterlingPortfolioAssessment;
  prior: SterlingTodayRecommendation | null;
  evidence: FounderEvidence;
  workingSet: SterlingTodayWorkingSet;
}): SterlingTodayRecommendation | null {
  const { assessment, prior, evidence, workingSet } = input;
  if (assessment.todayDisposition !== "presented" || !assessment.recommendationItemId) return null;
  const unit = workingSet.workUnits.find((row) => row.workUnitId === assessment.workUnitId);
  if (!unit) return null;
  const directive = evidence.founderDirective;
  const summary = evidence.excerpt?.trim() || "Founder-confirmed current state.";
  return {
    itemId: assessment.recommendationItemId,
    workUnitId: assessment.workUnitId,
    category: categoryFor(
      assessment.nextStepOwner,
      assessment.currentStage.canonicalLifecycleStage,
      assessment.attentionPriority,
    ),
    projectId: assessment.projectId,
    personId: prior?.personId ?? null,
    relationshipRole: directive.relationshipRole ?? prior?.relationshipRole ?? "unknown",
    title: prior?.title ?? unit.label,
    summary: prior?.summary ?? summary,
    attentionPriority: assessment.attentionPriority,
    confidence: "high",
    explanation: `Founder-authoritative directive recorded at ${evidence.timestamp}.`,
    evidenceRefs: addEvidence(prior?.evidenceRefs ?? [], evidence.evidenceId),
    ambiguities: [],
    obligations: assessment.obligations.filter((row) => row.status === "open" || row.status === "ambiguous"),
  };
}

/**
 * Deterministic post-model authority boundary. The model reasons; this layer
 * guarantees that a newer, identity-bound founder directive cannot be
 * resurrected or contradicted by older evidence on refresh.
 */
export function applySterlingFounderAuthority(
  workingSet: SterlingTodayWorkingSet,
  proposal: SterlingTodayProposal,
): SterlingTodayProposal {
  const priorRecommendations = new Map(
    proposal.recommendations.map((row) => [row.workUnitId, row] as const),
  );
  const directives = new Map<string, FounderEvidence>();
  const assessments = proposal.portfolioAssessments.map((assessment) => {
    const unit = workingSet.workUnits.find((row) => row.workUnitId === assessment.workUnitId);
    const evidence = unit ? latestFounderEvidence(workingSet, unit.workUnitId, unit.evidenceRefs) : null;
    if (!evidence) return assessment;
    directives.set(assessment.workUnitId, evidence);
    return reconciledAssessment(assessment, evidence);
  });
  const assessmentByUnit = new Map(assessments.map((row) => [row.workUnitId, row] as const));
  const untouched = proposal.recommendations.filter((row) => !directives.has(row.workUnitId));
  const enforced = [...directives].flatMap(([workUnitId, evidence]) => {
    const assessment = assessmentByUnit.get(workUnitId);
    if (!assessment) return [];
    const recommendation = reconciledRecommendation({
      assessment,
      prior: priorRecommendations.get(workUnitId) ?? null,
      evidence,
      workingSet,
    });
    return recommendation ? [recommendation] : [];
  });
  const founderMutations = founderCanonicalMutations(workingSet, directives);
  const founderAxes = new Set(founderMutations.map(mutationAxis));
  return {
    ...proposal,
    portfolioAssessments: assessments,
    recommendations: [...untouched, ...enforced],
    proposedCanonicalMutations: [
      ...proposal.proposedCanonicalMutations.filter((mutation) => !founderAxes.has(mutationAxis(mutation))),
      ...founderMutations,
    ],
  };
}
