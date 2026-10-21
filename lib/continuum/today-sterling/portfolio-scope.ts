import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import type { TodayUpcomingItem } from "@/lib/continuum/calendar/today-upcoming";
import type { SterlingPreviousTodayItem } from "./types";

export type SterlingPortfolioInputs = {
  projects: readonly ProjectDeskSummary[];
  jobs: readonly ProjectJob[];
  candidates: readonly ContinuumCandidate[];
  corrections: readonly SourceCommunicationEvent[];
  calendar: readonly TodayUpcomingItem[];
  previousToday: readonly SterlingPreviousTodayItem[];
};

function candidateProjectId(candidate: ContinuumCandidate): string | null {
  const target = candidate.founderEditedTarget ?? candidate.proposedTarget;
  return "projectId" in target ? target.projectId : null;
}

/**
 * Selects the bounded operational portfolio before acceptance evaluation.
 * Acceptance cases never participate in this selection.
 */
export function selectSterlingPortfolio(input: SterlingPortfolioInputs): SterlingPortfolioInputs {
  const candidates = input.candidates.filter((candidate) =>
    candidate.candidateState !== "superseded" && candidate.reviewStatus !== "discarded");
  const openProjectIds = new Set(input.jobs.flatMap((job) =>
    job.projectId && (job.state === "open" || job.state === "snoozed") ? [job.projectId] : []));
  const evidencedProjectIds = new Set([
    ...candidates.flatMap((candidate) => candidateProjectId(candidate) ? [candidateProjectId(candidate)!] : []),
    ...input.corrections.flatMap((event) => event.projectId ? [event.projectId] : []),
    ...input.previousToday.flatMap((item) => item.projectId ? [item.projectId] : []),
  ]);
  const projects = input.projects.filter((project) =>
    project.lifecycleStage !== "completed" || openProjectIds.has(project.projectId) || evidencedProjectIds.has(project.projectId));
  const projectIds = new Set(projects.map((project) => project.projectId));
  const jobs = input.jobs.filter((job) =>
    job.projectId === null || projectIds.has(job.projectId));

  return {
    projects,
    jobs,
    candidates,
    corrections: [...input.corrections],
    calendar: [...input.calendar],
    previousToday: [...input.previousToday],
  };
}
