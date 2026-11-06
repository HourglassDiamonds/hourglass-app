/**
 * Pure CoS operating-loop composition.
 * Does not write Open Jobs, Candidates, People, or Lifecycle.
 */

import { createHash } from "node:crypto";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import { selectOpenProjectWork } from "@/lib/continuum/client-memory/open-projects/select";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { nextAttentionBoundary } from "@/lib/continuum/client-memory/project-jobs/attention-boundary";
import {
  isClientPersonLabel,
  collectTodayFounderEmailHashes,
  type TodayGmailThreadContext,
  type TodayKnownPerson,
} from "@/lib/continuum/candidates/founder-attention";
import { collectCanonicalActionables, selectTopRanked } from "./collect";
import { composeFounderAttentionSurface } from "./founder-attention";
import { composeConciergeBrief } from "./moderator";
import { detectAnomalies, proposeRecapItems, recapJobIds } from "./reconcile";
import { DETERMINISTIC_ACTIONABLE_RANKER } from "./rank";
import { proposeExplicitActions } from "./propose-actions";
import {
  associatedGmailThreadsByProject,
  projectBySupportedAssociation,
} from "./attribution";
import {
  COS_ACTIVE_HEADING,
  COS_CAUGHT_UP_DETAIL,
  COS_CAUGHT_UP_HEADING,
  COS_DISCONNECTED_DETAIL,
  COS_DISCONNECTED_HEADING,
  presentTop5Item,
} from "./present";
import type { ActionableRanker, CosOperatingLoopView, CosProjectContext } from "./types";
import { COS_OPERATING_LOOP_CONTRACT_VERSION, COS_TOP_5_LIMIT } from "./types";
import { presentAttentionJobs } from "./attention-presentation";
import { actionJobAdvancedByCurrentTruth } from "@/lib/continuum/client-memory/project-jobs/attention-evidence";

function lifecycleByProjectFrom(
  projects: ReadonlyMap<string, CosProjectContext>,
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const [projectId, project] of projects) {
    map.set(projectId, project.lifecycleStage ?? null);
  }
  return map;
}

function lifecycleByGmailThreadFrom(
  projects: ReadonlyMap<string, CosProjectContext>,
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const project of projects.values()) {
    const threadId = project.gmailThreadId?.trim() ?? "";
    if (!threadId) continue;
    map.set(threadId, project.lifecycleStage ?? null);
  }
  return map;
}

function lifecycleByAssociatedGmailThreads(
  projects: ReadonlyMap<string, CosProjectContext>,
  associatedThreads: ReadonlyMap<string, readonly string[]>,
): Map<string, string | null> {
  const map = lifecycleByGmailThreadFrom(projects);
  for (const [projectId, threadIds] of associatedThreads) {
    const stage = projects.get(projectId)?.lifecycleStage ?? null;
    for (const threadId of threadIds) {
      if (!map.has(threadId)) map.set(threadId, stage);
    }
  }
  return map;
}

export type ComposeCosOperatingLoopInput = {
  founderCorrections?: readonly import("@/lib/continuum/source-events/types").SourceCommunicationEvent[];
  jobs: readonly ProjectJob[] | null;
  summaries?: readonly ProjectDeskSummary[];
  projects?: ReadonlyMap<string, CosProjectContext>;
  candidates?: readonly ContinuumCandidate[];
  nowIso: string;
  ranker?: ActionableRanker;
  newMutationId?: () => string;
  masterSprint?: CosOperatingLoopView["masterSprint"];
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext>;
  trustedProjectThreads?: ReadonlyMap<string, string>;
  vendorDirectory?: readonly string[];
  evidenceTexts?: readonly string[];
  knownPeople?: readonly TodayKnownPerson[];
  heldJobIds?: ReadonlySet<string>;
};

function deterministicUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][parseInt(hex[16]!, 16) % 4]!;
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function deterministicMutationIds(input: ComposeCosOperatingLoopInput): () => string {
  const seed = JSON.stringify({
    nowIso: input.nowIso,
    jobs: (input.jobs ?? [])
      .map((row) => [row.jobId, row.updatedAt, row.state, row.sourceRef])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    candidates: (input.candidates ?? [])
      .map((row) => [row.candidateId, row.sourceTimestamp, row.candidateState, row.reviewStatus])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    projects: [...(input.projects?.entries() ?? [])]
      .map(([projectId, row]) => [projectId, row.lifecycleStage, row.title])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
  });
  let index = 0;
  return () => deterministicUuid(`continuum-today:${seed}:${index++}`);
}

function clientDisplayName(
  title: string,
  people: readonly { displayName: string; role?: string | null }[],
): string | null {
  const pool = people.filter((person) => {
    if (!isClientPersonLabel(person.displayName)) return false;
    if (person.role === "vendor-contact") return false;
    return true;
  });
  if (pool.length === 0) return null;
  const titleTokens = new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  );
  const matched = pool.filter((person) =>
    person.displayName
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((token) => token.length >= 4 && titleTokens.has(token)),
  );
  if (matched.length === 1) return matched[0]?.displayName ?? null;
  if (pool.length === 1) return pool[0]?.displayName ?? null;
  return null;
}

export function projectContextFromSummaries(
  summaries: readonly ProjectDeskSummary[],
): Map<string, CosProjectContext> {
  const current = new Set(selectOpenProjectWork(summaries).map((row) => row.projectId));
  const map = new Map<string, CosProjectContext>();
  for (const row of summaries) {
    const people = row.people.map((person) => ({
      personId: person.personId,
      displayName: person.displayName,
      role: person.roles?.includes("vendor-contact")
        ? "vendor-contact"
        : person.roles?.[0] ?? null,
      organizationName: person.organizationName ?? null,
    }));
    map.set(row.projectId, {
      projectId: row.projectId,
      title: row.title,
      personName: clientDisplayName(row.title, people),
      people,
      isCurrent: current.has(row.projectId),
      lifecycleStage: row.lifecycleStage,
      specs: row.specs,
      gmailThreadId: row.gmailThreadId ?? null,
    });
  }
  return map;
}

export function composeCosOperatingLoop(
  input: ComposeCosOperatingLoopInput,
): CosOperatingLoopView {
  const ranker = input.ranker ?? DETERMINISTIC_ACTIONABLE_RANKER;
  const newMutationId = input.newMutationId ?? deterministicMutationIds(input);
  const projects =
    input.projects ?? projectContextFromSummaries(input.summaries ?? []);
  const candidates = input.candidates ?? [];

  const masterSprint = input.masterSprint ?? [];
  const lifecycleByProject = lifecycleByProjectFrom(projects);
  const association = projectBySupportedAssociation(
    candidates,
    projects,
    input.threadContext,
    input.trustedProjectThreads,
  );
  const associatedGmailThreads = associatedGmailThreadsByProject(
    association,
    projects,
  );
  const lifecycleByGmailThread = lifecycleByAssociatedGmailThreads(
    projects,
    associatedGmailThreads,
  );
  const founderEmailHashes = collectTodayFounderEmailHashes(input.knownPeople);
  const liveTruth = {
    lifecycleByGmailThread,
    associatedGmailThreadsByProject: associatedGmailThreads,
    threadContext: input.threadContext,
    founderEmailHashes,
    asOfIso: input.nowIso,
    attentionValidUntil: nextAttentionBoundary(input.jobs, new Date(input.nowIso)),
    quietJobs: (input.jobs ?? [])
      .filter(j =>
        j.state === "resolved" ||
        j.state === "cancelled" ||
        j.state === "snoozed" ||
        Boolean(j.deferredUntil && Date.parse(j.deferredUntil) > Date.parse(input.nowIso)),
      )
      .map(j => ({
        jobId: j.jobId,
        projectId: j.projectId,
        sourceRef: j.sourceRef,
        deferredUntil: j.deferredUntil,
        soleProjectJob:
          Boolean(j.projectId) &&
          (input.jobs ?? []).filter(
            other =>
              other.projectId === j.projectId &&
              (other.state === "open" || other.state === "snoozed"),
          ).length === 1,
        reason:
          j.state === "resolved" || j.state === "cancelled"
            ? "terminal" as const
            : "deferred" as const,
      })),
  };

  if (input.jobs == null) {
    return {
      contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
      status: "disconnected",
      heading: COS_DISCONNECTED_HEADING,
      quietDetail: COS_DISCONNECTED_DETAIL,
      top5: [],
      remainingCount: 0,
      brief: [],
      watching: [],
      needsYourDecision: [],
      worthKnowing: [],
      recap: [],
      anomalies: [],
      proposedActions: [],
      masterSprint,
      lifecycleByProject,
      ...liveTruth,
    };
  }

  const actionables = collectCanonicalActionables({
    jobs: input.jobs,
    projects,
    nowIso: input.nowIso,
    heldJobIds: input.heldJobIds,
  });
  const ranked = ranker.rank(actionables, input.nowIso);
  const top = selectTopRanked(ranked, COS_TOP_5_LIMIT);
  const recap = proposeRecapItems({
    jobs: input.jobs,
    candidates,
    projects,
    newMutationId,
  });
  const anomalies = detectAnomalies({
    jobs: input.jobs,
    candidates,
    recapJobIds: recapJobIds(recap),
    nowIso: input.nowIso,
    projects,
  });
  const proposedActions = proposeExplicitActions({
    jobs: input.jobs,
    candidates,
    projects,
    newMutationId,
    nowIso: input.nowIso,
  });
  const top5 = top.map((item) => presentTop5Item(item, input.nowIso, newMutationId()));
  const attention = composeFounderAttentionSurface({
    candidates,
    jobs: input.jobs,
    projects,
    nowIso: input.nowIso,
    top5Ids: new Set(top5.map((item) => item.id)),
    recap,
    proposedActions,
    anomalies,
    threadContext: input.threadContext,
    knownPeople: input.knownPeople,
    vendorDirectory: input.vendorDirectory,
    evidenceTexts: input.evidenceTexts,
  });
  const moderated = composeConciergeBrief({
    founderCorrections: input.founderCorrections,
    candidates,
    jobs: input.jobs,
    projects,
    nowIso: input.nowIso,
    top5,
    proposedActions,
    threadContext: input.threadContext,
    vendorDirectory: input.vendorDirectory,
    evidenceTexts: input.evidenceTexts,
    knownPeople: input.knownPeople,
  });
  const projectionRows = [...moderated.brief, ...moderated.watching]
    .map((item) => ({
      projectId: item.projectId,
      projection: item.briefingPacket?.projection,
      sourceEvents: item.briefingPacket?.sourceEvents,
    }))
    .filter((row): row is {
      projectId: string | null;
      projection: NonNullable<typeof row.projection>;
      sourceEvents: typeof row.sourceEvents;
    } => Boolean(row.projection));
  const projections = projectionRows.map((row) => row.projection);
  const supersededActionJobIds = input.jobs
    .filter((job) => actionJobAdvancedByCurrentTruth(job, projectionRows))
    .map((job) => job.jobId);
  const supersededActionJobIdSet = new Set(supersededActionJobIds);
  const visibleCanonicalQueue = ranked
    .filter((item) => !supersededActionJobIdSet.has(item.id))
    .map((item) => presentTop5Item(item, input.nowIso, newMutationId()));
  const visibleTop5 = visibleCanonicalQueue.slice(0, COS_TOP_5_LIMIT);
  const attentionItems = presentAttentionJobs({
    jobs: input.jobs,
    projects,
    nowIso: input.nowIso,
    projections,
    newMutationId,
  });

  if (visibleTop5.length === 0) {
    return {
      contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
      status: "caught-up",
      heading: COS_CAUGHT_UP_HEADING,
      quietDetail: COS_CAUGHT_UP_DETAIL,
      top5: [],
      remainingCount: 0,
      canonicalQueue: visibleCanonicalQueue,
      brief: moderated.brief,
      watching: moderated.watching,
      needsYourDecision: attention.needsYourDecision,
      worthKnowing: attention.worthKnowing,
      recap,
      anomalies: attention.anomalies,
      proposedActions,
      masterSprint,
      lifecycleByProject,
      ...liveTruth,
      attentionItems,
      supersededActionJobIds,
    };
  }

  return {
    contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
    status: "active",
    heading: COS_ACTIVE_HEADING,
    quietDetail: null,
    top5: visibleTop5,
    remainingCount: Math.max(0, visibleCanonicalQueue.length - visibleTop5.length),
    canonicalQueue: visibleCanonicalQueue,
    brief: moderated.brief,
    watching: moderated.watching,
    needsYourDecision: attention.needsYourDecision,
    worthKnowing: attention.worthKnowing,
    recap,
    anomalies: attention.anomalies,
    proposedActions,
    masterSprint,
    lifecycleByProject,
    ...liveTruth,
    attentionItems,
    supersededActionJobIds,
  };
}

export function replenishTop5(
  input: ComposeCosOperatingLoopInput,
): CosOperatingLoopView {
  return composeCosOperatingLoop(input);
}
