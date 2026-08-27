/**
 * Atomic founder project-spec correction.
 * Writes a prior-value revision and updates the current snapshot together.
 * Does not auto-correct. Does not move finger size onto Person facts.
 */

import { isEditableProjectSpecField } from "../contracts";
import type { ClientMemoryEntity, ProjectHistory, ProjectHistoryRevision } from "../types";
import {
  currentSpecValue,
  PROJECT_SPEC_CORRECTION_SOURCE_SYSTEM,
  withSpecValue,
  type EditableProjectSpecField,
} from "./types";
import { validateProjectSpecCorrection } from "./validate";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CorrectProjectSpecInvalidCode =
  | "invalid-id"
  | "invalid-field"
  | "invalid-value"
  | "implausible-finger-size";

export type CorrectProjectSpecResult =
  | {
      ok: true;
      projectId: string;
      fieldName: EditableProjectSpecField;
      status: "updated" | "already-present";
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
      code?: CorrectProjectSpecInvalidCode;
    };

export type CorrectProjectSpecInput = {
  mutationId: string;
  projectId: string;
  fieldName: string;
  newValue: string;
  actor: string;
};

export type ProjectSpecCorrectionApplyInput = {
  mutationId: string;
  revisionId: string;
  projectId: string;
  fieldName: EditableProjectSpecField;
  priorValue: string | null;
  newValue: string;
  changedAt: string;
  changedBy: string;
  prior: ProjectHistory;
  next: ProjectHistory;
};

export type ProjectSpecCorrectionApplyResult = {
  status: "updated" | "already-present";
  history: ProjectHistory;
  revisionId: string | null;
};

export type CorrectProjectSpecDeps = {
  nowIso: () => string;
  newRevisionId: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getProjectHistory: (projectId: string) => Promise<ProjectHistory | null>;
  applyCorrection: (
    input: ProjectSpecCorrectionApplyInput,
  ) => Promise<ProjectSpecCorrectionApplyResult>;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function actorOrFail(actor: string): string | null {
  const trimmed = actor.trim();
  return trimmed ? trimmed : null;
}

export function projectSpecRevisionFromApply(
  input: ProjectSpecCorrectionApplyInput,
): ProjectHistoryRevision {
  return {
    id: input.revisionId,
    projectId: input.projectId,
    mutationId: input.mutationId,
    fieldName: input.fieldName,
    priorValue: input.priorValue,
    newValue: input.newValue,
    sourceSystem: PROJECT_SPEC_CORRECTION_SOURCE_SYSTEM,
    changedAt: input.changedAt,
    changedBy: input.changedBy,
  };
}

export async function correctProjectSpec(
  deps: CorrectProjectSpecDeps,
  input: CorrectProjectSpecInput,
): Promise<CorrectProjectSpecResult> {
  const mutationId = input.mutationId.trim();
  const projectId = input.projectId.trim();
  if (!isUuid(mutationId) || !isUuid(projectId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  const changedBy = actorOrFail(input.actor);
  if (!changedBy) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  if (!isEditableProjectSpecField(input.fieldName)) {
    return { ok: false, reason: "invalid-input", code: "invalid-field" };
  }
  const parsed = validateProjectSpecCorrection(input.fieldName, input.newValue);
  if (!parsed.ok) {
    return { ok: false, reason: "invalid-input", code: parsed.reason };
  }

  try {
    const entity = await deps.getEntity(projectId);
    if (!entity) return { ok: false, reason: "project-not-found" };
    if (entity.kind !== "project") {
      return { ok: false, reason: "entity-kind-mismatch" };
    }
    const prior = await deps.getProjectHistory(projectId);
    if (!prior || prior.projectId !== projectId) {
      return { ok: false, reason: "project-history-not-found" };
    }
    const changedAt = deps.nowIso();
    const next = withSpecValue(prior, parsed.field, parsed.value, changedAt);
    const result = await deps.applyCorrection({
      mutationId,
      revisionId: deps.newRevisionId(),
      projectId,
      fieldName: parsed.field,
      priorValue: currentSpecValue(prior, parsed.field),
      newValue: parsed.value,
      changedAt,
      changedBy,
      prior,
      next,
    });
    return {
      ok: true,
      projectId: result.history.projectId,
      fieldName: parsed.field,
      status: result.status,
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
    if (message.includes("implausible-finger-size")) {
      return {
        ok: false,
        reason: "invalid-input",
        code: "implausible-finger-size",
      };
    }
    if (message.includes("invalid-field")) {
      return { ok: false, reason: "invalid-input", code: "invalid-field" };
    }
    if (message.includes("invalid-value")) {
      return { ok: false, reason: "invalid-input", code: "invalid-value" };
    }
    return { ok: false, reason: "unavailable" };
  }
}
