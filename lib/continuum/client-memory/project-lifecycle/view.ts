/**
 * Active Custom / Repair lifecycle view from canonical Kind + current-state rows.
 * Dormant Kind rows are ignored. Existence of a row does not set Kind.
 * Current stage is read from the state table, never by replaying events.
 */

import type { ProjectKind } from "../project-kind";
import {
  LIFECYCLE_KINDS,
  PROJECT_LIFECYCLE_NOT_SET_LABEL,
  isLifecycleKind,
  lifecycleStageLabel,
  lifecycleTransitionLabel,
  stagesForLifecycleKind,
  type LifecycleKind,
} from "../project-lifecycle";
import type { ProjectLifecycleEvent, ProjectLifecycleState } from "../types";

export type ProjectLifecycleRailStage = {
  stage: string;
  label: string;
  current: boolean;
};

export type ProjectLifecycleHistoryEntry = {
  eventId: string;
  priorStage: string | null;
  newStage: string | null;
  label: string;
  changedAt: string;
};

export type ProjectLifecycleView =
  | {
      kind: LifecycleKind;
      stage: string | null;
      label: string;
      stages: ProjectLifecycleRailStage[];
      history: ProjectLifecycleHistoryEntry[];
    }
  | { kind: "none" };

export function activeLifecycleView(input: {
  projectKind: ProjectKind | null | undefined;
  states?: readonly ProjectLifecycleState[] | null;
  events?: readonly ProjectLifecycleEvent[] | null;
}): ProjectLifecycleView {
  if (!isLifecycleKind(input.projectKind)) return { kind: "none" };
  const kind = input.projectKind;
  const state =
    (input.states ?? []).find(
      (row) => row.projectId && row.projectKind === kind,
    ) ?? null;
  const stage = state?.stage ?? null;
  const history = (input.events ?? [])
    .filter((row) => row.projectKind === kind)
    .sort((a, b) => {
      if (a.changedAt === b.changedAt) return b.eventId.localeCompare(a.eventId);
      return a.changedAt < b.changedAt ? 1 : -1;
    })
    .map((row) => ({
      eventId: row.eventId,
      priorStage: row.priorStage,
      newStage: row.newStage,
      label: lifecycleTransitionLabel(kind, row.priorStage, row.newStage),
      changedAt: row.changedAt,
    }));
  return {
    kind,
    stage,
    label: lifecycleStageLabel(kind, stage),
    stages: stagesForLifecycleKind(kind).map((row) => ({
      stage: row,
      label: lifecycleStageLabel(kind, row),
      current: stage === row,
    })),
    history,
  };
}

export function compactLifecycleView(input: {
  projectKind: ProjectKind | null | undefined;
  states?: readonly ProjectLifecycleState[] | null;
}): ProjectLifecycleView {
  return activeLifecycleView({
    projectKind: input.projectKind,
    states: input.states,
    events: [],
  });
}

export function lifecycleStatesByProjectId(
  rows: readonly ProjectLifecycleState[] | undefined,
): Map<string, ProjectLifecycleState[]> {
  const map = new Map<string, ProjectLifecycleState[]>();
  for (const row of rows ?? []) {
    const list = map.get(row.projectId) ?? [];
    list.push(row);
    map.set(row.projectId, list);
  }
  return map;
}

export function collectLifecycleProjectIds(
  profiles: ReadonlyArray<{ projectId: string; projectKind?: ProjectKind | null }>,
): string[] {
  const ids: string[] = [];
  for (const profile of profiles) {
    if (isLifecycleKind(profile.projectKind)) {
      ids.push(profile.projectId);
    }
  }
  return ids;
}

export function lifecycleNotSetLabel(): string {
  return PROJECT_LIFECYCLE_NOT_SET_LABEL;
}

export function isSupportedLifecycleKind(kind: ProjectKind | null | undefined) {
  return isLifecycleKind(kind);
}

export { LIFECYCLE_KINDS };
