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
  COS_DECISION_TARGET,
  COS_SIGNAL_TARGET,
  CRITICAL_SCORE,
  DECISION_SCORE,
  candidateProjectId,
  candidateText,
  classifyCandidateAttention,
  commitmentIsComplete,
  groupingKey,
  hasCommercialPayload,
  hasRule,
  isApproval,
  isNewProject,
  isPaymentStateChange,
  isSubordinateType,
  payloadOf,
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

function synthesizeGroup(
  rows: readonly ContinuumCandidate[],
  judgments: ReadonlyMap<string, FounderAttentionJudgment>,
  ctx: FounderAttentionContext,
): { headline: string; detail: string | null; lane: "decision" | "signal"; score: number } {
  const ranked = [...rows].sort(
    (a, b) => (judgments.get(b.candidateId)?.score ?? 0) - (judgments.get(a.candidateId)?.score ?? 0),
  );
  const primary = ranked[0];
  const score = primary ? (judgments.get(primary.candidateId)?.score ?? 0) : 0;
  const person = projectLabel(candidateProjectId(primary ?? rows[0]!), ctx.projects).personName;
  const name = person || "the client";
  const specs = specCount(rows);
  const specDetail = specs > 0 ? `${specs} new spec${specs === 1 ? "" : "s"} captured.` : null;

  if (rows.some(isNewProject)) {
    return {
      headline: "New Project confirmation.",
      detail: specDetail,
      lane: "decision",
      score: Math.max(score, 100),
    };
  }
  if (rows.some(isPaymentStateChange)) {
    return {
      headline: `${name} payment received.`,
      detail: "This may change Project state.",
      lane: "decision",
      score: Math.max(score, 90),
    };
  }
  if (rows.some(isApproval)) {
    return {
      headline: `${name} approved the current design.`,
      detail: specDetail,
      lane: "decision",
      score: Math.max(score, 95),
    };
  }
  if (rows.some((row) => row.candidateState === "conflict" || specConflicts(row))) {
    return {
      headline: "Spec conflict needs a decision.",
      detail: specDetail,
      lane: "decision",
      score: Math.max(score, 90),
    };
  }

  const clientAnswer = rows.some((row) => {
    const payload = payloadOf(row);
    if (payload.kind === "note") return hasCommercialPayload(row);
    if (payload.kind === "project_context" && payload.topic === "waiting_on_client") {
      return false;
    }
    if (payload.kind === "project_context" && payload.topic !== "new_project") {
      return hasCommercialPayload(row);
    }
    return false;
  });
  if (clientAnswer) {
    return {
      headline: `Your turn: ${name} answered the design question.`,
      detail: specDetail,
      lane: "decision",
      score: Math.max(score, 85),
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
    };
  }

  if (specs > 0) {
    return {
      headline: `${specs} new spec${specs === 1 ? "" : "s"} captured.`,
      detail: null,
      lane: "signal",
      score: Math.max(score, 45),
    };
  }

  return {
    headline: candidateText(primary ?? rows[0]!),
    detail: specDetail,
    lane: score >= DECISION_SCORE ? "decision" : "signal",
    score,
  };
}

function isPrincipalRow(
  row: ContinuumCandidate,
  judgment: FounderAttentionJudgment | undefined,
): boolean {
  if (!judgment || judgment.lane === "background") return false;
  if (isSubordinateType(row)) return false;
  return true;
}

function takePrioritized<T extends { score: number }>(
  items: readonly T[],
  target: number,
  critical: number,
): T[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const kept: T[] = [];
  for (const item of sorted) {
    if (kept.length < target || item.score >= critical) kept.push(item);
  }
  return kept;
}

function stripScore<T extends { score: number }>(item: T): Omit<T, "score"> {
  const { score, ...rest } = item;
  return score >= 0 ? rest : rest;
}

function toAttentionItem(input: {
  id: string;
  rows: readonly ContinuumCandidate[];
  judgments: ReadonlyMap<string, FounderAttentionJudgment>;
  ctx: FounderAttentionContext;
  proposedActions: readonly CosProposedAction[];
}): CosFounderAttentionItem & { score: number } {
  const synthesis = synthesizeGroup(input.rows, input.judgments, input.ctx);
  const primary = input.rows[0]!;
  const projectId = candidateProjectId(primary);
  const labels = projectLabel(projectId, input.ctx.projects);
  const proposed =
    input.proposedActions.find((row) =>
      input.rows.some((candidate) => candidate.candidateId === row.candidateId),
    ) ?? null;
  return {
    id: input.id,
    lane: synthesis.lane,
    title: displayTitle(labels.personName, labels.title),
    headline: synthesis.headline,
    detail: synthesis.detail,
    projectId,
    projectTitle: projectId ? labels.title : null,
    sourceLabel: sourceLabelFor(primary),
    sourceHref: sourceHrefFor(primary),
    candidateIds: input.rows.map((row) => row.candidateId),
    recap: null,
    proposedAction: proposed,
    score: synthesis.score,
  };
}

export function selectConsequentialAnomalies(input: {
  anomalies: readonly CosAnomalyItem[];
  top5Ids: ReadonlySet<string>;
}): CosAnomalyItem[] {
  return input.anomalies.filter((row) => {
    if (row.kind === "contradicts-completion") return true;
    if (row.kind === "overdue-no-action" || row.kind === "stalled-founder") {
      return Boolean(row.jobId) && !input.top5Ids.has(row.jobId!);
    }
    return false;
  });
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
  const ctx: FounderAttentionContext = {
    jobs: input.jobs,
    projects: input.projects,
    nowIso: input.nowIso,
    top5Ids: input.top5Ids,
  };
  const judgments = new Map<string, FounderAttentionJudgment>();
  const groups = new Map<string, ContinuumCandidate[]>();

  for (const row of input.candidates) {
    const judgment = classifyCandidateAttention(row, ctx);
    judgments.set(row.candidateId, judgment);
    if (judgment.lane === "background") continue;
    const key = groupingKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const rolled: Array<CosFounderAttentionItem & { score: number }> = [];

  for (const [key, rows] of groups) {
    const principals = rows.filter((row) => isPrincipalRow(row, judgments.get(row.candidateId)));
    const subordinates = rows.filter((row) => !principals.includes(row));
    if (principals.length <= 1) {
      rolled.push(
        toAttentionItem({
          id: `attention:${key}`,
          rows,
          judgments,
          ctx,
          proposedActions: input.proposedActions,
        }),
      );
      continue;
    }
    const rankedPrincipals = [...principals].sort(
      (a, b) => (judgments.get(b.candidateId)?.score ?? 0) - (judgments.get(a.candidateId)?.score ?? 0),
    );
    rankedPrincipals.forEach((principal, index) => {
      const attached = index === 0 ? [principal, ...subordinates] : [principal];
      rolled.push(
        toAttentionItem({
          id: `attention:${key}:${principal.candidateId}`,
          rows: attached,
          judgments,
          ctx,
          proposedActions: input.proposedActions,
        }),
      );
    });
  }

  const recapItems: Array<CosFounderAttentionItem & { score: number }> = input.recap.map(
    (row) => {
      const labels = projectLabel(row.projectId, input.projects);
      return {
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
      };
    },
  );

  const decisions = takePrioritized(
    [...recapItems, ...rolled.filter((row) => row.lane === "decision")],
    COS_DECISION_TARGET,
    CRITICAL_SCORE,
  );
  const decisionKeys = new Set(decisions.map((row) => row.id));
  const signals = takePrioritized(
    rolled.filter((row) => row.lane === "signal" && !decisionKeys.has(row.id)),
    COS_SIGNAL_TARGET,
    CRITICAL_SCORE,
  );

  return {
    needsYourDecision: decisions.map(stripScore),
    worthKnowing: signals.map(stripScore),
    anomalies: selectConsequentialAnomalies({
      anomalies: input.anomalies,
      top5Ids: input.top5Ids,
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
