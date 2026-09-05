/**
 * Deterministic Open Job read helpers for Project Desk.
 * Does not infer jobs from notes, Lifecycle, Gmail, or operating fields.
 */

import { isUnresolvedOpenJobState } from "./validate";
import type {
  ProjectDeskOpenJob,
  ProjectDeskOpenJobs,
  ProjectJob,
} from "./types";

export function disconnectedOpenJobs(): ProjectDeskOpenJobs {
  return { connected: false };
}

export function sortProjectJobs(rows: readonly ProjectJob[]): ProjectJob[] {
  return [...rows].sort((a, b) => {
    if (a.createdAt === b.createdAt) return b.jobId.localeCompare(a.jobId);
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export function unresolvedJobsForProject(
  jobs: readonly ProjectJob[] | null | undefined,
  projectId: string,
): ProjectJob[] | null {
  if (jobs == null) return null;
  return sortProjectJobs(
    jobs.filter(
      (row) => row.projectId === projectId && isUnresolvedOpenJobState(row.state),
    ),
  );
}

export function deskJobsFromCanonical(
  jobs: readonly ProjectJob[],
  people: ReadonlyArray<{ personId: string; displayName: string }>,
): ProjectDeskOpenJob[] {
  const names = new Map(people.map((row) => [row.personId, row.displayName]));
  return jobs.flatMap((row) => {
    if (!isUnresolvedOpenJobState(row.state)) return [];
    return [
      {
        jobId: row.jobId,
        kind: row.kind,
        subject: row.subject,
        detail: row.detail,
        waitingOnActor: row.waitingOnActor,
        associatedPersonId: row.associatedPersonId,
        associatedPersonName:
          row.associatedPersonId && names.has(row.associatedPersonId)
            ? (names.get(row.associatedPersonId) ?? null)
            : null,
        state: row.state,
        dueAt: row.dueAt,
        deferredUntil: row.deferredUntil,
        createdAt: row.createdAt,
        sourceSystem: row.sourceSystem,
      },
    ];
  });
}

export function openJobsReadModel(
  jobs: readonly ProjectJob[] | null | undefined,
  projectId: string,
  people: ReadonlyArray<{ personId: string; displayName: string }>,
): ProjectDeskOpenJobs {
  const unresolved = unresolvedJobsForProject(jobs, projectId);
  if (unresolved == null) return disconnectedOpenJobs();
  const deskJobs = deskJobsFromCanonical(unresolved, people);
  return {
    connected: true,
    unresolved: deskJobs,
    unresolvedCount: deskJobs.length,
  };
}

export function jobsCoverageLevel(
  openJobs: ProjectDeskOpenJobs,
): "not-connected" | "available" | "none" {
  if (!openJobs.connected) return "not-connected";
  return openJobs.unresolvedCount > 0 ? "available" : "none";
}
