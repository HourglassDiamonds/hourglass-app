/**
 * Atomic founder Custom / Repair operating-detail correction.
 * Kind-gated. Does not auto-create on read. Does not delete dormant rows.
 * Does not infer Kind. Does not copy Custom into Repair or vice versa.
 */

import type {
  ClientMemoryEntity,
  ProjectCustomDetails,
  ProjectHistory,
  ProjectHistoryRevision,
  ProjectProfile,
  ProjectRepairDetails,
} from "../types";
import { PROJECT_SPEC_CORRECTION_SOURCE_SYSTEM } from "../project-spec/types";
import type { OperatingDetailField } from "./fields";
import {
  currentCustomFieldValue,
  currentRepairFieldValue,
  emptyCustomDetails,
  emptyRepairDetails,
  isCustomOperatingDetailField,
  isRepairOperatingDetailField,
  requiredKindForOperatingField,
  withCustomFieldValue,
  withRepairFieldValue,
} from "./fields";
import { validateOperatingDetailCorrection } from "./validate";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CorrectOperatingDetailInvalidCode =
  | "invalid-id"
  | "invalid-field"
  | "invalid-value"
  | "wrong-project-kind";

export type CorrectOperatingDetailResult =
  | {
      ok: true;
      projectId: string;
      fieldName: OperatingDetailField;
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
      code?: CorrectOperatingDetailInvalidCode;
    };

export type CorrectOperatingDetailInput = {
  mutationId: string;
  projectId: string;
  fieldName: string;
  newValue: string | null;
  actor: string;
};

export type OperatingDetailCorrectionApplyInput = {
  mutationId: string;
  revisionId: string;
  projectId: string;
  fieldName: OperatingDetailField;
  priorValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedBy: string;
  nextCustom: ProjectCustomDetails | null;
  nextRepair: ProjectRepairDetails | null;
};

export type OperatingDetailCorrectionApplyResult = {
  status: "updated" | "already-present";
  customDetails: ProjectCustomDetails | null;
  repairDetails: ProjectRepairDetails | null;
  revisionId: string | null;
};

export type CorrectOperatingDetailDeps = {
  nowIso: () => string;
  newRevisionId: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getProjectProfile: (projectId: string) => Promise<ProjectProfile | null>;
  getProjectHistory: (projectId: string) => Promise<ProjectHistory | null>;
  getCustomDetails: (projectId: string) => Promise<ProjectCustomDetails | null>;
  getRepairDetails: (projectId: string) => Promise<ProjectRepairDetails | null>;
  applyCorrection: (
    input: OperatingDetailCorrectionApplyInput,
  ) => Promise<OperatingDetailCorrectionApplyResult>;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function actorOrFail(actor: string): string | null {
  const trimmed = actor.trim();
  return trimmed ? trimmed : null;
}

export function operatingDetailRevisionFromApply(
  input: OperatingDetailCorrectionApplyInput,
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

export async function correctProjectOperatingDetail(
  deps: CorrectOperatingDetailDeps,
  input: CorrectOperatingDetailInput,
): Promise<CorrectOperatingDetailResult> {
  const mutationId = input.mutationId.trim();
  const projectId = input.projectId.trim();
  if (!isUuid(mutationId) || !isUuid(projectId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  const changedBy = actorOrFail(input.actor);
  if (!changedBy) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  const parsed = validateOperatingDetailCorrection(input.fieldName, input.newValue);
  if (!parsed.ok) {
    return { ok: false, reason: "invalid-input", code: parsed.reason };
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
    const history = await deps.getProjectHistory(projectId);
    if (!history || history.projectId !== projectId) {
      return { ok: false, reason: "project-history-not-found" };
    }
    const requiredKind = requiredKindForOperatingField(parsed.field);
    if ((profile.projectKind ?? null) !== requiredKind) {
      return { ok: false, reason: "invalid-input", code: "wrong-project-kind" };
    }

    const custom = await deps.getCustomDetails(projectId);
    const repair = await deps.getRepairDetails(projectId);
    const priorValue = isCustomOperatingDetailField(parsed.field)
      ? currentCustomFieldValue(custom, parsed.field)
      : isRepairOperatingDetailField(parsed.field)
        ? currentRepairFieldValue(repair, parsed.field)
        : null;
    const changedAt = deps.nowIso();
    const nextCustom = isCustomOperatingDetailField(parsed.field)
      ? withCustomFieldValue(
          custom ?? emptyCustomDetails(projectId, changedAt),
          parsed.field,
          parsed.value,
          changedAt,
        )
      : null;
    const nextRepair = isRepairOperatingDetailField(parsed.field)
      ? withRepairFieldValue(
          repair ?? emptyRepairDetails(projectId, changedAt),
          parsed.field,
          parsed.value,
          changedAt,
        )
      : null;

    const result = await deps.applyCorrection({
      mutationId,
      revisionId: deps.newRevisionId(),
      projectId,
      fieldName: parsed.field,
      priorValue,
      newValue: parsed.value,
      changedAt,
      changedBy,
      nextCustom,
      nextRepair,
    });
    return {
      ok: true,
      projectId,
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
    if (message.includes("wrong-project-kind")) {
      return { ok: false, reason: "invalid-input", code: "wrong-project-kind" };
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
