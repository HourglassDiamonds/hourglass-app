/**
 * Collect canonical actionable work for the CoS Top 5 view.
 * Open Jobs only. Does not copy rows into a task table.
 */

import { isUnresolvedOpenJobState } from "@/lib/continuum/client-memory/project-jobs/validate";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { ActionableWork, CosProjectContext } from "./types";

function isDeferredQuiet(job: ProjectJob, nowMs: number): boolean {
  if (job.state !== "snoozed") return false;
  if (!job.deferredUntil) return true;
  const until = Date.parse(job.deferredUntil);
  if (!Number.isFinite(until)) return true;
  return until > nowMs;
}

export function collectCanonicalActionables(input: {
  jobs: readonly ProjectJob[] | null | undefined;
  projects: ReadonlyMap<string, CosProjectContext>;
  nowIso: string;
}): ActionableWork[] {
  if (input.jobs == null) return [];
  const nowMs = Date.parse(input.nowIso);
  const clock = Number.isFinite(nowMs) ? nowMs : 0;
  const out: ActionableWork[] = [];
  const seen = new Set<string>();

  for (const job of input.jobs) {
    if (!isUnresolvedOpenJobState(job.state)) continue;
    if (isDeferredQuiet(job, clock)) continue;
    if (seen.has(job.jobId)) continue;
    seen.add(job.jobId);
    const project = input.projects.get(job.projectId);
    const associatedName = job.associatedPersonId
      ? (project?.people?.find((row) => row.personId === job.associatedPersonId)
          ?.displayName ?? null)
      : null;
    out.push({
      id: job.jobId,
      sourceType: "open_job",
      job,
      projectId: job.projectId,
      projectTitle: project?.title ?? "Project",
      personName: associatedName ?? project?.personName ?? null,
      isCurrentProject: project?.isCurrent ?? false,
      kind: job.kind,
      waitingOnActor: job.waitingOnActor,
      dueAt: job.dueAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      action: job.subject,
    });
  }
  return out;
}

export function selectTopRanked<T extends { id: string }>(
  ranked: readonly T[],
  limit: number,
  excludeIds: ReadonlySet<string> = new Set(),
): T[] {
  const selected: T[] = [];
  const used = new Set<string>();
  for (const item of ranked) {
    if (excludeIds.has(item.id) || used.has(item.id)) continue;
    used.add(item.id);
    selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}
