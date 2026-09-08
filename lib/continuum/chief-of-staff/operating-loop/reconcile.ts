/**
 * CoS evidence reconciliation and morning anomaly pass.
 * May propose "looks complete". Must not resolve canonical work.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { OPEN_JOB_STALE_MS } from "@/lib/continuum/client-memory/project-jobs/intelligence";
import { isUnresolvedOpenJobState } from "@/lib/continuum/client-memory/project-jobs/validate";
import type { CosAnomalyItem, CosProjectContext, CosRecapItem } from "./types";
import {
  afterTimestamp,
  isUsableEvidence,
  looksAmbiguousReply,
  looksClientResponse,
  looksComplete,
  looksOpenWork,
  looksVendorEvidence,
  relatedToJob,
  sourceHrefFor,
  sourceLabelFor,
} from "./evidence";

const DAY_MS = 86_400_000;

function parseMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function personOrProject(
  job: ProjectJob,
  projects: ReadonlyMap<string, CosProjectContext>,
): { name: string; projectTitle: string } {
  const project = projects.get(job.projectId);
  return {
    name: project?.personName?.trim() || project?.title || "this client",
    projectTitle: project?.title ?? "this project",
  };
}

function relatedEvidence(job: ProjectJob, candidates: readonly ContinuumCandidate[]) {
  return candidates.filter((row) => relatedToJob(job, row));
}

export function proposeRecapItems(input: {
  jobs: readonly ProjectJob[];
  candidates: readonly ContinuumCandidate[];
  projects: ReadonlyMap<string, CosProjectContext>;
  newMutationId: () => string;
}): CosRecapItem[] {
  const items: CosRecapItem[] = [];
  const jobsWithProposal = new Set<string>();

  for (const job of input.jobs) {
    if (!isUnresolvedOpenJobState(job.state)) continue;
    const related = relatedEvidence(job, input.candidates).filter((row) =>
      afterTimestamp(row.sourceTimestamp, job.createdAt),
    );
    const completeHit = related.find((row) => looksComplete(row));
    const { name } = personOrProject(job, input.projects);
    if (completeHit) {
      jobsWithProposal.add(job.jobId);
      const matched = completeHit.evidenceBasis.matchedText;
      const approval =
        completeHit.payload.kind === "project_context" &&
        completeHit.payload.topic === "client_approval";
      items.push({
        id: `recap:${job.jobId}:${completeHit.candidateId}`,
        kind: "likely-complete",
        question: approval
          ? `${name} appears to have approved this. Close this follow-up?`
          : `Looks like you sent ${name} this. Mark complete?`,
        sourceLabel: sourceLabelFor(completeHit),
        sourceHref: sourceHrefFor(completeHit),
        matchedText: matched,
        jobId: job.jobId,
        projectId: job.projectId,
        projectTitle: input.projects.get(job.projectId)?.title ?? null,
        completable: true,
        writer: "open_job.resolve",
        mutationId: input.newMutationId(),
      });
      continue;
    }
    const ambiguous = related.find((row) => looksAmbiguousReply(row, job));
    if (ambiguous) {
      jobsWithProposal.add(job.jobId);
      items.push({
        id: `recap:${job.jobId}:${ambiguous.candidateId}`,
        kind: "ambiguous-complete",
        question: `You replied to ${name}, but I can't tell whether this was actually sent.`,
        sourceLabel: sourceLabelFor(ambiguous),
        sourceHref: sourceHrefFor(ambiguous),
        matchedText: ambiguous.evidenceBasis.matchedText,
        jobId: job.jobId,
        projectId: job.projectId,
        projectTitle: input.projects.get(job.projectId)?.title ?? null,
        completable: false,
        writer: null,
        mutationId: null,
      });
    }
  }

  for (const row of input.candidates) {
    if (!isUsableEvidence(row)) continue;
    if (row.candidateType !== "follow_up") continue;
    if (row.reviewStatus !== "approved") continue;
    const projectId = row.proposedTarget.kind === "open_job" || row.proposedTarget.kind === "project"
      ? row.proposedTarget.projectId
      : row.proposedTarget.kind === "project_spec"
        ? row.proposedTarget.projectId
        : null;
    const matchingJob = input.jobs.find(
      (job) =>
        isUnresolvedOpenJobState(job.state) &&
        (!projectId || job.projectId === projectId) &&
        relatedToJob(job, row),
    );
    if (matchingJob) continue;
    items.push({
      id: `recap:follow-up:${row.candidateId}`,
      kind: "approved-follow-up-without-job",
      question: "This approved follow-up has no Open Job yet. Review it before treating it as done.",
      sourceLabel: sourceLabelFor(row),
      sourceHref: sourceHrefFor(row),
      matchedText: row.evidenceBasis.matchedText,
      jobId: null,
      projectId,
      projectTitle: projectId ? (input.projects.get(projectId)?.title ?? null) : null,
      completable: false,
      writer: null,
      mutationId: null,
    });
    void jobsWithProposal;
  }

  return items;
}

export function detectAnomalies(input: {
  jobs: readonly ProjectJob[];
  candidates: readonly ContinuumCandidate[];
  recapJobIds: ReadonlySet<string>;
  nowIso: string;
  projects: ReadonlyMap<string, CosProjectContext>;
}): CosAnomalyItem[] {
  const nowMs = Date.parse(input.nowIso);
  const clock = Number.isFinite(nowMs) ? nowMs : 0;
  const items: CosAnomalyItem[] = [];

  for (const job of input.jobs) {
    const related = relatedEvidence(job, input.candidates);
    const { name, projectTitle } = personOrProject(job, input.projects);

    if (job.state === "resolved") {
      const contradict = related.find(
        (row) =>
          looksOpenWork(row) && afterTimestamp(row.sourceTimestamp, job.resolvedAt),
      );
      if (contradict) {
        items.push({
          id: `anomaly:contradict:${job.jobId}:${contradict.candidateId}`,
          kind: "contradicts-completion",
          headline: "Marked complete, but newer evidence disagrees",
          detail: `${projectTitle}: “${job.subject}” looks open again from later evidence.`,
          sourceLabel: sourceLabelFor(contradict),
          sourceHref: sourceHrefFor(contradict),
          jobId: job.jobId,
          projectId: job.projectId,
        });
      }
      continue;
    }

    if (!isUnresolvedOpenJobState(job.state)) continue;
    if (input.recapJobIds.has(job.jobId)) continue;

    const dueMs = parseMs(job.dueAt);
    const overdue = dueMs != null && dueMs < clock;
    const actionAfterCreate = related.some((row) =>
      afterTimestamp(row.sourceTimestamp, job.createdAt),
    );
    if (overdue && !actionAfterCreate) {
      items.push({
        id: `anomaly:overdue:${job.jobId}`,
        kind: "overdue-no-action",
        headline: "Past due, with no evidence of action",
        detail: `${projectTitle}: “${job.subject}” is still open and nothing newer is on file.`,
        sourceLabel: null,
        sourceHref: null,
        jobId: job.jobId,
        projectId: job.projectId,
      });
    }

    const touched = parseMs(job.updatedAt) ?? parseMs(job.createdAt);
    const founderWait = job.waitingOnActor === "founder";
    if (
      founderWait &&
      touched != null &&
      clock - touched >= OPEN_JOB_STALE_MS
    ) {
      items.push({
        id: `anomaly:stalled:${job.jobId}`,
        kind: "stalled-founder",
        headline: "Still waiting on you",
        detail: `${projectTitle} has been waiting on this longer than expected.`,
        sourceLabel: null,
        sourceHref: null,
        jobId: job.jobId,
        projectId: job.projectId,
      });
    }

    if (job.waitingOnActor === "client") {
      const response = related.find(
        (row) =>
          looksClientResponse(row) && afterTimestamp(row.sourceTimestamp, job.updatedAt),
      );
      if (response) {
        items.push({
          id: `anomaly:client:${job.jobId}:${response.candidateId}`,
          kind: "client-responded",
          headline: `${name} appears to have replied`,
          detail: `${projectTitle} was waiting on the client. There is newer evidence to review.`,
          sourceLabel: sourceLabelFor(response),
          sourceHref: sourceHrefFor(response),
          jobId: job.jobId,
          projectId: job.projectId,
        });
      }
    }

    if (job.waitingOnActor === "vendor") {
      const vendor = related.find(
        (row) =>
          looksVendorEvidence(row) && afterTimestamp(row.sourceTimestamp, job.updatedAt),
      );
      if (vendor) {
        items.push({
          id: `anomaly:vendor:${job.jobId}:${vendor.candidateId}`,
          kind: "vendor-evidence",
          headline: "Shop evidence arrived",
          detail: `${projectTitle} was waiting on the shop. Newer vendor evidence is on file.`,
          sourceLabel: sourceLabelFor(vendor),
          sourceHref: sourceHrefFor(vendor),
          jobId: job.jobId,
          projectId: job.projectId,
        });
      }
    }
  }

  return items;
}

export function recapJobIds(recap: readonly CosRecapItem[]): Set<string> {
  return new Set(recap.flatMap((row) => (row.jobId ? [row.jobId] : [])));
}

export const COS_ANOMALY_STALE_DAYS = OPEN_JOB_STALE_MS / DAY_MS;
