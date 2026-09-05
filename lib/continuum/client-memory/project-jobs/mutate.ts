/**
 * Founder Open Job state changes.
 * Resolve and cancel are distinct terminal states. Snooze is not resolution.
 * Does not write Gmail, Human Intake, CoS, or Lifecycle.
 */

import type { ClientMemoryEntity, PersonProfile, ProjectProfile } from "../types";
import type { OpenJobActor, OpenJobState, ProjectJob } from "./types";
import {
  isOpenJobActor,
  isOpenJobUuid,
  parseOpenJobCreatedBy,
  parseOpenJobDetail,
  parseOpenJobSubject,
  parseOptionalIso,
  stateTimestampsValid,
} from "./validate";

export const OPEN_JOB_MUTATE_ACTIONS = [
  "resolve",
  "cancel",
  "snooze",
  "unsnooze",
  "update",
] as const;

export type OpenJobMutateAction = (typeof OPEN_JOB_MUTATE_ACTIONS)[number];

export type MutateOpenJobInvalidCode =
  | "invalid-id"
  | "invalid-action"
  | "invalid-state"
  | "invalid-subject"
  | "invalid-detail"
  | "invalid-actor"
  | "invalid-due"
  | "invalid-defer"
  | "person-not-on-project"
  | "wrong-project";

export type MutateOpenJobResult =
  | {
      ok: true;
      status: "updated" | "already-present";
      job: ProjectJob;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "project-not-found"
        | "job-not-found"
        | "entity-kind-mismatch"
        | "unavailable";
      code?: MutateOpenJobInvalidCode;
    };

export type MutateOpenJobInput = {
  mutationId: string;
  projectId: string;
  jobId: string;
  action: string;
  actor: string;
  deferredUntil?: string | null;
  subject?: string | null;
  detail?: string | null;
  waitingOnActor?: string | null;
  associatedPersonId?: string | null;
  dueAt?: string | null;
  clearAssociatedPerson?: boolean;
  clearDueAt?: boolean;
};

export type OpenJobMutationRecord = {
  mutationId: string;
  jobId: string;
  projectId: string;
  action: OpenJobMutateAction | "create";
  priorState: OpenJobState | null;
  newState: OpenJobState;
  changedAt: string;
  changedBy: string;
};

export type ApplyOpenJobMutationInput = {
  mutationId: string;
  action: OpenJobMutateAction;
  prior: ProjectJob;
  next: ProjectJob;
  changedAt: string;
  changedBy: string;
};

export type ApplyOpenJobMutationResult = {
  status: "updated" | "already-present";
  job: ProjectJob;
};

export type MutateOpenJobDeps = {
  nowIso: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getProjectProfile: (projectId: string) => Promise<ProjectProfile | null>;
  getPersonProfile: (personId: string) => Promise<PersonProfile | null>;
  hasActiveClientProjectRelationship: (
    projectId: string,
    personId: string,
  ) => Promise<boolean>;
  getJob: (jobId: string) => Promise<ProjectJob | null>;
  findAppliedMutation: (mutationId: string) => Promise<ProjectJob | null>;
  applyMutation: (
    input: ApplyOpenJobMutationInput,
  ) => Promise<ApplyOpenJobMutationResult>;
};

function invalid(
  code: MutateOpenJobInvalidCode,
): Extract<MutateOpenJobResult, { ok: false }> {
  return { ok: false, reason: "invalid-input", code };
}

function isMutateAction(value: string): value is OpenJobMutateAction {
  return (OPEN_JOB_MUTATE_ACTIONS as readonly string[]).includes(value);
}

function isTerminal(state: OpenJobState): boolean {
  return state === "resolved" || state === "cancelled";
}

export function applyOpenJobStateChange(
  prior: ProjectJob,
  input: {
    action: OpenJobMutateAction;
    now: string;
    deferredUntil?: string | null;
    subject?: string;
    detail?: string | null;
    waitingOnActor?: OpenJobActor;
    associatedPersonId?: string | null;
    dueAt?: string | null;
  },
): { ok: true; next: ProjectJob } | { ok: false; code: MutateOpenJobInvalidCode } {
  if (isTerminal(prior.state) && input.action !== "update") {
    return { ok: false, code: "invalid-state" };
  }
  if (isTerminal(prior.state) && input.action === "update") {
    return { ok: false, code: "invalid-state" };
  }
  const next: ProjectJob = { ...prior, updatedAt: input.now };
  if (input.action === "resolve") {
    next.state = "resolved";
    next.resolvedAt = input.now;
    next.cancelledAt = null;
    next.deferredUntil = null;
  } else if (input.action === "cancel") {
    next.state = "cancelled";
    next.cancelledAt = input.now;
    next.resolvedAt = null;
    next.deferredUntil = null;
  } else if (input.action === "snooze") {
    if (!input.deferredUntil) return { ok: false, code: "invalid-defer" };
    next.state = "snoozed";
    next.deferredUntil = input.deferredUntil;
    next.resolvedAt = null;
    next.cancelledAt = null;
  } else if (input.action === "unsnooze") {
    if (prior.state !== "snoozed") return { ok: false, code: "invalid-state" };
    next.state = "open";
    next.deferredUntil = null;
    next.resolvedAt = null;
    next.cancelledAt = null;
  } else {
    if (input.subject != null) next.subject = input.subject;
    if (input.detail !== undefined) next.detail = input.detail;
    if (input.waitingOnActor) next.waitingOnActor = input.waitingOnActor;
    if (input.associatedPersonId !== undefined) {
      next.associatedPersonId = input.associatedPersonId;
    }
    if (input.dueAt !== undefined) next.dueAt = input.dueAt;
  }
  if (
    !stateTimestampsValid({
      state: next.state,
      deferredUntil: next.deferredUntil,
      resolvedAt: next.resolvedAt,
      cancelledAt: next.cancelledAt,
    })
  ) {
    return { ok: false, code: "invalid-state" };
  }
  return { ok: true, next };
}

export async function mutateOpenJob(
  deps: MutateOpenJobDeps,
  input: MutateOpenJobInput,
): Promise<MutateOpenJobResult> {
  const mutationId = input.mutationId.trim();
  const projectId = input.projectId.trim();
  const jobId = input.jobId.trim();
  if (!isOpenJobUuid(mutationId) || !isOpenJobUuid(projectId) || !isOpenJobUuid(jobId)) {
    return invalid("invalid-id");
  }
  if (!isMutateAction(input.action)) return invalid("invalid-action");
  const changedBy = parseOpenJobCreatedBy(input.actor);
  if (!changedBy.ok) return invalid("invalid-id");

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
    const prior = await deps.getJob(jobId);
    if (!prior) return { ok: false, reason: "job-not-found" };
    if (prior.projectId !== projectId) return invalid("wrong-project");

    const existing = await deps.findAppliedMutation(mutationId);
    if (existing) {
      if (existing.projectId !== projectId || existing.jobId !== jobId) {
        return invalid("invalid-id");
      }
      return { ok: true, status: "already-present", job: existing };
    }

    let deferredUntil: string | null | undefined;
    let subject: string | undefined;
    let detail: string | null | undefined;
    let waitingOnActor: OpenJobActor | undefined;
    let associatedPersonId: string | null | undefined;
    let dueAt: string | null | undefined;

    if (input.action === "snooze") {
      const parsed = parseOptionalIso(input.deferredUntil);
      if (!parsed.ok || parsed.value == null) return invalid("invalid-defer");
      deferredUntil = parsed.value;
    }
    if (input.action === "update") {
      if (input.subject != null) {
        const parsed = parseOpenJobSubject(input.subject);
        if (!parsed.ok) return invalid("invalid-subject");
        subject = parsed.subject;
      }
      if (input.detail !== undefined) {
        const parsed = parseOpenJobDetail(input.detail);
        if (!parsed.ok) return invalid("invalid-detail");
        detail = parsed.detail;
      }
      if (input.waitingOnActor != null && input.waitingOnActor !== "") {
        if (!isOpenJobActor(input.waitingOnActor)) return invalid("invalid-actor");
        waitingOnActor = input.waitingOnActor;
      }
      if (input.clearAssociatedPerson) {
        associatedPersonId = null;
      } else if (input.associatedPersonId != null && input.associatedPersonId !== "") {
        const personId = input.associatedPersonId.trim();
        if (!isOpenJobUuid(personId)) return invalid("invalid-id");
        const person = await deps.getPersonProfile(personId);
        if (!person) return invalid("person-not-on-project");
        const linked = await deps.hasActiveClientProjectRelationship(
          projectId,
          personId,
        );
        if (!linked) return invalid("person-not-on-project");
        associatedPersonId = personId;
      }
      if (input.clearDueAt) {
        dueAt = null;
      } else if (input.dueAt != null && input.dueAt !== "") {
        const parsed = parseOptionalIso(input.dueAt);
        if (!parsed.ok) return invalid("invalid-due");
        dueAt = parsed.value;
      }
    }

    const changed = applyOpenJobStateChange(prior, {
      action: input.action,
      now: deps.nowIso(),
      deferredUntil,
      subject,
      detail,
      waitingOnActor,
      associatedPersonId,
      dueAt,
    });
    if (!changed.ok) return invalid(changed.code);
    const result = await deps.applyMutation({
      mutationId,
      action: input.action,
      prior,
      next: changed.next,
      changedAt: changed.next.updatedAt,
      changedBy: changedBy.createdBy,
    });
    return { ok: true, status: result.status, job: result.job };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("project-not-found")) {
      return { ok: false, reason: "project-not-found" };
    }
    if (message.includes("job-not-found")) {
      return { ok: false, reason: "job-not-found" };
    }
    if (message.includes("entity-kind-mismatch")) {
      return { ok: false, reason: "entity-kind-mismatch" };
    }
    return { ok: false, reason: "unavailable" };
  }
}
