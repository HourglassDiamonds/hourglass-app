/**
 * Founder review apply for Calendar association Candidates.
 * Uses frozen #17 review_status. Calendar source-link writer only after approve.
 * Does not mint/merge People, change Kind/lifecycle, create Open Jobs,
 * or send communications. Does not call the Human Intake source-link writer.
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
import { CALENDAR_SOURCE_SYSTEM } from "../types";
import { parseCalendarCandidateSourceRef } from "./source-ref";
import { previewCalendarAssociationApply } from "./preview";
import type { CalendarAssociationWriter } from "./writer";

export const CALENDAR_ASSOCIATION_APPROVE_WRITE_ORDER = [
  "load-durable-candidate",
  "preview-effective-payload",
  "calendar-source-link-writer",
  "persist-founder-approval",
] as const;

export type CalendarAssociationReviewAction =
  | "approve"
  | "edit"
  | "discard"
  | "defer";

export type CalendarAssociationEdits = {
  personId?: string | null;
  projectId?: string | null;
};

export type ReviewCalendarAssociationInput = {
  candidateId: string;
  action: CalendarAssociationReviewAction;
  actor: string;
  mutationId: string;
  edits?: CalendarAssociationEdits | null;
};

export type ReviewCalendarAssociationResult =
  | {
      ok: true;
      status: "applied" | "already-present" | "discarded" | "deferred" | "edited";
      candidateId: string;
      preview: ReturnType<typeof previewCalendarAssociationApply>;
      appliedRecordKind: "source_link" | null;
      appliedRecordId: string | null;
      record: ContinuumCandidate;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "unauthorized-state"
        | "candidate-not-found"
        | "blocked"
        | "unavailable";
      code?: string;
      preview?: ReturnType<typeof previewCalendarAssociationApply>;
    };

export type ReviewCalendarAssociationDeps = {
  nowIso: () => string;
  candidates: CandidateStore;
  writer: CalendarAssociationWriter;
  getPersonName: (id: string) => Promise<string | null>;
  getProjectTitle: (id: string) => Promise<string | null>;
};

function overlayFromEdits(
  row: ContinuumCandidate,
  edits: CalendarAssociationEdits | null | undefined,
): { payload: CandidatePayload; proposedTarget: ProposedCanonicalTarget } {
  const payload = { ...effectiveCandidatePayload(row) };
  let target = { ...effectiveCandidateTarget(row) };
  if (!edits) return { payload, proposedTarget: target };
  if (
    edits.personId !== undefined &&
    (target.kind === "person" || payload.kind === "person_association")
  ) {
    target = { kind: "person", personId: edits.personId };
  }
  if (
    edits.projectId !== undefined &&
    (target.kind === "project" || payload.kind === "project_association")
  ) {
    target = { kind: "project", projectId: edits.projectId };
  }
  return { payload, proposedTarget: target };
}

function reviewInputFor(
  action: CalendarAssociationReviewAction,
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

export async function reviewCalendarAssociationCandidate(
  deps: ReviewCalendarAssociationDeps,
  input: ReviewCalendarAssociationInput,
): Promise<ReviewCalendarAssociationResult> {
  const candidateId = input.candidateId.trim();
  const mutationId = input.mutationId.trim();
  if (!candidateId || !mutationId || !input.actor.trim()) {
    return { ok: false, reason: "invalid-input" };
  }
  try {
    const existing = await deps.candidates.get(candidateId);
    if (!existing) return { ok: false, reason: "candidate-not-found" };
    if (existing.sourceSystem !== CALENDAR_SOURCE_SYSTEM) {
      return { ok: false, reason: "invalid-input", code: "not-calendar" };
    }
    if (existing.reviewStatus === "approved" && input.action !== "approve") {
      return { ok: false, reason: "unauthorized-state" };
    }

    const overlay = overlayFromEdits(existing, input.edits);
    const working = applyFounderReview(
      existing,
      reviewInputFor("edit", overlay),
      deps.nowIso(),
    );
    const personId =
      overlay.proposedTarget.kind === "person"
        ? overlay.proposedTarget.personId
        : null;
    const projectId =
      overlay.proposedTarget.kind === "project"
        ? overlay.proposedTarget.projectId
        : null;
    const preview = previewCalendarAssociationApply({
      candidate: working,
      personName: personId ? await deps.getPersonName(personId) : null,
      projectTitle: projectId ? await deps.getProjectTitle(projectId) : null,
    });
    const now = deps.nowIso();

    if (input.action === "edit") {
      const saved = await deps.candidates.applyReview(
        candidateId,
        {
          action: "edit",
          payload: overlay.payload,
          proposedTarget: overlay.proposedTarget,
        },
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

    if (input.action === "discard" || input.action === "defer") {
      const saved = await deps.candidates.applyReview(
        candidateId,
        reviewInputFor(input.action, overlay),
        now,
      );
      if (!saved.ok) return { ok: false, reason: "candidate-not-found" };
      return {
        ok: true,
        status: input.action === "discard" ? "discarded" : "deferred",
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
        appliedRecordKind: preview.applyKind === "source_link" ? "source_link" : null,
        appliedRecordId: null,
        record: existing,
      };
    }

    if (!preview.canApply) {
      return { ok: false, reason: "blocked", code: preview.blockers[0], preview };
    }

    const packed = parseCalendarCandidateSourceRef(existing.sourceRef);
    if (!packed) {
      return { ok: false, reason: "blocked", code: "invalid-calendar-source-ref", preview };
    }

    let appliedRecordId: string | null = null;
    let writerCommitted = false;
    let writerAlreadyPresent = false;
    if (preview.applyKind === "source_link") {
      const entityKind =
        overlay.payload.kind === "person_association" ? "person" : "project";
      const entityId = entityKind === "person" ? personId : projectId;
      if (!entityId) {
        return { ok: false, reason: "blocked", code: "entity-required", preview };
      }
      const emailHash =
        overlay.payload.kind === "person_association"
          ? overlay.payload.emailHash
          : null;
      const link = await deps.writer.confirmSourceLink({
        sourceRef: existing.sourceRef,
        calendarId: packed.calendarId,
        calendarEventId: packed.calendarEventId,
        entityId,
        entityKind,
        participantEmailHash: emailHash,
        createdAt: now,
      });
      if (entityKind === "person" && emailHash) {
        await deps.writer.confirmParticipantMapping({
          emailHash,
          personId: entityId,
          confirmedAt: now,
        });
      }
      appliedRecordId = entityId;
      writerCommitted = true;
      writerAlreadyPresent = link === "already-present";
    }

    const approved = await deps.candidates.applyReview(
      candidateId,
      { action: "approve", payload: overlay.payload },
      now,
    );
    if (!approved.ok) {
      return {
        ok: false,
        reason: "unavailable",
        code: writerCommitted
          ? "writer-committed-review-unpersisted"
          : "review-persist-failed",
        preview,
      };
    }
    return {
      ok: true,
      status: writerAlreadyPresent ? "already-present" : "applied",
      candidateId,
      preview,
      appliedRecordKind: preview.applyKind === "source_link" ? "source_link" : null,
      appliedRecordId,
      record: approved.record,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
