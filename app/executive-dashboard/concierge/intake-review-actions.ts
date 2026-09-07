"use server";

import { getAuthenticatedHumanSourceStore } from "@/lib/continuum/client-memory/human-intake/load";
import { getAuthenticatedClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/load";
import { getAuthenticatedClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/load";
import { getAuthenticatedProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/load-writer";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import { CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE } from "@/lib/continuum/candidates/activation";
import { reviewHumanIntakeCandidate } from "@/lib/continuum/human-intake/review/apply";
import type { HumanIntakeCandidateEdits } from "@/lib/continuum/human-intake/review/apply";

export type ReviewIntakeCandidateState = {
  ok: boolean;
  message: string;
} | null;

function editsFromForm(formData: FormData): HumanIntakeCandidateEdits {
  const personId = String(formData.get("personId") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const noteText = String(formData.get("noteText") ?? "");
  const specValue = String(formData.get("specValue") ?? "").trim();
  const jobKind = String(formData.get("jobKind") ?? "").trim();
  const jobSubject = String(formData.get("jobSubject") ?? "").trim();
  const waitingOnActor = String(formData.get("waitingOnActor") ?? "").trim();
  const dueAt = String(formData.get("dueAt") ?? "").trim();
  return {
    personId: personId || undefined,
    projectId: projectId || undefined,
    noteText: noteText || undefined,
    specValue: specValue || undefined,
    jobKind: jobKind || undefined,
    jobSubject: jobSubject || undefined,
    waitingOnActor: waitingOnActor || undefined,
    dueAt: dueAt || undefined,
  };
}

export async function reviewIntakeCandidateAction(
  _prev: ReviewIntakeCandidateState,
  formData: FormData,
): Promise<ReviewIntakeCandidateState> {
  const action = String(formData.get("action") ?? "").trim();
  const candidateId = String(formData.get("candidateId") ?? "").trim();
  const sourceId = String(formData.get("sourceId") ?? "").trim();
  const mutationId = String(formData.get("mutationId") ?? "").trim();
  if (
    action !== "approve" &&
    action !== "edit" &&
    action !== "discard" &&
    action !== "defer"
  ) {
    return { ok: false, message: "Choose a review action." };
  }

  const sources = await getAuthenticatedHumanSourceStore();
  if (!sources.ok) {
    return {
      ok: false,
      message:
        sources.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to review this candidate.",
    };
  }
  const durable = await getAuthenticatedCandidateStore();
  if (!durable.ok) {
    return {
      ok: false,
      message:
        durable.reason === "not-activated"
          ? CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE
          : durable.reason === "unauthorized"
            ? "Sign in to continue."
            : "Unable to review this candidate.",
    };
  }
  const notes = await getAuthenticatedClientMemoryNoteWriter();
  const specs = await getAuthenticatedClientMemoryProjectSpecWriter();
  const jobs = await getAuthenticatedProjectJobWriter();
  if (!notes.ok || !specs.ok || !jobs.ok) {
    return { ok: false, message: "Unable to review this candidate." };
  }

  const source = await sources.store.getSource(sourceId);
  if (!source) return { ok: false, message: "That source could not be found." };

  const result = await reviewHumanIntakeCandidate(
    {
      nowIso: () => new Date().toISOString(),
      candidates: durable.store,
      getSource: (id) => sources.store.getSource(id),
      listLinks: (id) => sources.store.listLinks(id),
      getPersonName: (id) => sources.store.getPersonName(id),
      getProjectTitle: (id) => sources.store.getProjectTitle(id),
      personOnProject: async () => null,
      updateSourceReviewStatus: (id, status, updatedAt) =>
        sources.store.updateSourceReviewStatus(id, status, updatedAt),
      confirmSourceLink: (input) => sources.store.confirmSourceLink(input),
      addManualNote: (input) => notes.writer.addManualNote(input),
      correctProjectSpec: (input) => specs.writer.correctProjectSpec(input),
      createProjectJob: (input) => jobs.writer.createJob(input),
    },
    {
      candidateId,
      action,
      actor: notes.username,
      mutationId,
      edits: editsFromForm(formData),
    },
  );

  if (!result.ok) {
    if (result.reason === "blocked") {
      return {
        ok: false,
        message: result.preview?.summary ?? "This candidate cannot be applied yet.",
      };
    }
    if (result.reason === "unauthorized-state") {
      return { ok: false, message: "That candidate was already approved." };
    }
    if (result.code === "writer-committed-review-unpersisted") {
      return {
        ok: false,
        message:
          "The canonical write succeeded, but Candidate review state did not persist. Retry this approval.",
      };
    }
    return { ok: false, message: "Unable to review this candidate." };
  }
  if (result.status === "discarded") {
    return { ok: true, message: "Discarded. No canonical memory was written." };
  }
  if (result.status === "deferred") {
    return { ok: true, message: "Saved for later. No canonical memory was written." };
  }
  if (result.status === "edited") {
    return { ok: true, message: "Edit saved. Continuum has not written canonical memory." };
  }
  return { ok: true, message: result.preview.summary };
}
