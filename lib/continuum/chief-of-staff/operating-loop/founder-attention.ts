/**
 * CoS founder-attention roll-up over classified Candidates.
 * Presentation only. Classification lives in candidates/founder-attention.
 * Does not delete Candidates, write Open Jobs, or resolve work.
 *
 * Model: cos-founder-attention-v1
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import {
  COS_ANOMALY_TARGET,
  COS_DECISION_TARGET,
  COS_SIGNAL_TARGET,
  DECISION_SCORE,
  candidateProjectId,
  candidateText,
  classifyCandidateAttention,
  commitmentIsComplete,
  groupingKey,
  hasCommercialPayload,
  hasRule,
  isApproval,
  isClientDesignAnswer,
  isExplicitNewProject,
  isPaymentStateChange,
  payloadOf,
  projectByThreadFromCandidates,
  specConflicts,
  waitingOnFounder,
  type FounderAttentionContext as ClassifyContext,
  type FounderAttentionJudgment,
} from "@/lib/continuum/candidates/founder-attention";
import { sourceHrefFor, sourceLabelFor } from "./evidence";
import type {
  CosAnomalyItem,
  CosFounderAttentionItem,
  CosProjectContext,
  CosProposedAction,
  CosRecapItem,
} from "./types";

export {
  COS_ANOMALY_TARGET,
  COS_DECISION_TARGET,
  COS_ORDINARY_VISIBLE_TARGET,
  COS_SIGNAL_TARGET,
  FOUNDER_ATTENTION_FACTOR_IDS,
  FOUNDER_ATTENTION_LANES,
  FOUNDER_ATTENTION_MODEL_ID,
  classifyCandidateAttention,
  isFounderAttentionWorthy,
} from "@/lib/continuum/candidates/founder-attention";
export type {
  FounderAttentionFactorId,
  FounderAttentionJudgment,
  FounderAttentionLane,
} from "@/lib/continuum/candidates/founder-attention";

export type FounderAttentionContext = ClassifyContext & {
  projects: ReadonlyMap<string, CosProjectContext>;
};

function projectLabel(
  projectId: string | null,
  projects: ReadonlyMap<string, CosProjectContext>,
): { title: string; personName: string | null } {
  if (!projectId) return { title: "Hourglass", personName: null };
  const project = projects.get(projectId);
  return {
    title: project?.title ?? "Project",
    personName: project?.personName ?? null,
  };
}

function displayTitle(personName: string | null, projectTitle: string): string {
  if (personName && projectTitle && !projectTitle.startsWith(personName)) {
    return `${personName} — ${projectTitle}`;
  }
  return personName || projectTitle;
}

function specCount(rows: readonly ContinuumCandidate[]): number {
  return rows.filter((row) => row.candidateType === "structured_spec").length;
}

function specDetailFor(rows: readonly ContinuumCandidate[]): string | null {
  const specs = specCount(rows);
  if (specs <= 0) return null;
  return `${specs} spec${specs === 1 ? "" : "s"} captured.`;
}

function visibleLane(judgment: FounderAttentionJudgment | undefined): boolean {
  return judgment?.lane === "decision" || judgment?.lane === "signal";
}

function synthesizeGroup(
  visible: readonly ContinuumCandidate[],
  evidence: readonly ContinuumCandidate[],
  judgments: ReadonlyMap<string, FounderAttentionJudgment>,
  ctx: FounderAttentionContext,
): {
  headline: string;
  detail: string | null;
  lane: "decision" | "signal";
  score: number;
  criticalOverflow: boolean;
} {
  const ranked = [...visible].sort(
    (a, b) => (judgments.get(b.candidateId)?.score ?? 0) - (judgments.get(a.candidateId)?.score ?? 0),
  );
  const primary = ranked[0];
  const score = primary ? (judgments.get(primary.candidateId)?.score ?? 0) : 0;
  const projectId = candidateProjectId(primary ?? evidence[0]!);
  const person = projectLabel(projectId, ctx.projects).personName;
  const name = person || "the client";
  const specDetail = specDetailFor(evidence);

  if (visible.some(isPaymentStateChange)) {
    return {
      headline: `${name} payment received.`,
      detail: "This may change Project state.",
      lane: "signal",
      score: Math.max(score, 90),
      criticalOverflow: false,
    };
  }
  if (visible.some((row) => row.candidateState === "conflict" || specConflicts(row))) {
    return {
      headline: "Spec conflict needs a decision.",
      detail: specDetail,
      lane: "decision",
      score: Math.max(score, 90),
      criticalOverflow: true,
    };
  }
  if (visible.some(isExplicitNewProject) && !projectId) {
    return {
      headline: "New Project confirmation.",
      detail: specDetail,
      lane: "decision",
      score: Math.max(score, 70),
      criticalOverflow: false,
    };
  }
  if (visible.some(isClientDesignAnswer)) {
    return {
      headline: `Your turn: ${name} answered the design question.`,
      detail: specDetail,
      lane: "decision",
      score: Math.max(score, 85),
      criticalOverflow: false,
    };
  }

  const commitment = ranked.find(
    (row) =>
      (row.candidateType === "open_job" || row.candidateType === "follow_up") &&
      commitmentIsComplete(row),
  );
  if (commitment) {
    const payload = payloadOf(commitment);
    const subject =
      payload.kind === "open_job"
        ? payload.subject
        : payload.kind === "follow_up"
          ? payload.text
          : candidateText(commitment);
    const founderOwned = waitingOnFounder(commitment) || hasRule(commitment, "explicit_founder_commitment");
    return {
      headline: subject,
      detail: specDetail,
      lane: founderOwned ? "decision" : "signal",
      score: Math.max(score, founderOwned ? 80 : 50),
      criticalOverflow: false,
    };
  }

  if (visible.some(isApproval)) {
    return {
      headline: `${name} approved the current design.`,
      detail: specDetail,
      lane: "signal",
      score: Math.max(score, 70),
      criticalOverflow: false,
    };
  }

  return {
    headline: candidateText(primary ?? evidence[0]!),
    detail: specDetail,
    lane: score >= DECISION_SCORE ? "decision" : "signal",
    score,
    criticalOverflow: false,
  };
}

type RankedAttention = CosFounderAttentionItem & {
  score: number;
  criticalOverflow: boolean;
};

function takePrioritized(items: readonly RankedAttention[], target: number): RankedAttention[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const kept: RankedAttention[] = [];
  for (const item of sorted) {
    if (kept.length < target) {
      kept.push(item);
      continue;
    }
    if (!item.criticalOverflow) continue;
    if (item.projectId && kept.some((row) => row.projectId === item.projectId)) continue;
    kept.push(item);
  }
  return kept;
}

function stripRank(item: RankedAttention): CosFounderAttentionItem {
  return {
    id: item.id,
    lane: item.lane,
    title: item.title,
    headline: item.headline,
    detail: item.detail,
    projectId: item.projectId,
    projectTitle: item.projectTitle,
    sourceLabel: item.sourceLabel,
    sourceHref: item.sourceHref,
    candidateIds: item.candidateIds,
    recap: item.recap,
    proposedAction: item.proposedAction,
  };
}

function representedByTop5(
  item: Pick<CosFounderAttentionItem, "projectId" | "headline" | "lane">,
  ctx: FounderAttentionContext,
  conflict: boolean,
  distinctDecision: boolean,
): boolean {
  if (!item.projectId || conflict || distinctDecision) return false;
  if (item.lane !== "decision" && item.lane !== "signal") return false;
  const jobs = ctx.jobs.filter(
    (job) => job.projectId === item.projectId && ctx.top5Ids?.has(job.jobId),
  );
  if (jobs.length === 0) return false;
  const headline = new Set(
    item.headline
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4),
  );
  return jobs.some((job) => {
    const jobTokens = job.subject
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4);
    const overlap = jobTokens.filter((token) => headline.has(token));
    return overlap.length >= 2 || jobTokens.some((token) => headline.has(token) && token.length >= 5);
  });
}

function toAttentionItem(input: {
  id: string;
  visible: readonly ContinuumCandidate[];
  evidence: readonly ContinuumCandidate[];
  judgments: ReadonlyMap<string, FounderAttentionJudgment>;
  ctx: FounderAttentionContext;
  proposedActions: readonly CosProposedAction[];
}): RankedAttention {
  const synthesis = synthesizeGroup(input.visible, input.evidence, input.judgments, input.ctx);
  const primary = input.visible[0] ?? input.evidence[0]!;
  const projectId =
    candidateProjectId(primary) ??
    input.evidence.map(candidateProjectId).find((id): id is string => Boolean(id)) ??
    null;
  const labels = projectLabel(projectId, input.ctx.projects);
  const proposed =
    input.proposedActions.find((row) =>
      input.evidence.some((candidate) => candidate.candidateId === row.candidateId),
    ) ?? null;
  const conflict = input.visible.some((row) => row.candidateState === "conflict" || specConflicts(row));
  const distinctDecision =
    conflict ||
    input.visible.some(isClientDesignAnswer) ||
    input.visible.some(isPaymentStateChange) ||
    input.visible.some(isExplicitNewProject);
  const item = {
    id: input.id,
    lane: synthesis.lane,
    title: displayTitle(labels.personName, labels.title),
    headline: synthesis.headline,
    detail: synthesis.detail,
    projectId,
    projectTitle: projectId ? labels.title : null,
    sourceLabel: sourceLabelFor(primary),
    sourceHref: sourceHrefFor(primary),
    candidateIds: input.evidence.map((row) => row.candidateId),
    recap: null,
    proposedAction: proposed,
    score: synthesis.score,
    criticalOverflow: synthesis.criticalOverflow,
  };
  if (representedByTop5(item, input.ctx, conflict, distinctDecision)) {
    return { ...item, lane: "signal", score: 0, criticalOverflow: false };
  }
  return item;
}

export function selectConsequentialAnomalies(input: {
  anomalies: readonly CosAnomalyItem[];
  top5Ids: ReadonlySet<string>;
  decisionProjectIds?: ReadonlySet<string>;
}): CosAnomalyItem[] {
  const ranked = input.anomalies
    .filter((row) => {
      if (row.kind === "contradicts-completion") {
        if (row.projectId && input.decisionProjectIds?.has(row.projectId)) return false;
        return true;
      }
      if (row.kind === "overdue-no-action" || row.kind === "stalled-founder") {
        if (row.projectId && input.decisionProjectIds?.has(row.projectId)) return false;
        return Boolean(row.jobId) && !input.top5Ids.has(row.jobId!);
      }
      return false;
    })
    .map((row, index) => ({
      row,
      score: row.kind === "contradicts-completion" ? 90 - index : 40 - index,
    }))
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, COS_ANOMALY_TARGET).map((item) => item.row);
}

export function composeFounderAttentionSurface(input: {
  candidates: readonly ContinuumCandidate[];
  jobs: readonly ProjectJob[];
  projects: ReadonlyMap<string, CosProjectContext>;
  nowIso: string;
  top5Ids: ReadonlySet<string>;
  recap: readonly CosRecapItem[];
  proposedActions: readonly CosProposedAction[];
  anomalies: readonly CosAnomalyItem[];
}): {
  needsYourDecision: CosFounderAttentionItem[];
  worthKnowing: CosFounderAttentionItem[];
  anomalies: CosAnomalyItem[];
} {
  const currentProjectIds = new Set(
    [...input.projects.values()].filter((row) => row.isCurrent).map((row) => row.projectId),
  );
  const ctx: FounderAttentionContext = {
    jobs: input.jobs,
    projects: input.projects,
    nowIso: input.nowIso,
    top5Ids: input.top5Ids,
    currentProjectIds,
  };
  const projectByThread = projectByThreadFromCandidates(input.candidates);
  const judgments = new Map<string, FounderAttentionJudgment>();
  const groups = new Map<string, ContinuumCandidate[]>();

  for (const row of input.candidates) {
    const judgment = classifyCandidateAttention(row, ctx);
    judgments.set(row.candidateId, judgment);
    if (row.candidateState === "superseded" || row.reviewStatus === "discarded") continue;
    const key = groupingKey(row, projectByThread);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const rolled: RankedAttention[] = [];

  for (const [key, rows] of groups) {
    const visible = rows.filter((row) => visibleLane(judgments.get(row.candidateId)));
    if (visible.length === 0) continue;
    const unscopedGmail =
      visible.every(
        (row) =>
          row.sourceSystem === "gmail" &&
          !candidateProjectId(row) &&
          (row.candidateType === "open_job" || row.candidateType === "follow_up"),
      ) &&
      !visible.some(isExplicitNewProject) &&
      !visible.some(isPaymentStateChange) &&
      !visible.some(isClientDesignAnswer) &&
      !visible.some((row) => row.candidateState === "conflict" || specConflicts(row));
    if (unscopedGmail) continue;
    if (
      !visible.some(hasCommercialPayload) &&
      !visible.some(isPaymentStateChange) &&
      !visible.some((row) => row.candidateState === "conflict" || specConflicts(row))
    ) {
      continue;
    }
    const item = toAttentionItem({
      id: `attention:${key}`,
      visible,
      evidence: rows,
      judgments,
      ctx,
      proposedActions: input.proposedActions,
    });
    if (item.score === 0 && item.lane === "signal") continue;
    rolled.push(item);
  }

  const recapItems: RankedAttention[] = input.recap.flatMap((row) => {
    const labels = projectLabel(row.projectId, input.projects);
    return [
      {
        id: `attention:${row.id}`,
        lane: "decision" as const,
        title: displayTitle(labels.personName, labels.title),
        headline: row.question,
        detail: null,
        projectId: row.projectId,
        projectTitle: row.projectTitle,
        sourceLabel: row.sourceLabel,
        sourceHref: row.sourceHref,
        candidateIds: [],
        recap: row,
        proposedAction: null,
        score: row.kind === "likely-complete" ? 92 : 80,
        criticalOverflow: false,
      },
    ];
  });

  const decisions = takePrioritized(
    [...recapItems, ...rolled.filter((row) => row.lane === "decision")],
    COS_DECISION_TARGET,
  );
  const decisionKeys = new Set(decisions.map((row) => row.id));
  const decisionProjectIds = new Set(
    decisions.flatMap((row) => (row.projectId ? [row.projectId] : [])),
  );
  const signals = takePrioritized(
    rolled.filter((row) => row.lane === "signal" && !decisionKeys.has(row.id)),
    COS_SIGNAL_TARGET,
  );

  return {
    needsYourDecision: decisions.map(stripRank),
    worthKnowing: signals.map(stripRank),
    anomalies: selectConsequentialAnomalies({
      anomalies: input.anomalies,
      top5Ids: input.top5Ids,
      decisionProjectIds,
    }),
  };
}

export function visibleFounderAttentionCount(view: {
  top5: readonly unknown[];
  needsYourDecision: readonly unknown[];
  worthKnowing: readonly unknown[];
  anomalies: readonly unknown[];
}): number {
  return (
    view.top5.length +
    view.needsYourDecision.length +
    view.worthKnowing.length +
    view.anomalies.length
  );
}
