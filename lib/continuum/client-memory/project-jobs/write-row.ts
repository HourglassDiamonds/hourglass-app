/**
 * Map canonical Open Jobs to continuum_project_jobs write rows.
 */

import type { ProjectJob } from "./types";

export function projectJobToRow(job: ProjectJob): Record<string, unknown> {
  return {
    job_id: job.jobId,
    project_id: job.projectId,
    kind: job.kind,
    subject: job.subject,
    detail: job.detail,
    waiting_on_actor: job.waitingOnActor,
    associated_person_id: job.associatedPersonId,
    state: job.state,
    due_at: job.dueAt,
    deferred_until: job.deferredUntil,
    resolved_at: job.resolvedAt,
    cancelled_at: job.cancelledAt,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    created_by: job.createdBy,
    source_system: job.sourceSystem,
    source_ref: job.sourceRef,
    created_mutation_id: job.createdMutationId,
  };
}
