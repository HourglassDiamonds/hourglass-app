"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedFounderProjectWriter } from "@/lib/continuum/client-memory/founder-project/load-writer";
import { getAuthenticatedProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/load-writer";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import { founderManualActionInput } from "@/lib/continuum/client-memory/open-projects/manual-action";
import { personProjectsForAction, type PersonActionProject } from "@/lib/continuum/client-memory/founder-project/person-projects";
import {
  warnDuplicateFounderAction,
  warnDuplicateNewProject,
  warnPossibleExistingProject,
} from "@/lib/continuum/client-memory/founder-project/duplicate";
import { applyGmailNewProjectCandidate } from "@/lib/continuum/client-memory/founder-project/apply-candidate";
import { confirmGmailPersonAssociation } from "@/lib/continuum/client-memory/founder-project/identity-gate";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import { CONCIERGE_GMAIL_INTAKE_PATH } from "@/lib/continuum/gmail/types";
import { revalidatePath } from "next/cache";
import type { CreateProjectJobResult } from "@/lib/continuum/client-memory/project-jobs/create";
import type { CreateFounderProjectResult } from "@/lib/continuum/client-memory/founder-project/create";

export type SaveFounderIntakeState = { ok: false; message: string } | null;

function parseDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  return trimmed;
}

function humanJobMessage(result: CreateProjectJobResult): string {
  if (result.ok) return "Unable to save the action.";
  if (result.code === "invalid-subject") return "Add a short action.";
  if (result.code === "person-not-on-project") {
    return "That person is not linked to this project.";
  }
  if (result.reason === "project-not-found" || result.reason === "entity-kind-mismatch") {
    return "That project could not be found.";
  }
  return "Unable to save the action.";
}

function humanCreateMessage(result: CreateFounderProjectResult): string {
  if (result.ok) return "Unable to create the project.";
  if (result.reason === "duplicate-project") {
    return result.message ?? "That project already exists for this person.";
  }
  if (result.code === "invalid-title") return "Add a project title.";
  if (result.code === "invalid-kind") return "Choose a project kind.";
  if (result.code === "lifecycle-required" || result.code === "invalid-lifecycle") {
    return "Choose a lifecycle stage.";
  }
  if (result.reason === "person-not-found") return "Choose a person.";
  return "Unable to create the project.";
}

export async function loadPersonProjectsForAction(
  personId: string,
): Promise<{ ok: true; projects: PersonActionProject[] } | { ok: false }> {
  const auth = await getAuthenticatedProjectDeskReader();
  if (!auth.ok) return { ok: false };
  try {
    const summaries = await auth.reader.listProjects();
    return { ok: true, projects: personProjectsForAction(summaries, personId) };
  } catch {
    return { ok: false };
  }
}

export async function saveFounderIntake(
  _prev: SaveFounderIntakeState,
  formData: FormData,
): Promise<SaveFounderIntakeState> {
  const intent = String(formData.get("intent") ?? "").trim();
  const mutationId = String(formData.get("mutationId") ?? "").trim();
  const personId = String(formData.get("associatedPersonId") ?? "").trim() || null;
  const subject = String(formData.get("subject") ?? "");
  const dueAt = parseDateInput(String(formData.get("dueAt") ?? ""));

  if (intent === "new-project") {
    const projectAuth = await getAuthenticatedFounderProjectWriter();
    if (!projectAuth.ok) {
      return {
        ok: false,
        message:
          projectAuth.reason === "unauthorized"
            ? "Sign in to continue."
            : "Unable to create the project.",
      };
    }
    if (!personId) return { ok: false, message: "Choose a person." };
    const linked = await projectAuth.writer.listActiveClientProjects(personId);
    const candidateAuth = await getAuthenticatedCandidateStore();
    const pending =
      candidateAuth.ok ? (await candidateAuth.store.list()).filter((row) => row.reviewStatus === "pending") : [];
    const duplicate = warnDuplicateNewProject({
      title: String(formData.get("title") ?? ""),
      personId,
      existing: linked,
      pendingCandidates: pending,
    });
    if (duplicate?.kind === "existing-project") {
      return { ok: false, message: duplicate.message };
    }
    if (duplicate && String(formData.get("confirmDuplicate") ?? "") !== "1") {
      return { ok: false, message: duplicate.message };
    }
    const possible = warnPossibleExistingProject({
      title: String(formData.get("title") ?? ""),
      existing: linked,
    });
    if (possible && String(formData.get("confirmPossibleExisting") ?? "") !== "1") {
      return { ok: false, message: possible.message };
    }
    const result = await projectAuth.writer.createProject({
      mutationId,
      title: String(formData.get("title") ?? ""),
      personId,
      projectKind: String(formData.get("projectKind") ?? "").trim(),
      lifecycleStage: String(formData.get("lifecycleStage") ?? "").trim() || null,
      subject: subject.trim() || null,
      dueAt,
      actor: projectAuth.username,
    });
    if (result.ok) {
      redirect(CONCIERGE_HOME_PATH);
    }
    return { ok: false, message: humanCreateMessage(result) };
  }

  const jobAuth = await getAuthenticatedProjectJobWriter();
  if (!jobAuth.ok) {
    return {
      ok: false,
      message:
        jobAuth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the action.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) {
    return { ok: false, message: "Choose an existing project or create a new project." };
  }
  const candidateAuth = await getAuthenticatedCandidateStore();
  const pending =
    candidateAuth.ok ? (await candidateAuth.store.list()).filter((row) => row.reviewStatus === "pending") : [];
  const duplicate = warnDuplicateFounderAction({
    subject,
    projectId,
    pendingCandidates: pending,
  });
  if (duplicate && String(formData.get("confirmDuplicate") ?? "") !== "1") {
    return { ok: false, message: duplicate.message };
  }
  const parsed = founderManualActionInput({
    mutationId,
    projectId,
    subject,
    associatedPersonId: personId,
    dueAt,
    actor: jobAuth.username,
  });
  if (!parsed.ok) {
    if (parsed.code === "lifecycle-busywork") {
      return {
        ok: false,
        message:
          "That is a project state, not an action. Write the next thing you actually need to do.",
      };
    }
    if (parsed.code === "invalid-subject") return { ok: false, message: "Add a short action." };
    if (parsed.code === "invalid-due") return { ok: false, message: "Choose a follow-up date." };
    return { ok: false, message: "Choose a project." };
  }
  const result = await jobAuth.writer.createJob(parsed.input);
  if (result.ok) {
    redirect(CONCIERGE_HOME_PATH);
  }
  return { ok: false, message: humanJobMessage(result) };
}

export type ApproveNewProjectState = { ok: false; message: string } | null;

export async function approveGmailNewProject(
  _prev: ApproveNewProjectState,
  formData: FormData,
): Promise<ApproveNewProjectState> {
  const [candidates, writer] = await Promise.all([
    getAuthenticatedCandidateStore(),
    getAuthenticatedFounderProjectWriter(),
  ]);
  if (!candidates.ok || !writer.ok) {
    return {
      ok: false,
      message: "Sign in to continue.",
    };
  }
  const result = await applyGmailNewProjectCandidate({
    store: candidates.store,
    writer: writer.writer,
    body: {
      candidateId: String(formData.get("candidateId") ?? "").trim(),
      personId: String(formData.get("personId") ?? "").trim(),
      title: String(formData.get("title") ?? ""),
      projectKind: String(formData.get("projectKind") ?? "").trim(),
      lifecycleStage: String(formData.get("lifecycleStage") ?? "").trim() || null,
      subject: String(formData.get("subject") ?? "").trim() || null,
      dueAt: parseDateInput(String(formData.get("dueAt") ?? "")),
      actor: writer.username,
      mutationId: String(formData.get("mutationId") ?? "").trim(),
      confirmPossibleExisting: String(formData.get("confirmPossibleExisting") ?? "") === "1",
    },
  });
  if (result.ok) {
    redirect(CONCIERGE_HOME_PATH);
  }
  if (result.reason === "not-new-project") {
    return { ok: false, message: "That proposal is not a new project." };
  }
  if (result.reason === "identity-unconfirmed") {
    return {
      ok: false,
      message: "Identity needs confirmation before this can become a Project.",
    };
  }
  if (result.reason === "person-mismatch") {
    return { ok: false, message: "That Person does not match the confirmed identity." };
  }
  if (result.reason === "possible-existing") {
    return {
      ok: false,
      message: result.existingTitle
        ? `Possible existing project: ${result.existingTitle}`
        : "Possible existing project",
    };
  }
  if (result.create && !result.create.ok) {
    return { ok: false, message: humanCreateMessage(result.create) };
  }
  return { ok: false, message: "Unable to create the project." };
}

export type ConfirmGmailPersonState = { ok: false; message: string } | null;

export async function confirmGmailIntakePerson(
  _prev: ConfirmGmailPersonState,
  formData: FormData,
): Promise<ConfirmGmailPersonState> {
  const [candidates, reader] = await Promise.all([
    getAuthenticatedCandidateStore(),
    getAuthenticatedClientMemoryReader(),
  ]);
  if (!candidates.ok || !reader.ok) {
    return { ok: false, message: "Sign in to continue." };
  }
  const result = await confirmGmailPersonAssociation({
    store: candidates.store,
    personExists: async (personId) => {
      const profile = await reader.reader.getPersonProfile(personId);
      return profile.ok;
    },
    body: {
      candidateId: String(formData.get("personAssociationCandidateId") ?? "").trim(),
      personId: String(formData.get("personId") ?? "").trim(),
      actor: "founder",
    },
  });
  if (result.ok) {
    revalidatePath(CONCIERGE_GMAIL_INTAKE_PATH);
    return null;
  }
  if (result.reason === "person-not-found") {
    return { ok: false, message: "Choose an existing Continuum Person." };
  }
  if (result.reason === "already-reviewed") {
    return { ok: false, message: "That identity was already reviewed." };
  }
  return { ok: false, message: "Unable to confirm that Person." };
}
