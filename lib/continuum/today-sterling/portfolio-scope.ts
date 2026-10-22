import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import type { TodayUpcomingItem } from "@/lib/continuum/calendar/today-upcoming";
import type { SterlingPreviousTodayItem } from "./types";
import { collectExactGmailIds } from "@/lib/continuum/candidates/exact-gmail-ids";
import {
  isFounderAttentionWorthy,
  type FounderAttentionContext,
} from "@/lib/continuum/candidates/founder-attention";
import { isCandidateQuietForToday } from "@/lib/continuum/chief-of-staff/operating-loop/quiet";

export type SterlingPortfolioInputs = {
  projects: readonly ProjectDeskSummary[];
  jobs: readonly ProjectJob[];
  candidates: readonly ContinuumCandidate[];
  corrections: readonly SourceCommunicationEvent[];
  calendar: readonly TodayUpcomingItem[];
  previousToday: readonly SterlingPreviousTodayItem[];
};

export type SterlingPortfolioSuppressionReason =
  | "superseded_or_discarded"
  | "deferred_or_quoted_historical"
  | "historical_context_outside_active_frontier";

export type SterlingPortfolioSelection = SterlingPortfolioInputs & {
  candidateCoverage: {
    total: number;
    selected: number;
    suppressed: number;
    suppressedByReason: Readonly<Record<SterlingPortfolioSuppressionReason, number>>;
  };
};

function candidateProjectId(candidate: ContinuumCandidate): string | null {
  const target = candidate.founderEditedTarget ?? candidate.proposedTarget;
  return "projectId" in target ? target.projectId : null;
}

function isCurrentOperationalJob(candidate: ContinuumCandidate, nowIso: string): boolean {
  const payload = candidate.founderEditedPayload ?? candidate.payload;
  if (payload.kind !== "open_job") return false;
  const sourceAt = Date.parse(candidate.sourceTimestamp);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(sourceAt) || !Number.isFinite(now)) return false;
  return sourceAt <= now && now - sourceAt <= 30 * 86_400_000;
}

/**
 * Selects the bounded operational portfolio before acceptance evaluation.
 * Acceptance cases never participate in this selection.
 */
export function selectSterlingPortfolio(
  input: SterlingPortfolioInputs,
  nowIso = new Date().toISOString(),
): SterlingPortfolioSelection {
  const openProjectIds = new Set(input.jobs.flatMap((job) =>
    job.projectId && (job.state === "open" || job.state === "snoozed") ? [job.projectId] : []));
  const durableProjectIds = new Set([
    ...input.corrections.flatMap((event) => event.projectId ? [event.projectId] : []),
    ...input.previousToday.flatMap((item) => item.projectId ? [item.projectId] : []),
  ]);
  const initiallyActiveProjectIds = new Set(input.projects.flatMap((project) =>
    project.lifecycleStage !== "completed" || openProjectIds.has(project.projectId) || durableProjectIds.has(project.projectId)
      ? [project.projectId]
      : []));
  const context: FounderAttentionContext = {
    jobs: input.jobs,
    nowIso,
    currentProjectIds: initiallyActiveProjectIds,
    lifecycleByProject: new Map(input.projects.map((project) => [project.projectId, project.lifecycleStage])),
    specByProject: new Map(input.projects.map((project) => [
      project.projectId,
      new Map((project.specs ?? []).map((spec) => [spec.fieldName, spec.value])),
    ])),
  };
  const baseEligible = input.candidates.filter((candidate) =>
    candidate.candidateState !== "superseded" &&
    candidate.reviewStatus !== "discarded" &&
    !isCandidateQuietForToday(candidate, nowIso));
  const frontierAnchors = baseEligible.filter((candidate) => {
    const projectId = candidateProjectId(candidate);
    return (projectId != null && initiallyActiveProjectIds.has(projectId)) ||
      isCurrentOperationalJob(candidate, nowIso) ||
      isFounderAttentionWorthy(candidate, context);
  });
  const frontierThreadIds = new Set(collectExactGmailIds(frontierAnchors).threadIds);
  const frontierProjectIds = new Set([
    ...initiallyActiveProjectIds,
    ...frontierAnchors.flatMap((candidate) => candidateProjectId(candidate) ? [candidateProjectId(candidate)!] : []),
  ]);
  const candidates = baseEligible.filter((candidate) => {
    const projectId = candidateProjectId(candidate);
    if (projectId && frontierProjectIds.has(projectId)) return true;
    const ids = collectExactGmailIds([candidate]);
    if (ids.threadIds.some((threadId) => frontierThreadIds.has(threadId))) return true;
    return candidate.sourceSystem !== "gmail" && isFounderAttentionWorthy(candidate, context);
  });
  const projects = input.projects.filter((project) => frontierProjectIds.has(project.projectId));
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
    candidateCoverage: {
      total: input.candidates.length,
      selected: candidates.length,
      suppressed: input.candidates.length - candidates.length,
      suppressedByReason: {
        superseded_or_discarded: input.candidates.filter((candidate) =>
          candidate.candidateState === "superseded" || candidate.reviewStatus === "discarded").length,
        deferred_or_quoted_historical: input.candidates.filter((candidate) =>
          candidate.candidateState !== "superseded" && candidate.reviewStatus !== "discarded" &&
          isCandidateQuietForToday(candidate, nowIso)).length,
        historical_context_outside_active_frontier: baseEligible.length - candidates.length,
      },
    },
  };
}
