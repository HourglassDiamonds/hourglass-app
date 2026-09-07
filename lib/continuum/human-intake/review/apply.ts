/**
 * Founder review apply for Human Intake candidates.
 * Uses the frozen #17 review model. Existing writers only after explicit approve.
 * Does not mint Persons. Does not auto-create jobs from extraction.
 */

import {
  applyFounderReview,
  effectiveCandidatePayload,
  effectiveCandidateTarget,
} from "@/lib/continuum/candidates/review";
import type {
  CandidatePayload,
  CandidateStore,
  ContinuumCandidate,
  FounderReviewInput,
  ProposedCanonicalTarget,
} from "@/lib/continuum/candidates/types";
import type { AddManualNoteInput, AddManualNoteResult } from "@/lib/continuum/client-memory/write/types";
import type {
  CreateProjectJobInput,
  CreateProjectJobResult,
} from "@/lib/continuum/client-memory/project-jobs/create";
import type {
  CorrectProjectSpecInput,
  CorrectProjectSpecResult,
} from "@/lib/continuum/client-memory/project-spec/correct";
import { isOpenJobActor, isOpenJobKind } from "@/lib/continuum/client-memory/project-jobs/validate";
import type { HumanSource, HumanSourceLink } from "@/lib/continuum/client-memory/human-intake/types";
import {
  previewHumanIntakeCandidateApply,
  sourceIdOfCandidate,
  type HumanIntakeApplyPreview,
} from "./preview";

export const HUMAN_INTAKE_JOB_SOURCE_REF_PREFIX = "human-intake:" as const;

export function humanIntakeJobSourceRef(
  sourceId: string,
  candidateId: string,
): string {
  return `${HUMAN_INTAKE_JOB_SOURCE_REF_PREFIX}${sourceId}/${candidateId}`;
}

export type HumanIntakeReviewAction = "approve" | "edit" | "discard" | "defer";

export type HumanIntakeCandidateEdits = {
  personId?: string | null;
  projectId?: string | null;
  noteText?: string;
  jobKind?: string;
  jobSubject?: string;
  jobDetail?: string | null;
  waitingOnActor?: string;
  dueAt?: string | null;
  specValue?: string;
};

export type ReviewHumanIntakeCandidateInput = {
  candidateId: string;
  action: HumanIntakeReviewAction;
  actor: string;
  mutationId: string;
  edits?: HumanIntakeCandidateEdits | null;
};

export type ReviewHumanIntakeCandidateResult =
  | {
      ok: true;
      status: "applied" | "already-present" | "discarded" | "deferred" | "edited";
      candidateId: string;
      preview: HumanIntakeApplyPreview;
      appliedRecordKind: HumanIntakeApplyPreview["applyKind"] | null;
      appliedRecordId: string | null;
      record: ContinuumCandidate;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "unauthorized-state"
        | "candidate-not-found"
        | "source-not-found"
        | "blocked"
        | "unavailable";
      code?: string;
      preview?: HumanIntakeApplyPreview;
    };

export type ReviewHumanIntakeCandidateDeps = {
  nowIso: () => string;
  candidates: CandidateStore;
  getSource: (id: string) => Promise<HumanSource | null>;
  listLinks: (sourceId: string) => Promise<HumanSourceLink[]>;
  getPersonName: (id: string) => Promise<string | null>;
  getProjectTitle: (id: string) => Promise<string | null>;
  personOnProject: (personId: string, projectId: string) => Promise<boolean | null>;
  updateSourceReviewStatus: (
    sourceId: string,
    status: HumanSource["reviewStatus"],
    updatedAt: string,
  ) => Promise<void>;
  confirmSourceLink: (input: {
    sourceId: string;
    entityId: string;
    entityKind: "person" | "project";
    createdAt: string;
  }) => Promise<"inserted" | "already-present">;
  addManualNote: (input: AddManualNoteInput) => Promise<AddManualNoteResult>;
  createProjectJob: (input: CreateProjectJobInput) => Promise<CreateProjectJobResult>;
  correctProjectSpec: (
    input: CorrectProjectSpecInput,
  ) => Promise<CorrectProjectSpecResult>;
};

function overlayFromEdits(
  row: ContinuumCandidate,
  edits: HumanIntakeCandidateEdits | null | undefined,
): { payload: CandidatePayload; proposedTarget: ProposedCanonicalTarget } {
  const payload = { ...effectiveCandidatePayload(row) };
  let target = { ...effectiveCandidateTarget(row) };
  if (!edits) return { payload, proposedTarget: target };

  if (edits.personId !== undefined && (target.kind === "person" || payload.kind === "person_association" || payload.kind === "note")) {
    target = { kind: "person", personId: edits.personId };
  }
  if (
    edits.projectId !== undefined &&
    (target.kind === "project" ||
      target.kind === "project_spec" ||
      target.kind === "open_job" ||
      payload.kind === "project_association" ||
      payload.kind === "structured_spec" ||
      payload.kind === "open_job")
  ) {
    if (payload.kind === "structured_spec" || target.kind === "project_spec") {
      const fieldName =
        target.kind === "project_spec"
          ? target.fieldName
          : payload.kind === "structured_spec"
            ? payload.fieldName
            : "finger_size";
      target = { kind: "project_spec", projectId: edits.projectId, fieldName };
    } else if (payload.kind === "open_job" || target.kind === "open_job") {
      target = { kind: "open_job", projectId: edits.projectId };
    } else {
      target = { kind: "project", projectId: edits.projectId };
    }
  }

  if (payload.kind === "note" && edits.noteText != null) {
    return { payload: { ...payload, text: edits.noteText }, proposedTarget: target };
  }
  if (payload.kind === "structured_spec" && edits.specValue != null) {
    const proposedValue = edits.specValue;
    const conflict =
      (payload.currentValue ?? "").trim().toLowerCase() !== "" &&
      (payload.currentValue ?? "").trim().toLowerCase() !== proposedValue.trim().toLowerCase();
    return {
      payload: { ...payload, proposedValue, conflict },
      proposedTarget: target,
    };
  }
  if (payload.kind === "open_job") {
    return {
      payload: {
        ...payload,
        jobKind: isOpenJobKind(edits.jobKind) ? edits.jobKind : payload.jobKind,
        subject: edits.jobSubject?.trim() || payload.subject,
        detail: edits.jobDetail !== undefined ? edits.jobDetail : payload.detail,
        waitingOnActor: isOpenJobActor(edits.waitingOnActor)
          ? edits.waitingOnActor
          : payload.waitingOnActor,
        dueAt: edits.dueAt !== undefined ? edits.dueAt : payload.dueAt,
        createJob: false,
      },
      proposedTarget: target,
    };
  }
  if (payload.kind === "follow_up") {
    return {
      payload: {
        ...payload,
        text: edits.noteText?.trim() || payload.text,
        dueAt: edits.dueAt !== undefined ? edits.dueAt : payload.dueAt,
      },
      proposedTarget: target,
    };
  }
  if (payload.kind === "date") {
    return {
      payload: {
        ...payload,
        isoDate: edits.dueAt !== undefined ? edits.dueAt : payload.isoDate,
      },
      proposedTarget: target,
    };
  }
  return { payload, proposedTarget: target };
}

function reviewInputFor(
  action: HumanIntakeReviewAction,
  overlay: { payload: CandidatePayload; proposedTarget: ProposedCanonicalTarget },
): FounderReviewInput {
  if (action === "edit") {
    return {
      action: "edit",
      payload: overlay.payload,
      proposedTarget: overlay.proposedTarget,
    };
  }
  if (action === "approve") {
    return { action: "approve", payload: overlay.payload };
  }
  if (action === "discard") return { action: "discard" };
  return { action: "defer" };
}

async function refreshSourceReview(
  deps: ReviewHumanIntakeCandidateDeps,
  sourceId: string,
  now: string,
): Promise<void> {
  const pending = (await deps.candidates.list()).some((row) => {
    return (
      row.sourceSystem === "human-intake" &&
      sourceIdOfCandidate(row) === sourceId &&
      row.reviewStatus === "pending" &&
      row.candidateState !== "superseded"
    );
  });
  await deps.updateSourceReviewStatus(
    sourceId,
    pending ? "in-review" : "complete",
    now,
  );
}

function confirmedEntityId(
  links: readonly HumanSourceLink[],
  kind: "person" | "project",
): string | null {
  return (
    links.find((row) => row.entityKind === kind && row.linkStatus === "confirmed")
      ?.entityId ?? null
  );
}

function resolvedPersonId(input: {
  target: ProposedCanonicalTarget;
  edits: HumanIntakeCandidateEdits | null | undefined;
  links: readonly HumanSourceLink[];
}): string | null {
  if (input.edits?.personId !== undefined) return input.edits.personId;
  const fromTarget = personIdOf(input.target);
  if (fromTarget) return fromTarget;
  return confirmedEntityId(input.links, "person");
}

function resolvedProjectId(input: {
  target: ProposedCanonicalTarget;
  edits: HumanIntakeCandidateEdits | null | undefined;
  links: readonly HumanSourceLink[];
}): string | null {
  if (input.edits?.projectId !== undefined) return input.edits.projectId;
  const fromTarget = projectIdOf(input.target);
  if (fromTarget) return fromTarget;
  return confirmedEntityId(input.links, "project");
}

function personIdOf(target: ProposedCanonicalTarget): string | null {
  return target.kind === "person" ? target.personId : null;
}

function projectIdOf(target: ProposedCanonicalTarget): string | null {
  if (target.kind === "project") return target.projectId;
  if (target.kind === "project_spec") return target.projectId;
  if (target.kind === "open_job") return target.projectId;
  return null;
}

export async function reviewHumanIntakeCandidate(
  deps: ReviewHumanIntakeCandidateDeps,
  input: ReviewHumanIntakeCandidateInput,
): Promise<ReviewHumanIntakeCandidateResult> {
  const candidateId = input.candidateId.trim();
  const actor = input.actor.trim();
  const mutationId = input.mutationId.trim();
  if (!candidateId || !actor) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  if ((input.action === "approve" || input.action === "edit") && !mutationId) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }

  try {
    const existing = await deps.candidates.get(candidateId);
    if (!existing) return { ok: false, reason: "candidate-not-found" };
    const sourceId = sourceIdOfCandidate(existing);
    if (!sourceId) return { ok: false, reason: "source-not-found" };
    const source = await deps.getSource(sourceId);
    if (!source) return { ok: false, reason: "source-not-found" };
    const now = deps.nowIso();

    if (input.action === "discard" || input.action === "defer") {
      if (existing.reviewStatus === "approved") {
        return { ok: false, reason: "unauthorized-state", code: "already-approved" };
      }
      const applied = await deps.candidates.applyReview(
        candidateId,
        reviewInputFor(input.action, overlayFromEdits(existing, null)),
        now,
      );
      if (!applied.ok) return { ok: false, reason: "candidate-not-found" };
      await refreshSourceReview(deps, sourceId, now);
      return {
        ok: true,
        status: input.action === "discard" ? "discarded" : "deferred",
        candidateId,
        preview: {
          summary:
            input.action === "discard"
              ? "Discarded. No canonical memory was written."
              : "Deferred for later review. No canonical memory was written.",
          canApply: false,
          blockers: [],
          applyKind: "none",
          currentValue: null,
          proposedValue: null,
          conflict: false,
        },
        appliedRecordKind: null,
        appliedRecordId: null,
        record: applied.record,
      };
    }

    const overlay = overlayFromEdits(existing, input.edits);
    const working = applyFounderReview(
      existing,
      {
        action: "edit",
        payload: overlay.payload,
        proposedTarget: overlay.proposedTarget,
      },
      now,
    );
    const target = effectiveCandidateTarget(working);
    const links = await deps.listLinks(sourceId);
    const personId = resolvedPersonId({
      target,
      edits: input.edits,
      links,
    });
    const projectId = resolvedProjectId({
      target,
      edits: input.edits,
      links,
    });
    const personOnProject =
      personId && projectId
        ? await deps.personOnProject(personId, projectId)
        : personId
          ? false
          : null;
    const preview = previewHumanIntakeCandidateApply({
      candidate: working,
      personName: personId ? await deps.getPersonName(personId) : null,
      projectTitle: projectId ? await deps.getProjectTitle(projectId) : null,
      personOnProject,
    });

    if (input.action === "edit") {
      const saved = await deps.candidates.applyReview(
        candidateId,
        { action: "edit", payload: overlay.payload, proposedTarget: overlay.proposedTarget },
        now,
      );
      if (!saved.ok) return { ok: false, reason: "candidate-not-found" };
      return {
        ok: true,
        status: "edited",
        candidateId,
        preview,
        appliedRecordKind: null,
        appliedRecordId: null,
        record: saved.record,
      };
    }

    if (existing.reviewStatus === "approved") {
      return {
        ok: true,
        status: "already-present",
        candidateId,
        preview,
        appliedRecordKind: preview.applyKind,
        appliedRecordId: null,
        record: existing,
      };
    }

    if (!preview.canApply) {
      return { ok: false, reason: "blocked", code: preview.blockers[0], preview };
    }

    let appliedRecordId: string | null = null;
    if (preview.applyKind === "source_link") {
      const entityKind = overlay.payload.kind === "person_association" ? "person" : "project";
      const entityId = entityKind === "person" ? personId : projectId;
      if (!entityId) {
        return { ok: false, reason: "blocked", code: "entity-required", preview };
      }
      const link = await deps.confirmSourceLink({
        sourceId,
        entityId,
        entityKind,
        createdAt: now,
      });
      appliedRecordId = entityId;
      if (link === "already-present") {
        const approved = await deps.candidates.applyReview(
          candidateId,
          { action: "approve", payload: overlay.payload },
          now,
        );
        if (!approved.ok) return { ok: false, reason: "candidate-not-found" };
        await refreshSourceReview(deps, sourceId, now);
        return {
          ok: true,
          status: "already-present",
          candidateId,
          preview,
          appliedRecordKind: "source_link",
          appliedRecordId,
          record: approved.record,
        };
      }
    } else if (preview.applyKind === "source_note") {
      if (!personId || overlay.payload.kind !== "note") {
        return { ok: false, reason: "blocked", code: "person-required", preview };
      }
      const note = await deps.addManualNote({
        submissionId: mutationId,
        personId,
        projectId,
        contextLayer: overlay.payload.contextLayer ?? "client",
        noteText: overlay.payload.text,
        actor,
      });
      if (!note.ok) {
        return { ok: false, reason: "unavailable", code: note.reason };
      }
      appliedRecordId = note.noteId;
    } else if (preview.applyKind === "project_spec") {
      if (!projectId || overlay.payload.kind !== "structured_spec") {
        return { ok: false, reason: "blocked", code: "project-required", preview };
      }
      const spec = await deps.correctProjectSpec({
        mutationId,
        projectId,
        fieldName: overlay.payload.fieldName,
        newValue: overlay.payload.proposedValue,
        actor,
      });
      if (!spec.ok) {
        return { ok: false, reason: "unavailable", code: spec.reason };
      }
      appliedRecordId = spec.revisionId ?? projectId;
    } else if (preview.applyKind === "project_job") {
      if (!projectId || overlay.payload.kind !== "open_job") {
        return { ok: false, reason: "blocked", code: "project-required", preview };
      }
      const job = await deps.createProjectJob({
        mutationId,
        projectId,
        kind: overlay.payload.jobKind,
        subject: overlay.payload.subject,
        detail: overlay.payload.detail,
        waitingOnActor: overlay.payload.waitingOnActor,
        associatedPersonId: personId,
        dueAt: overlay.payload.dueAt,
        actor,
        sourceSystem: "concierge-manual",
        sourceRef: humanIntakeJobSourceRef(sourceId, candidateId),
      });
      if (!job.ok) {
        return { ok: false, reason: "unavailable", code: job.reason };
      }
      appliedRecordId = job.job.jobId;
      if (job.status === "already-present") {
        const approved = await deps.candidates.applyReview(
          candidateId,
          { action: "approve", payload: overlay.payload },
          now,
        );
        if (!approved.ok) return { ok: false, reason: "candidate-not-found" };
        await refreshSourceReview(deps, sourceId, now);
        return {
          ok: true,
          status: "already-present",
          candidateId,
          preview,
          appliedRecordKind: "project_job",
          appliedRecordId,
          record: approved.record,
        };
      }
    }

    const approved = await deps.candidates.applyReview(
      candidateId,
      { action: "approve", payload: overlay.payload },
      now,
    );
    if (!approved.ok) return { ok: false, reason: "candidate-not-found" };
    await refreshSourceReview(deps, sourceId, now);
    return {
      ok: true,
      status: "applied",
      candidateId,
      preview,
      appliedRecordKind: preview.applyKind === "none" ? null : preview.applyKind,
      appliedRecordId,
      record: approved.record,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
