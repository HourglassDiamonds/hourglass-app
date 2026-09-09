/**
 * Pure CoS operating-loop composition.
 * Does not write Open Jobs, Candidates, People, or Lifecycle.
 */

import { randomUUID } from "node:crypto";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import { selectOpenProjectWork } from "@/lib/continuum/client-memory/open-projects/select";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { isStudioOrVendorLabel } from "@/lib/continuum/candidates/founder-attention";
import { collectCanonicalActionables, selectTopRanked } from "./collect";
import { composeFounderAttentionSurface } from "./founder-attention";
import { composeConciergeBrief } from "./moderator";
import { detectAnomalies, proposeRecapItems, recapJobIds } from "./reconcile";
import { DETERMINISTIC_ACTIONABLE_RANKER } from "./rank";
import { proposeExplicitActions } from "./propose-actions";
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

export type ComposeCosOperatingLoopInput = {
  jobs: readonly ProjectJob[] | null;
  summaries?: readonly ProjectDeskSummary[];
  projects?: ReadonlyMap<string, CosProjectContext>;
  candidates?: readonly ContinuumCandidate[];
  nowIso: string;
  ranker?: ActionableRanker;
  newMutationId?: () => string;
};

function clientDisplayName(
  title: string,
  people: readonly { displayName: string; role?: string | null }[],
): string | null {
  const pool = people.filter((person) => {
    if (isStudioOrVendorLabel(person.displayName)) return false;
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
    map.set(row.projectId, {
      projectId: row.projectId,
      title: row.title,
      personName: clientDisplayName(row.title, row.people),
      people: row.people,
      isCurrent: current.has(row.projectId),
      lifecycleStage: row.lifecycleStage,
      specs: row.specs,
    });
  }
  return map;
}

export function composeCosOperatingLoop(
  input: ComposeCosOperatingLoopInput,
): CosOperatingLoopView {
  const ranker = input.ranker ?? DETERMINISTIC_ACTIONABLE_RANKER;
  const newMutationId = input.newMutationId ?? (() => randomUUID());
  const projects =
    input.projects ?? projectContextFromSummaries(input.summaries ?? []);
  const candidates = input.candidates ?? [];

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
    };
  }

  const actionables = collectCanonicalActionables({
    jobs: input.jobs,
    projects,
    nowIso: input.nowIso,
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
  });
  const moderated = composeConciergeBrief({
    candidates,
    jobs: input.jobs,
    projects,
    nowIso: input.nowIso,
    top5,
    proposedActions,
  });

  if (top.length === 0) {
    return {
      contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
      status: "caught-up",
      heading: COS_CAUGHT_UP_HEADING,
      quietDetail: COS_CAUGHT_UP_DETAIL,
      top5: [],
      remainingCount: 0,
      brief: moderated.brief,
      watching: moderated.watching,
      needsYourDecision: attention.needsYourDecision,
      worthKnowing: attention.worthKnowing,
      recap,
      anomalies: attention.anomalies,
      proposedActions,
    };
  }

  return {
    contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
    status: "active",
    heading: COS_ACTIVE_HEADING,
    quietDetail: null,
    top5,
    remainingCount: Math.max(0, ranked.length - top.length),
    brief: moderated.brief,
    watching: moderated.watching,
    needsYourDecision: attention.needsYourDecision,
    worthKnowing: attention.worthKnowing,
    recap,
    anomalies: attention.anomalies,
    proposedActions,
  };
}

export function replenishTop5(
  input: ComposeCosOperatingLoopInput,
): CosOperatingLoopView {
  return composeCosOperatingLoop(input);
}
