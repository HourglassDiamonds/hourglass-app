import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SterlingApprovedCanonicalOperation } from "./canonical-approval-adapter";
import {
  sourceSuppressionBindingError,
  type CanonicalApprovalRow,
} from "./canonical-approval-repository";

export type CanonicalApprovalReviewIdentity = {
  project: { projectId: string; displayTitle: string; projectKind: string; updatedAt: string } | null;
  people: readonly { personId: string; displayName: string; relationshipVerified: boolean }[];
  jobs: readonly {
    jobId: string;
    projectId: string | null;
    personId: string | null;
    subject: string;
    state: string;
    waitingOn: string;
    updatedAt: string;
  }[];
  candidate: {
    candidateId: string;
    sourceSystem: string;
    sourceRef: string;
    payloadKind: string;
    emailHash: string | null;
    recordVersion: string;
    candidateState: string;
    reviewStatus: string;
  } | null;
};

export type CanonicalApprovalReview = {
  proposal: CanonicalApprovalRow;
  identity: CanonicalApprovalReviewIdentity;
  currentLifecycle: { stage: string | null; recordVersion: string } | null;
  proposedChanges: readonly {
    operationId: string;
    kind: string;
    target: string;
    personId: string | null;
    jobId: string | null;
    expectedRecordVersion: string;
    evidenceRefs: readonly string[];
  }[];
  blockers: readonly string[];
  missingEvidence: readonly string[];
  ambiguities: readonly string[];
  canApprove: boolean;
  canReject: boolean;
  deferSupported: false;
};

export class SupabaseSterlingCanonicalApprovalReviewReader {
  constructor(private readonly client: SupabaseClient) {}

  async load(proposal: CanonicalApprovalRow): Promise<CanonicalApprovalReview> {
    return proposal.originalPayload.kind === "canonical_change_set"
      ? this.loadCanonicalChangeSet(proposal)
      : this.loadSourceSuppression(proposal);
  }

  private async loadCanonicalChangeSet(proposal: CanonicalApprovalRow): Promise<CanonicalApprovalReview> {
    const payload = proposal.originalPayload;
    if (payload.kind !== "canonical_change_set") throw new Error("canonical-review-kind-mismatch");
    const personIds = [...new Set(payload.operations.map((operation) => operation.personId))];
    const jobIds = [...new Set(payload.operations.flatMap((operation) => "jobId" in operation ? [operation.jobId] : []))];
    const [profile, lifecycle, people, jobs, relationships] = await Promise.all([
      this.client.from("continuum_project_profiles")
        .select("project_id, display_title, project_kind, updated_at")
        .eq("project_id", payload.projectId).maybeSingle(),
      this.client.from("continuum_project_lifecycle_states")
        .select("project_id, project_kind, stage, updated_at")
        .eq("project_id", payload.projectId).eq("project_kind", payload.projectKind).maybeSingle(),
      personIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : this.client.from("continuum_person_profiles")
          .select("person_id, display_name").in("person_id", personIds),
      jobIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : this.client.from("continuum_project_jobs")
          .select("job_id, project_id, associated_person_id, subject, state, waiting_on_actor, updated_at")
          .in("job_id", jobIds),
      Promise.all(personIds.map((personId) => this.hasProjectRelationship(personId, payload.projectId))),
    ]);
    if (profile.error || lifecycle.error || people.error || jobs.error) {
      throw new Error("canonical-review-state-unavailable");
    }

    const relationshipByPerson = new Map(personIds.map((personId, index) => [personId, relationships[index] ?? false]));
    const personRows = new Map((people.data ?? []).map((row) => [String(row.person_id), row]));
    const jobRows = new Map((jobs.data ?? []).map((row) => [String(row.job_id), row]));
    const lifecycleVersion = lifecycle.data?.updated_at == null ? "absent" : String(lifecycle.data.updated_at);
    const blockers: string[] = [];
    const missingEvidence: string[] = [];

    if (!profile.data) blockers.push("Project record is missing.");
    else if (String(profile.data.project_kind) !== payload.projectKind) blockers.push("Project kind no longer matches the approved proposal identity.");

    for (const personId of personIds) {
      if (!personRows.has(personId)) blockers.push(`Person ${personId} is missing.`);
      if (!relationshipByPerson.get(personId)) blockers.push(`Person ${personId} is not bound to project ${payload.projectId}.`);
    }

    for (const operation of payload.operations) {
      if (operation.evidenceRefs.length === 0) missingEvidence.push(`Operation ${operation.operationId} has no evidence reference.`);
      if (operation.kind === "set_project_lifecycle") {
        const currentStage = lifecycle.data?.stage == null ? null : String(lifecycle.data.stage);
        if (currentStage !== operation.expectedCurrentStage) blockers.push(`Lifecycle stage changed for operation ${operation.operationId}.`);
        if (lifecycleVersion !== operation.expectedRecordVersion) blockers.push(`Lifecycle version is stale for operation ${operation.operationId}.`);
        continue;
      }
      const job = jobRows.get(operation.jobId);
      if (!job) {
        blockers.push(`Job ${operation.jobId} is missing.`);
        continue;
      }
      if (String(job.project_id) !== payload.projectId) blockers.push(`Job ${operation.jobId} belongs to a different project.`);
      if (String(job.associated_person_id) !== operation.personId) blockers.push(`Job ${operation.jobId} is bound to a different client.`);
      if (String(job.updated_at) !== operation.expectedRecordVersion) blockers.push(`Job ${operation.jobId} has a stale record version.`);
      if (!["open", "snoozed"].includes(String(job.state))) blockers.push(`Job ${operation.jobId} is no longer open.`);
    }

    return {
      proposal,
      identity: {
        project: profile.data ? {
          projectId: String(profile.data.project_id),
          displayTitle: String(profile.data.display_title),
          projectKind: String(profile.data.project_kind),
          updatedAt: String(profile.data.updated_at),
        } : null,
        people: personIds.map((personId) => ({
          personId,
          displayName: personRows.has(personId) ? String(personRows.get(personId)?.display_name) : "Missing person",
          relationshipVerified: relationshipByPerson.get(personId) === true,
        })),
        jobs: jobIds.map((jobId) => {
          const row = jobRows.get(jobId);
          return {
            jobId,
            projectId: row?.project_id == null ? null : String(row.project_id),
            personId: row?.associated_person_id == null ? null : String(row.associated_person_id),
            subject: row ? String(row.subject) : "Missing job",
            state: row ? String(row.state) : "missing",
            waitingOn: row ? String(row.waiting_on_actor) : "unknown",
            updatedAt: row ? String(row.updated_at) : "missing",
          };
        }),
        candidate: null,
      },
      currentLifecycle: lifecycle.data ? {
        stage: lifecycle.data.stage == null ? null : String(lifecycle.data.stage),
        recordVersion: lifecycleVersion,
      } : null,
      proposedChanges: payload.operations.map(operationSummary),
      blockers: unique(blockers),
      missingEvidence: unique(missingEvidence),
      ambiguities: unique([...blockers, ...missingEvidence]),
      canApprove: proposal.status === "proposed" && proposal.founderDecision == null && blockers.length === 0 && missingEvidence.length === 0,
      canReject: proposal.status === "proposed" && proposal.founderDecision == null,
      deferSupported: false,
    };
  }

  private async loadSourceSuppression(proposal: CanonicalApprovalRow): Promise<CanonicalApprovalReview> {
    const payload = proposal.originalPayload;
    if (payload.kind !== "source_suppression") throw new Error("canonical-review-kind-mismatch");
    const candidate = await this.client.from("continuum_candidates")
      .select("candidate_id, source_system, source_ref, payload, record_version, candidate_state, review_status")
      .eq("candidate_id", payload.candidateId).maybeSingle();
    if (candidate.error) throw new Error("canonical-review-state-unavailable");
    const blockers: string[] = [];
    if (!candidate.data) blockers.push("Candidate record is missing.");
    else {
      const bindingError = sourceSuppressionBindingError(payload, candidate.data as Record<string, unknown>);
      if (bindingError) blockers.push(bindingError);
    }
    const candidatePayload = candidate.data?.payload && typeof candidate.data.payload === "object" && !Array.isArray(candidate.data.payload)
      ? candidate.data.payload as Record<string, unknown>
      : null;
    const target = payload.action === "suppress"
      ? `${payload.disposition} suppression for exact source ${payload.sourceRefs[0]}`
      : `restore suppression ${payload.compensatesProposalId}`;
    return {
      proposal,
      identity: {
        project: null,
        people: [],
        jobs: [],
        candidate: candidate.data ? {
          candidateId: String(candidate.data.candidate_id),
          sourceSystem: String(candidate.data.source_system),
          sourceRef: String(candidate.data.source_ref),
          payloadKind: String(candidatePayload?.kind ?? "unknown"),
          emailHash: candidatePayload?.emailHash == null ? null : String(candidatePayload.emailHash),
          recordVersion: String(candidate.data.record_version),
          candidateState: String(candidate.data.candidate_state),
          reviewStatus: String(candidate.data.review_status),
        } : null,
      },
      currentLifecycle: null,
      proposedChanges: [{
        operationId: payload.approvalId,
        kind: `source_${payload.action}`,
        target,
        personId: null,
        jobId: null,
        expectedRecordVersion: payload.expectedRecordVersion,
        evidenceRefs: payload.sourceRefs,
      }],
      blockers: unique(blockers),
      missingEvidence: payload.sourceRefs.length === 1 ? [] : ["Exactly one source reference is required."],
      ambiguities: unique(blockers),
      canApprove: proposal.status === "proposed" && proposal.founderDecision == null && blockers.length === 0,
      canReject: proposal.status === "proposed" && proposal.founderDecision == null,
      deferSupported: false,
    };
  }

  private async hasProjectRelationship(personId: string, projectId: string): Promise<boolean> {
    const [forward, reverse] = await Promise.all([
      this.client.from("continuum_relationships").select("id").eq("kind", "client-project")
        .eq("status", "active").eq("from_entity_id", personId).eq("to_entity_id", projectId).limit(1),
      this.client.from("continuum_relationships").select("id").eq("kind", "client-project")
        .eq("status", "active").eq("from_entity_id", projectId).eq("to_entity_id", personId).limit(1),
    ]);
    if (forward.error || reverse.error) throw new Error("canonical-review-relationship-unavailable");
    return (forward.data?.length ?? 0) + (reverse.data?.length ?? 0) > 0;
  }
}

function operationSummary(operation: SterlingApprovedCanonicalOperation): CanonicalApprovalReview["proposedChanges"][number] {
  const target = operation.kind === "set_project_lifecycle"
    ? `Lifecycle: ${operation.expectedCurrentStage ?? "not set"} → ${operation.targetLifecycleStage}`
    : operation.kind === "update_open_job_holder"
      ? `Waiting on: ${operation.targetResponsibleParty}`
      : operation.kind === "resolve_open_job"
        ? "Resolve completed obligation"
        : "Cancel declined or superseded obligation";
  return {
    operationId: operation.operationId,
    kind: operation.kind,
    target,
    personId: operation.personId,
    jobId: "jobId" in operation ? operation.jobId : null,
    expectedRecordVersion: operation.expectedRecordVersion,
    evidenceRefs: operation.evidenceRefs,
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
