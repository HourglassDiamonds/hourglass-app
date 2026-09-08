/**
 * Founder-explicit canonical Project create.
 * Does not infer from Gmail. Does not mint People. Does not auto-attach
 * work to an unrelated historical Project.
 */

import { randomUUID } from "node:crypto";
import {
  isProjectKind,
  parseProjectKindInput,
  type ProjectKind,
} from "../project-kind";
import {
  isLifecycleKind,
  parseLifecycleStageInput,
  type ProjectLifecycleStage,
} from "../project-lifecycle";
import type { CreateProjectJobInput, CreateProjectJobResult } from "../project-jobs/create";
import { founderManualActionInput } from "../open-projects/manual-action";
import { isOpenJobUuid, parseOpenJobSubject, parseOptionalIso } from "../project-jobs/validate";
import type { ClientMemoryEntity, EntityRelationship, InsertResult, PersonProfile, ProjectHistory, ProjectProfile } from "../types";
import { DEFAULT_VISIBILITY } from "../types";
import type { CorrectProjectKindInput, CorrectProjectKindResult } from "../project-spec/correct-kind";
import type { SetProjectLifecycleInput, SetProjectLifecycleResult } from "../project-lifecycle/set";

export const FOUNDER_PROJECT_SOURCE_SYSTEM = "concierge-manual" as const;
export const FOUNDER_PROJECT_IMPORT_PREFIX = "concierge-manual:founder-project:" as const;
export const FOUNDER_PROJECT_TITLE_MAX = 160;

export type FounderLinkedProject = {
  projectId: string;
  title: string;
  projectKind: ProjectKind | null;
};

export type CreateFounderProjectInput = {
  mutationId: string;
  title: string;
  personId: string;
  projectKind: string;
  lifecycleStage?: string | null;
  subject?: string | null;
  dueAt?: string | null;
  actor: string;
};

export type CreateFounderProjectInvalidCode =
  | "invalid-id"
  | "invalid-title"
  | "invalid-kind"
  | "invalid-lifecycle"
  | "person-not-found"
  | "lifecycle-required";

export type CreateFounderProjectResult =
  | {
      ok: true;
      status: "created" | "already-present";
      projectId: string;
      title: string;
      projectKind: ProjectKind;
      lifecycleStage: ProjectLifecycleStage | null;
      job: CreateProjectJobResult | null;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "person-not-found"
        | "entity-kind-mismatch"
        | "duplicate-project"
        | "unavailable";
      code?: CreateFounderProjectInvalidCode;
      existingProjectId?: string;
      existingTitle?: string;
      message?: string;
    };

export type CreateFounderProjectDeps = {
  nowIso: () => string;
  newRelationshipId: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getPersonProfile: (personId: string) => Promise<PersonProfile | null>;
  getProjectProfile: (projectId: string) => Promise<ProjectProfile | null>;
  findProjectByImportRowKey: (input: {
    sourceSystem: string;
    importRowKey: string;
  }) => Promise<ProjectProfile | null>;
  listActiveClientProjects: (personId: string) => Promise<FounderLinkedProject[]>;
  insertEntity: (input: {
    kind: "project";
    createdAt: string;
    createdBy: string;
  }) => Promise<InsertResult<ClientMemoryEntity>>;
  insertProjectProfile: (profile: ProjectProfile) => Promise<InsertResult<ProjectProfile>>;
  insertProjectHistory: (history: ProjectHistory) => Promise<InsertResult<ProjectHistory>>;
  insertRelationship: (row: EntityRelationship) => Promise<InsertResult<EntityRelationship>>;
  correctProjectKind: (input: CorrectProjectKindInput) => Promise<CorrectProjectKindResult>;
  setProjectLifecycle: (input: SetProjectLifecycleInput) => Promise<SetProjectLifecycleResult>;
  createProjectJob: (input: CreateProjectJobInput) => Promise<CreateProjectJobResult>;
};

export function founderProjectImportRowKey(mutationId: string): string {
  return `${FOUNDER_PROJECT_IMPORT_PREFIX}${mutationId.trim()}`;
}

export function parseFounderProjectTitle(
  value: string | null | undefined,
): { ok: true; title: string } | { ok: false } {
  const title = (value ?? "").trim();
  if (!title || title.length > FOUNDER_PROJECT_TITLE_MAX || /[\n\r]/.test(title)) {
    return { ok: false };
  }
  return { ok: true, title };
}

export function foldProjectTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findDuplicateLinkedProject(
  title: string,
  existing: readonly FounderLinkedProject[],
): FounderLinkedProject | null {
  const folded = foldProjectTitle(title);
  if (!folded) return null;
  return existing.find((row) => foldProjectTitle(row.title) === folded) ?? null;
}

function emptyHistory(projectId: string, now: string): ProjectHistory {
  return {
    projectId,
    cadJobNumber: null,
    orderNumber: null,
    gmailThreadId: null,
    matchJudgment: null,
    matchJudgmentRaw: null,
    fingerSize: null,
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    sourceSystem: FOUNDER_PROJECT_SOURCE_SYSTEM,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createFounderProject(
  deps: CreateFounderProjectDeps,
  input: CreateFounderProjectInput,
): Promise<CreateFounderProjectResult> {
  const mutationId = input.mutationId.trim();
  const personId = input.personId.trim();
  if (!isOpenJobUuid(mutationId) || !isOpenJobUuid(personId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  const actor = input.actor.trim();
  if (!actor) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  const parsedTitle = parseFounderProjectTitle(input.title);
  if (!parsedTitle.ok) {
    return { ok: false, reason: "invalid-input", code: "invalid-title" };
  }
  const kindParsed = parseProjectKindInput(input.projectKind);
  if (!kindParsed.ok || !kindParsed.kind || !isProjectKind(kindParsed.kind)) {
    return { ok: false, reason: "invalid-input", code: "invalid-kind" };
  }
  const projectKind = kindParsed.kind;
  let lifecycleStage: ProjectLifecycleStage | null = null;
  if (isLifecycleKind(projectKind)) {
    const stageRaw = input.lifecycleStage?.trim() || null;
    if (!stageRaw) {
      return { ok: false, reason: "invalid-input", code: "lifecycle-required" };
    }
    const parsedStage = parseLifecycleStageInput(projectKind, stageRaw);
    if (!parsedStage.ok || !parsedStage.stage) {
      return { ok: false, reason: "invalid-input", code: "invalid-lifecycle" };
    }
    lifecycleStage = parsedStage.stage;
  }

  const subjectRaw = input.subject?.trim() || "";
  if (subjectRaw) {
    const subject = parseOpenJobSubject(subjectRaw);
    if (!subject.ok) {
      return { ok: false, reason: "invalid-input", code: "invalid-title" };
    }
    const dueAt = parseOptionalIso(input.dueAt);
    if (!dueAt.ok) {
      return { ok: false, reason: "invalid-input", code: "invalid-id" };
    }
  }

  try {
    const entity = await deps.getEntity(personId);
    if (!entity) return { ok: false, reason: "person-not-found", code: "person-not-found" };
    if (entity.kind !== "person") {
      return { ok: false, reason: "entity-kind-mismatch" };
    }
    const person = await deps.getPersonProfile(personId);
    if (!person || person.personId !== personId) {
      return { ok: false, reason: "person-not-found", code: "person-not-found" };
    }

    const importRowKey = founderProjectImportRowKey(mutationId);
    const existingByKey = await deps.findProjectByImportRowKey({
      sourceSystem: FOUNDER_PROJECT_SOURCE_SYSTEM,
      importRowKey,
    });
    if (existingByKey) {
      return {
        ok: true,
        status: "already-present",
        projectId: existingByKey.projectId,
        title: existingByKey.displayTitle,
        projectKind: existingByKey.projectKind ?? projectKind,
        lifecycleStage,
        job: null,
      };
    }

    const linked = await deps.listActiveClientProjects(personId);
    const duplicate = findDuplicateLinkedProject(parsedTitle.title, linked);
    if (duplicate) {
      return {
        ok: false,
        reason: "duplicate-project",
        existingProjectId: duplicate.projectId,
        existingTitle: duplicate.title,
        message: "That project already exists for this person.",
      };
    }

    const now = deps.nowIso();
    const inserted = await deps.insertEntity({
      kind: "project",
      createdAt: now,
      createdBy: actor,
    });
    const projectId = inserted.record.id;
    await deps.insertProjectProfile({
      projectId,
      displayTitle: parsedTitle.title,
      visibility: DEFAULT_VISIBILITY,
      importRowKey,
      sourceSystem: FOUNDER_PROJECT_SOURCE_SYSTEM,
      createdAt: now,
      updatedAt: now,
    });
    await deps.insertProjectHistory(emptyHistory(projectId, now));
    await deps.insertRelationship({
      id: deps.newRelationshipId(),
      fromEntityId: personId,
      toEntityId: projectId,
      kind: "client-project",
      status: "active",
      sourceSystem: FOUNDER_PROJECT_SOURCE_SYSTEM,
      createdAt: now,
      createdBy: actor,
    });

    const kindResult = await deps.correctProjectKind({
      mutationId: randomUUID(),
      projectId,
      newValue: projectKind,
      actor,
    });
    if (!kindResult.ok) {
      return { ok: false, reason: "unavailable" };
    }

    if (lifecycleStage) {
      const life = await deps.setProjectLifecycle({
        mutationId: randomUUID(),
        projectId,
        newValue: lifecycleStage,
        actor,
      });
      if (!life.ok) {
        return { ok: false, reason: "unavailable" };
      }
    }

    let job: CreateProjectJobResult | null = null;
    if (subjectRaw) {
      const parsedAction = founderManualActionInput({
        mutationId,
        projectId,
        subject: subjectRaw,
        associatedPersonId: personId,
        dueAt: input.dueAt,
        actor,
      });
      if (!parsedAction.ok) {
        return { ok: false, reason: "invalid-input", code: "invalid-title" };
      }
      job = await deps.createProjectJob(parsedAction.input);
      if (!job.ok) {
        return { ok: false, reason: "unavailable" };
      }
    }

    return {
      ok: true,
      status: inserted.status === "already-present" ? "already-present" : "created",
      projectId,
      title: parsedTitle.title,
      projectKind,
      lifecycleStage,
      job,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
