/**
 * Row mappers for continuum_project_jobs.
 * Drops invalid rows instead of inferring missing fields.
 */

import type { ProjectJob } from "./types";
import {
  isOpenJobActor,
  isOpenJobKind,
  isOpenJobSourceSystem,
  isOpenJobState,
  parseOpenJobCreatedBy,
  parseOpenJobDetail,
  parseOpenJobSourceRef,
  parseOpenJobSubject,
  stateTimestampsValid,
} from "./validate";

function timestampOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export const PROJECT_JOB_COLUMNS =
  "job_id, project_id, kind, subject, detail, waiting_on_actor, associated_person_id, state, due_at, deferred_until, resolved_at, cancelled_at, created_at, updated_at, created_by, source_system, source_ref, created_mutation_id";

export function rowToProjectJob(
  row: Record<string, unknown> | null | undefined,
): ProjectJob | null {
  if (!row || row.job_id == null || row.project_id == null) return null;
  if (!isOpenJobKind(row.kind)) return null;
  if (!isOpenJobActor(row.waiting_on_actor)) return null;
  if (!isOpenJobState(row.state)) return null;
  if (!isOpenJobSourceSystem(row.source_system)) return null;
  const subject = parseOpenJobSubject(
    row.subject == null ? null : String(row.subject),
  );
  const detail = parseOpenJobDetail(
    row.detail == null ? null : String(row.detail),
  );
  const sourceRef = parseOpenJobSourceRef(
    row.source_ref == null ? null : String(row.source_ref),
  );
  const createdBy = parseOpenJobCreatedBy(
    row.created_by == null ? null : String(row.created_by),
  );
  const dueAt = timestampOrNull(row.due_at);
  const deferredUntil = timestampOrNull(row.deferred_until);
  const resolvedAt = timestampOrNull(row.resolved_at);
  const cancelledAt = timestampOrNull(row.cancelled_at);
  const createdAt = timestampOrNull(row.created_at);
  const updatedAt = timestampOrNull(row.updated_at);
  if (
    !subject.ok ||
    !detail.ok ||
    !sourceRef.ok ||
    !createdBy.ok ||
    createdAt == null ||
    updatedAt == null
  ) {
    return null;
  }
  if (
    !stateTimestampsValid({
      state: row.state,
      deferredUntil,
      resolvedAt,
      cancelledAt,
    })
  ) {
    return null;
  }
  const associated =
    row.associated_person_id == null ? null : String(row.associated_person_id);
  return {
    jobId: String(row.job_id),
    projectId: String(row.project_id),
    kind: row.kind,
    subject: subject.subject,
    detail: detail.detail,
    waitingOnActor: row.waiting_on_actor,
    associatedPersonId: associated,
    state: row.state,
    dueAt,
    deferredUntil,
    resolvedAt,
    cancelledAt,
    createdAt,
    updatedAt,
    createdBy: createdBy.createdBy,
    sourceSystem: row.source_system,
    sourceRef: sourceRef.sourceRef,
    createdMutationId: String(row.created_mutation_id),
  };
}
