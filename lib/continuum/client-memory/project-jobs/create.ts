/**
 * Internal Open Job create primitive for tests and founder controls.
 * Does not infer jobs from notes, Lifecycle, Gmail, or operating details.
 * Founder UI lives in dedicated Concierge actions. Does not write CoS, Human Intake, or Gmail.
 */

import type { ClientMemoryEntity, PersonProfile, ProjectProfile } from "../types";
import type { OpenJobActor, OpenJobKind, OpenJobSourceSystem, ProjectJob } from "./types";
import {
  isOpenJobActor,
  isOpenJobKind,
  isOpenJobUuid,
  parseOpenJobCreatedBy,
  parseOpenJobDetail,
  parseOpenJobSourceRef,
  parseOpenJobSubject,
  parseOptionalIso,
} from "./validate";

const MANUAL_SOURCE: OpenJobSourceSystem = "concierge-manual";

export type CreateProjectJobInvalidCode =
  | "invalid-id"
  | "invalid-kind"
  | "invalid-actor"
  | "invalid-subject"
  | "invalid-detail"
  | "invalid-source"
  | "invalid-due"
  | "person-not-on-project";

export type CreateProjectJobResult =
  | {
      ok: true;
      status: "created" | "already-present";
      job: ProjectJob;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "project-not-found"
        | "entity-kind-mismatch"
        | "unavailable";
      code?: CreateProjectJobInvalidCode;
    };

export type CreateProjectJobInput = {
  mutationId: string;
  projectId: string;
  kind: string;
  subject: string;
  detail?: string | null;
  waitingOnActor: string;
  associatedPersonId?: string | null;
  dueAt?: string | null;
  actor: string;
  sourceSystem?: string | null;
  sourceRef?: string | null;
};

export type CreateProjectJobApplyInput = ProjectJob;

export type CreateProjectJobApplyResult = {
  status: "created" | "already-present";
  job: ProjectJob;
};

export type CreateProjectJobDeps = {
  nowIso: () => string;
  newJobId: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getProjectProfile: (projectId: string) => Promise<ProjectProfile | null>;
  getPersonProfile: (personId: string) => Promise<PersonProfile | null>;
  hasActiveClientProjectRelationship: (
    projectId: string,
    personId: string,
  ) => Promise<boolean>;
  applyCreate: (
    input: CreateProjectJobApplyInput,
  ) => Promise<CreateProjectJobApplyResult>;
};

function invalid(
  code: CreateProjectJobInvalidCode,
): Extract<CreateProjectJobResult, { ok: false }> {
  return { ok: false, reason: "invalid-input", code };
}

export async function createProjectJob(
  deps: CreateProjectJobDeps,
  input: CreateProjectJobInput,
): Promise<CreateProjectJobResult> {
  const mutationId = input.mutationId.trim();
  const projectId = input.projectId.trim();
  if (!isOpenJobUuid(mutationId) || !isOpenJobUuid(projectId)) {
    return invalid("invalid-id");
  }
  if (!isOpenJobKind(input.kind)) return invalid("invalid-kind");
  if (!isOpenJobActor(input.waitingOnActor)) return invalid("invalid-actor");
  const subject = parseOpenJobSubject(input.subject);
  if (!subject.ok) return invalid("invalid-subject");
  const detail = parseOpenJobDetail(input.detail);
  if (!detail.ok) return invalid("invalid-detail");
  const createdBy = parseOpenJobCreatedBy(input.actor);
  if (!createdBy.ok) return invalid("invalid-id");
  const dueAt = parseOptionalIso(input.dueAt);
  if (!dueAt.ok) return invalid("invalid-due");
  const sourceRef = parseOpenJobSourceRef(input.sourceRef);
  if (!sourceRef.ok) return invalid("invalid-source");
  const sourceSystem = input.sourceSystem?.trim() || MANUAL_SOURCE;
  if (sourceSystem !== MANUAL_SOURCE && sourceSystem !== "continuum") {
    return invalid("invalid-source");
  }
  const associatedPersonId = input.associatedPersonId?.trim() || null;
  if (associatedPersonId && !isOpenJobUuid(associatedPersonId)) {
    return invalid("invalid-id");
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
    if (associatedPersonId) {
      const person = await deps.getPersonProfile(associatedPersonId);
      if (!person || person.personId !== associatedPersonId) {
        return invalid("person-not-on-project");
      }
      const linked = await deps.hasActiveClientProjectRelationship(
        projectId,
        associatedPersonId,
      );
      if (!linked) return invalid("person-not-on-project");
    }

    const now = deps.nowIso();
    const job: ProjectJob = {
      jobId: deps.newJobId(),
      projectId,
      kind: input.kind as OpenJobKind,
      subject: subject.subject,
      detail: detail.detail,
      waitingOnActor: input.waitingOnActor as OpenJobActor,
      associatedPersonId,
      state: "open",
      dueAt: dueAt.value,
      deferredUntil: null,
      resolvedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy.createdBy,
      sourceSystem,
      sourceRef: sourceRef.sourceRef,
      createdMutationId: mutationId,
    };
    const result = await deps.applyCreate(job);
    return { ok: true, status: result.status, job: result.job };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("project-not-found")) {
      return { ok: false, reason: "project-not-found" };
    }
    if (message.includes("entity-kind-mismatch")) {
      return { ok: false, reason: "entity-kind-mismatch" };
    }
    return { ok: false, reason: "unavailable" };
  }
}
