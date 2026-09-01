/**
 * Atomic founder Project Lifecycle mutation.
 * Kind-gated. Does not auto-create on read. Does not delete dormant rows.
 * Does not infer stage. Does not create Open Jobs, waiting, or CoS.
 */

import type {
  ClientMemoryEntity,
  ProjectLifecycleEvent,
  ProjectLifecycleState,
  ProjectProfile,
} from "../types";
import { PROJECT_SPEC_CORRECTION_SOURCE_SYSTEM } from "../project-spec/types";
import {
  isLifecycleKind,
  parseLifecycleStageInput,
  type LifecycleKind,
  type ProjectLifecycleStage,
} from "../project-lifecycle";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SetProjectLifecycleInvalidCode =
  | "invalid-id"
  | "invalid-value"
  | "unsupported-project-kind";

export type SetProjectLifecycleResult =
  | {
      ok: true;
      projectId: string;
      status: "updated" | "already-present";
      projectKind: LifecycleKind;
      stage: ProjectLifecycleStage | null;
      eventId: string | null;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "project-not-found"
        | "entity-kind-mismatch"
        | "unavailable";
      code?: SetProjectLifecycleInvalidCode;
    };

export type SetProjectLifecycleInput = {
  mutationId: string;
  projectId: string;
  newValue: string | null;
  actor: string;
};

export type ProjectLifecycleMutationApplyInput = {
  mutationId: string;
  eventId: string;
  projectId: string;
  priorStage: string | null;
  newStage: ProjectLifecycleStage | null;
  changedAt: string;
  changedBy: string;
};

export type ProjectLifecycleMutationApplyResult = {
  status: "updated" | "already-present";
  state: ProjectLifecycleState | null;
  eventId: string | null;
};

export type SetProjectLifecycleDeps = {
  nowIso: () => string;
  newEventId: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getProjectProfile: (projectId: string) => Promise<ProjectProfile | null>;
  getLifecycleState: (
    projectId: string,
    projectKind: LifecycleKind,
  ) => Promise<ProjectLifecycleState | null>;
  applyMutation: (
    input: ProjectLifecycleMutationApplyInput,
  ) => Promise<ProjectLifecycleMutationApplyResult>;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function actorOrFail(actor: string): string | null {
  const trimmed = actor.trim();
  return trimmed ? trimmed : null;
}

export function lifecycleEventFromApply(
  input: ProjectLifecycleMutationApplyInput,
  projectKind: LifecycleKind,
): ProjectLifecycleEvent {
  return {
    eventId: input.eventId,
    projectId: input.projectId,
    projectKind,
    priorStage: input.priorStage,
    newStage: input.newStage,
    sourceSystem: PROJECT_SPEC_CORRECTION_SOURCE_SYSTEM,
    changedAt: input.changedAt,
    changedBy: input.changedBy,
    mutationId: input.mutationId,
  };
}

export async function setProjectLifecycle(
  deps: SetProjectLifecycleDeps,
  input: SetProjectLifecycleInput,
): Promise<SetProjectLifecycleResult> {
  const mutationId = input.mutationId.trim();
  const projectId = input.projectId.trim();
  if (!isUuid(mutationId) || !isUuid(projectId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  const changedBy = actorOrFail(input.actor);
  if (!changedBy) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }

  try {
    const entity = await deps.getEntity(projectId);
    if (!entity) return { ok: false, reason: "project-not-found" };
    if (entity.kind !== "project") {
      return { ok: false, reason: "entity-kind-mismatch" };
    }
    const profile = await deps.getProjectProfile(projectId);
    if (!profile || profile.projectId !== projectId) {
      return { ok: false, reason: "project-not-found" };
    }
    if (!isLifecycleKind(profile.projectKind)) {
      return {
        ok: false,
        reason: "invalid-input",
        code: "unsupported-project-kind",
      };
    }
    const parsed = parseLifecycleStageInput(profile.projectKind, input.newValue);
    if (!parsed.ok) {
      return { ok: false, reason: "invalid-input", code: parsed.reason };
    }
    const prior = await deps.getLifecycleState(projectId, profile.projectKind);
    const result = await deps.applyMutation({
      mutationId,
      eventId: deps.newEventId(),
      projectId,
      priorStage: prior?.stage ?? null,
      newStage: parsed.stage,
      changedAt: deps.nowIso(),
      changedBy,
    });
    const stage =
      result.state?.stage == null
        ? null
        : (result.state.stage as ProjectLifecycleStage | null);
    return {
      ok: true,
      projectId,
      status: result.status,
      projectKind: profile.projectKind,
      stage,
      eventId: result.eventId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("project-not-found")) {
      return { ok: false, reason: "project-not-found" };
    }
    if (message.includes("entity-kind-mismatch")) {
      return { ok: false, reason: "entity-kind-mismatch" };
    }
    if (message.includes("unsupported-project-kind")) {
      return {
        ok: false,
        reason: "invalid-input",
        code: "unsupported-project-kind",
      };
    }
    if (message.includes("invalid-value")) {
      return { ok: false, reason: "invalid-input", code: "invalid-value" };
    }
    return { ok: false, reason: "unavailable" };
  }
}
