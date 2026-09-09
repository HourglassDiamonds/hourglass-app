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
  sourceThreadId,
  waitingOnFounder,
  confirmedPersonId,
  isActionableSpecConflict,
  isStudioOrVendorLabel,
  type FounderAttentionContext as ClassifyContext,
  type FounderAttentionJudgment,
} from "@/lib/continuum/candidates/founder-attention";
import { sourceHrefFor, sourceLabelFor } from "./evidence";
import type {
  CosAnomalyItem,
  CosFounderAttentionItem,
  CosProjectContext,
  CosProjectPerson,
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

const UNASSIGNED_TITLE = "Unassigned";

const SPEC_FIELD_LABELS: Record<string, string> = {
  cad_job_number: "CAD job number",
  order_number: "order number",
  finger_size: "finger size",
  metal: "metal",
  center_stone: "center stone",
  diamond_supply_notes: "diamond supply",
};

function nameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function titlesOverlap(personName: string, projectTitle: string): boolean {
  const person = new Set(nameTokens(personName));
  const title = new Set(nameTokens(projectTitle));
  if (person.size === 0 || title.size === 0) return false;
  return [...person].some((token) => title.has(token));
}

function pickClientPerson(
  project: CosProjectContext | null,
): CosProjectPerson | null {
  if (!project) return null;
  const pool = (project.people ?? []).filter((person) => {
    if (isStudioOrVendorLabel(person.displayName)) return false;
    if (person.role === "vendor-contact") return false;
    return true;
  });
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0] ?? null;
  const title = new Set(nameTokens(project.title));
  const matched = pool.filter((person) =>
    nameTokens(person.displayName).some((token) => title.has(token)),
  );
  if (matched.length === 1) return matched[0] ?? null;
  return null;
}

function displayTitle(personName: string | null, projectTitle: string | null): string {
  const person = personName?.trim() || null;
  const project = projectTitle?.trim() || null;
  if (person && isStudioOrVendorLabel(person)) {
    return project && !isStudioOrVendorLabel(project) ? project : UNASSIGNED_TITLE;
  }
  if (project && isStudioOrVendorLabel(project)) {
    return person ?? UNASSIGNED_TITLE;
  }
  if (person && project) {
    if (project.startsWith(person) || titlesOverlap(person, project)) return project;
    return `${person} — ${project}`;
  }
  return person || project || UNASSIGNED_TITLE;
}

function projectBySupportedAssociation(
  rows: readonly ContinuumCandidate[],
  projects: ReadonlyMap<string, CosProjectContext>,
): Map<string, string> {
  const map = projectByThreadFromCandidates(rows);
  const personToProjects = new Map<string, Set<string>>();
  for (const project of projects.values()) {
    for (const person of project.people ?? []) {
      if (isStudioOrVendorLabel(person.displayName)) continue;
      const set = personToProjects.get(person.personId) ?? new Set();
      set.add(project.projectId);
      personToProjects.set(person.personId, set);
    }
  }
  const uniquePersonProject = new Map<string, string>();
  for (const [personId, ids] of personToProjects) {
    if (ids.size === 1) uniquePersonProject.set(personId, [...ids][0]!);
  }
  const threadPersons = new Map<string, Set<string>>();
  for (const row of rows) {
    const threadId = sourceThreadId(row);
    const personId = confirmedPersonId(row);
    if (!threadId || !personId) continue;
    const set = threadPersons.get(threadId) ?? new Set();
    set.add(personId);
    threadPersons.set(threadId, set);
  }
  for (const [threadId, persons] of threadPersons) {
    if (map.has(threadId)) continue;
    if (persons.size !== 1) continue;
    const projectId = uniquePersonProject.get([...persons][0]!);
    if (projectId) map.set(threadId, projectId);
  }
  return map;
}

function personNameById(
  personId: string,
  projects: ReadonlyMap<string, CosProjectContext>,
): string | null {
  for (const project of projects.values()) {
    const match = project.people?.find((row) => row.personId === personId);
    if (match && !isStudioOrVendorLabel(match.displayName)) return match.displayName;
  }
  return null;
}

function resolveAttribution(
  evidence: readonly ContinuumCandidate[],
  projectId: string | null,
  projects: ReadonlyMap<string, CosProjectContext>,
): {
  projectId: string | null;
  projectTitle: string | null;
  personName: string | null;
  title: string;
} {
  const project = projectId ? (projects.get(projectId) ?? null) : null;
  const client = pickClientPerson(project);
  let personName = client?.displayName ?? null;
  if (!personName) {
    const personIds = [
      ...new Set(evidence.map(confirmedPersonId).filter((id): id is string => Boolean(id))),
    ];
    if (personIds.length === 1) {
      personName = personNameById(personIds[0]!, projects);
    }
  }
  if (personName && isStudioOrVendorLabel(personName)) personName = null;
  const projectTitle = project?.title ?? (projectId ? "Project" : null);
  return {
    projectId,
    projectTitle,
    personName,
    title: displayTitle(personName, projectTitle),
  };
}

function conflictHeadline(
  rows: readonly ContinuumCandidate[],
  ctx: FounderAttentionContext,
): { headline: string; detail: string | null } {
  const actionable = rows.filter((row) => isActionableSpecConflict(row, ctx));
  const fields = new Map<string, { proposed: string; canonical: string | null }>();
  for (const row of actionable) {
    const payload = payloadOf(row);
    if (payload.kind !== "structured_spec") continue;
    const projectId = candidateProjectId(row);
    const live = projectId
      ? ctx.specByProject?.get(projectId)?.get(payload.fieldName) ?? null
      : null;
    fields.set(payload.fieldName, {
      proposed: payload.proposedValue,
      canonical: live ?? payload.currentValue,
    });
  }
  const production = actionable.some((row) => {
    const projectId = candidateProjectId(row);
    const stage = projectId ? ctx.lifecycleByProject?.get(projectId) : null;
    return stage === "production" || stage === "in_production";
  });
  const prefix = production ? "Production spec conflict" : "Spec conflict";
  if (fields.size === 1) {
    const [fieldName, values] = [...fields.entries()][0]!;
    const label = SPEC_FIELD_LABELS[fieldName] ?? fieldName.replaceAll("_", " ");
    if (values.canonical && values.proposed) {
      return {
        headline: `${prefix}: ${label} differs between approved ${values.canonical} and latest evidence ${values.proposed}.`,
        detail: null,
      };
    }
    return {
      headline: `${prefix}: ${label} differs between approved state and latest vendor evidence.`,
      detail: null,
    };
  }
  if (fields.size > 1) {
    const labels = [...fields.keys()].map(
      (field) => SPEC_FIELD_LABELS[field] ?? field.replaceAll("_", " "),
    );
    return {
      headline: `${prefix}: ${labels.join(", ")} differ from the approved Project spec.`,
      detail: null,
    };
  }
  return { headline: `${prefix} needs a decision.`, detail: null };
}

function visibleLane(judgment: FounderAttentionJudgment | undefined): boolean {
  return judgment?.lane === "decision" || judgment?.lane === "signal";
}

function synthesizeGroup(
  visible: readonly ContinuumCandidate[],
  evidence: readonly ContinuumCandidate[],
  judgments: ReadonlyMap<string, FounderAttentionJudgment>,
  ctx: FounderAttentionContext,
  attribution: { personName: string | null; projectId: string | null },
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
  const name = attribution.personName || "the client";

  if (visible.some(isPaymentStateChange)) {
    return {
      headline: `${name} payment received.`,
      detail: "This may change Project state.",
      lane: "signal",
      score: Math.max(score, 90),
      criticalOverflow: false,
    };
  }
  if (visible.some((row) => isActionableSpecConflict(row, ctx))) {
    const conflict = conflictHeadline(visible, ctx);
    return {
      headline: conflict.headline,
      detail: conflict.detail,
      lane: "decision",
      score: Math.max(score, 90),
      criticalOverflow: true,
    };
  }
  if (visible.some(isExplicitNewProject) && !attribution.projectId) {
    return {
      headline: "New Project confirmation.",
      detail: null,
      lane: "decision",
      score: Math.max(score, 70),
      criticalOverflow: false,
    };
  }
  if (visible.some(isClientDesignAnswer)) {
    return {
      headline: `Your turn: ${name} answered the design question.`,
      detail: null,
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
      detail: null,
      lane: founderOwned ? "decision" : "signal",
      score: Math.max(score, founderOwned ? 80 : 50),
      criticalOverflow: false,
    };
  }

  if (visible.some(isApproval)) {
    return {
      headline: `${name} approved the current design.`,
      detail: null,
      lane: "signal",
      score: Math.max(score, 70),
      criticalOverflow: false,
    };
  }

  return {
    headline: candidateText(primary ?? evidence[0]!),
    detail: null,
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
  const primary = input.visible[0] ?? input.evidence[0]!;
  const groupedProjectId = input.id.startsWith("attention:project:")
    ? input.id.slice("attention:project:".length)
    : null;
  const projectId =
    groupedProjectId ??
    candidateProjectId(primary) ??
    input.evidence.map(candidateProjectId).find((id): id is string => Boolean(id)) ??
    null;
  const attribution = resolveAttribution(input.evidence, projectId, input.ctx.projects);
  const synthesis = synthesizeGroup(input.visible, input.evidence, input.judgments, input.ctx, {
    personName: attribution.personName,
    projectId: attribution.projectId,
  });
  const proposed =
    input.proposedActions.find((row) =>
      input.evidence.some((candidate) => candidate.candidateId === row.candidateId),
    ) ?? null;
  const conflict = input.visible.some((row) => isActionableSpecConflict(row, input.ctx));
  const distinctDecision =
    conflict ||
    input.visible.some(isClientDesignAnswer) ||
    input.visible.some(isPaymentStateChange) ||
    input.visible.some(isExplicitNewProject);
  const item = {
    id: input.id,
    lane: synthesis.lane,
    title: attribution.title,
    headline: synthesis.headline,
    detail: synthesis.detail,
    projectId: attribution.projectId,
    projectTitle: attribution.projectTitle,
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
  const specByProject = new Map<string, ReadonlyMap<string, string>>();
  const lifecycleByProject = new Map<string, string | null>();
  for (const [projectId, project] of input.projects) {
    if (project.specs && project.specs.length > 0) {
      specByProject.set(
        projectId,
        new Map(project.specs.map((row) => [row.fieldName, row.value])),
      );
    }
    lifecycleByProject.set(projectId, project.lifecycleStage ?? null);
  }
  const ctx: FounderAttentionContext = {
    jobs: input.jobs,
    projects: input.projects,
    nowIso: input.nowIso,
    top5Ids: input.top5Ids,
    currentProjectIds,
    specByProject,
    lifecycleByProject,
  };
  const projectByAssociation = projectBySupportedAssociation(input.candidates, input.projects);
  const judgments = new Map<string, FounderAttentionJudgment>();
  const groups = new Map<string, ContinuumCandidate[]>();

  for (const row of input.candidates) {
    const judgment = classifyCandidateAttention(row, ctx);
    judgments.set(row.candidateId, judgment);
    if (row.candidateState === "superseded" || row.reviewStatus === "discarded") continue;
    const key = groupingKey(row, projectByAssociation);
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
      !visible.some((row) => isActionableSpecConflict(row, ctx));
    if (unscopedGmail) continue;
    if (
      !visible.some(hasCommercialPayload) &&
      !visible.some(isPaymentStateChange) &&
      !visible.some((row) => isActionableSpecConflict(row, ctx))
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
    const attribution = resolveAttribution([], row.projectId, input.projects);
    return [
      {
        id: `attention:${row.id}`,
        lane: "decision" as const,
        title: attribution.title,
        headline: row.question,
        detail: null,
        projectId: row.projectId,
        projectTitle: attribution.projectTitle,
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
