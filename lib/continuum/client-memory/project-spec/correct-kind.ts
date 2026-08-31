/**
 * Atomic founder Project Kind correction.
 * Writes a prior-value revision and updates only continuum_project_profiles.project_kind.
 * Does not infer Kind. Does not touch specs, Person linkage, lifecycle, or artifacts.
 */

import type {
  ClientMemoryEntity,
  ProjectHistory,
  ProjectHistoryRevision,
  ProjectProfile,
} from "../types";
import {
  parseProjectKindInput,
  PROJECT_KIND_FIELD,
  type ProjectKind,
} from "../project-kind";
import { PROJECT_SPEC_CORRECTION_SOURCE_SYSTEM } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CorrectProjectKindInvalidCode = "invalid-id" | "invalid-value";

export type CorrectProjectKindResult =
  | {
      ok: true;
      projectId: string;
      status: "updated" | "already-present";
      projectKind: ProjectKind | null;
      revisionId: string | null;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "project-not-found"
        | "entity-kind-mismatch"
        | "project-history-not-found"
        | "unavailable";
      code?: CorrectProjectKindInvalidCode;
    };

export type CorrectProjectKindInput = {
  mutationId: string;
  projectId: string;
  newValue: string | null;
  actor: string;
};

export type ProjectKindCorrectionApplyInput = {
  mutationId: string;
  revisionId: string;
  projectId: string;
  priorValue: ProjectKind | null;
  newValue: ProjectKind | null;
  changedAt: string;
  changedBy: string;
  prior: ProjectProfile;
  next: ProjectProfile;
};

export type ProjectKindCorrectionApplyResult = {
  status: "updated" | "already-present";
  profile: ProjectProfile;
  revisionId: string | null;
};

export type CorrectProjectKindDeps = {
  nowIso: () => string;
  newRevisionId: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getProjectProfile: (projectId: string) => Promise<ProjectProfile | null>;
  getProjectHistory: (projectId: string) => Promise<ProjectHistory | null>;
  applyCorrection: (
    input: ProjectKindCorrectionApplyInput,
  ) => Promise<ProjectKindCorrectionApplyResult>;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function actorOrFail(actor: string): string | null {
  const trimmed = actor.trim();
  return trimmed ? trimmed : null;
}

export function projectKindRevisionFromApply(
  input: ProjectKindCorrectionApplyInput,
): ProjectHistoryRevision {
  return {
    id: input.revisionId,
    projectId: input.projectId,
    mutationId: input.mutationId,
    fieldName: PROJECT_KIND_FIELD,
    priorValue: input.priorValue,
    newValue: input.newValue,
    sourceSystem: PROJECT_SPEC_CORRECTION_SOURCE_SYSTEM,
    changedAt: input.changedAt,
    changedBy: input.changedBy,
  };
}

export async function correctProjectKind(
  deps: CorrectProjectKindDeps,
  input: CorrectProjectKindInput,
): Promise<CorrectProjectKindResult> {
  const mutationId = input.mutationId.trim();
  const projectId = input.projectId.trim();
  if (!isUuid(mutationId) || !isUuid(projectId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  const changedBy = actorOrFail(input.actor);
  if (!changedBy) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  const parsed = parseProjectKindInput(input.newValue);
  if (!parsed.ok) {
    return { ok: false, reason: "invalid-input", code: "invalid-value" };
  }

  try {
    const entity = await deps.getEntity(projectId);
    if (!entity) return { ok: false, reason: "project-not-found" };
    if (entity.kind !== "project") {
      return { ok: false, reason: "entity-kind-mismatch" };
    }
    const prior = await deps.getProjectProfile(projectId);
    if (!prior || prior.projectId !== projectId) {
      return { ok: false, reason: "project-not-found" };
    }
    const history = await deps.getProjectHistory(projectId);
    if (!history || history.projectId !== projectId) {
      return { ok: false, reason: "project-history-not-found" };
    }
    const changedAt = deps.nowIso();
    const next: ProjectProfile = {
      ...prior,
      projectKind: parsed.kind,
      updatedAt: changedAt,
    };
    const result = await deps.applyCorrection({
      mutationId,
      revisionId: deps.newRevisionId(),
      projectId,
      priorValue: prior.projectKind ?? null,
      newValue: parsed.kind,
      changedAt,
      changedBy,
      prior,
      next,
    });
    return {
      ok: true,
      projectId: result.profile.projectId,
      status: result.status,
      projectKind: result.profile.projectKind ?? null,
      revisionId: result.revisionId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("project-not-found")) {
      return { ok: false, reason: "project-not-found" };
    }
    if (message.includes("entity-kind-mismatch")) {
      return { ok: false, reason: "entity-kind-mismatch" };
    }
    if (message.includes("project-history-not-found")) {
      return { ok: false, reason: "project-history-not-found" };
    }
    if (message.includes("invalid-value")) {
      return { ok: false, reason: "invalid-input", code: "invalid-value" };
    }
    return { ok: false, reason: "unavailable" };
  }
}
