import { assessAttentionTarget } from "@/lib/continuum/client-memory/project-jobs/attention-evidence";
import { evaluateAttentionEligibility } from "@/lib/continuum/client-memory/project-jobs/attention-eligibility";
import { attentionModeOf } from "@/lib/continuum/client-memory/project-jobs/attention";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { CurrentWorkProjection } from "./current-work";
import type { CosAttentionItem, CosProjectContext } from "./types";

export function attentionPresentationStatus(
  job: ProjectJob,
  now: Date,
  projections: readonly CurrentWorkProjection[] = [],
): CosAttentionItem["status"] {
  const eligibility = evaluateAttentionEligibility(job, {
    now,
    target: assessAttentionTarget(job, projections),
  });
  if (eligibility.reason === "terminal" || eligibility.reason === "target-satisfied" || eligibility.reason === "target-superseded") {
    return "terminal-resolved";
  }
  if (eligibility.reason === "repair-required") return "repair-required";
  if (attentionModeOf(job) === "reminder") {
    return eligibility.eligible ? "actionable-now" : "scheduled-later";
  }
  if (eligibility.reason === "watch-review") return "checkpoint-due";
  return "still-waiting";
}

export function presentAttentionJobs(input: {
  jobs: readonly ProjectJob[];
  projects: ReadonlyMap<string, CosProjectContext>;
  nowIso: string;
  projections?: readonly CurrentWorkProjection[];
  newMutationId: () => string;
}): CosAttentionItem[] {
  const now = new Date(input.nowIso);
  return input.jobs.flatMap((job) => {
    const mode = attentionModeOf(job);
    if (mode === "action") return [];
    const project = job.projectId ? input.projects.get(job.projectId) : undefined;
    return [{
      jobId: job.jobId,
      projectId: job.projectId,
      projectTitle: project?.title ?? (job.projectId ? "Project" : "Founder work"),
      subject: job.subject,
      detail: job.detail,
      sourceRef: job.sourceRef,
      mode,
      status: attentionPresentationStatus(job, now, input.projections),
      scheduledAt: mode === "reminder" ? job.activationAt ?? null : job.checkpointAt ?? null,
      waitingOnActor: job.waitingOnActor,
      mutationId: input.newMutationId(),
      canonical: true as const,
    }];
  });
}
