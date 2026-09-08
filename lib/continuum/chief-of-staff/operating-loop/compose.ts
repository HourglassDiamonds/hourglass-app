/**
 * Pure CoS operating-loop composition.
 * Does not write Open Jobs, Candidates, People, or Lifecycle.
 */

import { randomUUID } from "node:crypto";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import { selectOpenProjectWork } from "@/lib/continuum/client-memory/open-projects/select";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { collectCanonicalActionables, selectTopRanked } from "./collect";
import { detectAnomalies, proposeRecapItems, recapJobIds } from "./reconcile";
import { DETERMINISTIC_ACTIONABLE_RANKER } from "./rank";
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

export function projectContextFromSummaries(
  summaries: readonly ProjectDeskSummary[],
): Map<string, CosProjectContext> {
  const current = new Set(selectOpenProjectWork(summaries).map((row) => row.projectId));
  const map = new Map<string, CosProjectContext>();
  for (const row of summaries) {
    map.set(row.projectId, {
      projectId: row.projectId,
      title: row.title,
      personName: row.people[0]?.displayName ?? null,
      people: row.people,
      isCurrent: current.has(row.projectId),
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
      recap: [],
      anomalies: [],
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

  if (top.length === 0) {
    return {
      contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
      status: "caught-up",
      heading: COS_CAUGHT_UP_HEADING,
      quietDetail: COS_CAUGHT_UP_DETAIL,
      top5: [],
      remainingCount: 0,
      recap,
      anomalies,
    };
  }

  return {
    contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
    status: "active",
    heading: COS_ACTIVE_HEADING,
    quietDetail: null,
    top5: top.map((item) => presentTop5Item(item, input.nowIso, newMutationId())),
    remainingCount: Math.max(0, ranked.length - top.length),
    recap,
    anomalies,
  };
}

export function replenishTop5(
  input: ComposeCosOperatingLoopInput,
): CosOperatingLoopView {
  return composeCosOperatingLoop(input);
}
