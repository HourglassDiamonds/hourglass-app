"use server";

import { redirect } from "next/navigation";
import { answerAskConciergeQuery } from "@/lib/continuum/client-memory/ask/query";
import type { AskConciergeAnswer } from "@/lib/continuum/client-memory/ask/types";
import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import {
  conciergeClientPath,
  conciergeHistoryPath,
  conciergeInboxSourcePath,
  conciergeProjectPath,
} from "@/lib/continuum/client-memory/read/presentation";
import type { ClientSearchResult } from "@/lib/continuum/client-memory/read/types";
import { isRelationshipContextLayer } from "@/lib/continuum/client-memory/contracts";
import { suggestRelationshipContextLayer } from "@/lib/continuum/client-memory/write/context";
import type { RelationshipContextLayer } from "@/lib/continuum/client-memory/types";
import { getAuthenticatedClientMemoryFactWriter } from "@/lib/continuum/client-memory/facts/load";
import type { SetManualBirthdayResult } from "@/lib/continuum/client-memory/facts/write";
import { getAuthenticatedClientMemoryPersonWriter } from "@/lib/continuum/client-memory/person/load";
import type {
  AddManualClientResult,
  EditPersonProfileResult,
} from "@/lib/continuum/client-memory/person/types";
import { getAuthenticatedClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/load";
import type { AddManualNoteResult } from "@/lib/continuum/client-memory/write/types";
import type { MutateNoteResult } from "@/lib/continuum/client-memory/write/mutate-note";
import { getAuthenticatedClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/load";
import type { CorrectProjectSpecResult } from "@/lib/continuum/client-memory/project-spec/correct";
import type { CorrectProjectKindResult } from "@/lib/continuum/client-memory/project-spec/correct-kind";
import { getAuthenticatedHumanSourceStore } from "@/lib/continuum/client-memory/human-intake/load";
import {
  HUMAN_COMMUNICATION_TYPES,
  HUMAN_SOURCE_FILE_MAX_BYTES,
  PLAUD_SOURCE_TYPE,
  decodeUtf8Bytes,
  extractPlaudRawText,
  isAllowedPlaudMime,
  plaudFileKindFromName,
  type HumanCommunicationType,
  type IngestHumanSourceResult,
} from "@/lib/continuum/client-memory/human-intake";

export type ConciergeSearchState =
  | { ok: true; results: ClientSearchResult[] }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function searchConciergeClients(
  query: string,
): Promise<ConciergeSearchState> {
  const auth = await getAuthenticatedClientMemoryReader();
  if (!auth.ok) return { ok: false, reason: auth.reason };
  try {
    const results = await auth.reader.searchPeople(query);
    return { ok: true, results };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function askConcierge(query: string): Promise<AskConciergeAnswer> {
  const auth = await getAuthenticatedClientMemoryReader();
  if (!auth.ok) return { kind: "error" };
  return answerAskConciergeQuery(auth.reader, query);
}

export type SaveManualNoteState = {
  ok: false;
  message: string;
};

function humanSaveMessage(result: AddManualNoteResult): string {
  if (result.ok) return "Unable to save the note.";
  if (result.reason === "invalid-input" && result.code === "empty-note") {
    return "Enter a note before saving.";
  }
  if (result.reason === "project-not-linked") {
    return "That project isn't linked to this person.";
  }
  return "Unable to save the note.";
}

export async function saveManualConciergeNote(
  _prev: SaveManualNoteState | null,
  formData: FormData,
): Promise<SaveManualNoteState> {
  const auth = await getAuthenticatedClientMemoryNoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the note.",
    };
  }

  const personId = String(formData.get("personId") ?? "").trim();
  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const contextLayerRaw = String(formData.get("contextLayer") ?? "").trim();
  const noteText = String(formData.get("noteText") ?? "");
  const projectIdRaw = String(formData.get("projectId") ?? "").trim();

  if (!isRelationshipContextLayer(contextLayerRaw)) {
    return { ok: false, message: "Unable to save the note." };
  }

  const result = await auth.writer.addManualNote({
    submissionId,
    personId,
    projectId: projectIdRaw || null,
    contextLayer: contextLayerRaw,
    noteText,
    actor: auth.username,
  });

  if (result.ok) {
    redirect(`${conciergeClientPath(personId)}?saved=1`);
  }

  return { ok: false, message: humanSaveMessage(result) };
}

export type MutateNoteState = {
  ok: false;
  message: string;
};

function historyReturn(formData: FormData, personId: string, extra?: Record<string, string>) {
  const pageRaw = String(formData.get("page") ?? "").trim();
  const page = Number(pageRaw);
  const source = String(formData.get("source") ?? "").trim() || null;
  const lifecycleRaw = String(formData.get("lifecycle") ?? "").trim();
  const base = conciergeHistoryPath(personId, {
    page: Number.isInteger(page) && page > 1 ? page : undefined,
    source,
    lifecycle: lifecycleRaw === "trashed" ? "trashed" : null,
  });
  if (!extra) return base;
  const extraParams = new URLSearchParams();
  for (const [key, value] of Object.entries(extra)) extraParams.set(key, value);
  const extraEncoded = extraParams.toString();
  return extraEncoded
    ? `${base}${base.includes("?") ? "&" : "?"}${extraEncoded}`
    : base;
}

function noteReturnPath(
  formData: FormData,
  personId: string,
  extra?: Record<string, string>,
): string {
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  if (returnTo === "history") return historyReturn(formData, personId, extra);
  const params = new URLSearchParams(extra ?? {});
  const encoded = params.toString();
  const base = conciergeClientPath(personId);
  return encoded ? `${base}?${encoded}` : base;
}

function humanMutateMessage(result: MutateNoteResult, verb: string): string {
  if (result.ok) return `Unable to ${verb} the note.`;
  if (result.reason === "invalid-input" && result.code === "empty-note") {
    return "Enter a note before saving.";
  }
  if (result.reason === "invalid-input" && result.code === "cross-person-unconfirmed") {
    return "Confirm moving this note to a different person.";
  }
  if (result.reason === "project-not-linked") {
    return "That project isn't linked to this person.";
  }
  if (result.reason === "entity-kind-mismatch") {
    return "That project could not be used.";
  }
  if (result.reason === "person-not-found") {
    return "That person could not be found.";
  }
  if (result.reason === "note-not-found") {
    return "This note could not be found.";
  }
  return `Unable to ${verb} the note.`;
}

export type SaveProjectSpecCorrectionState = {
  ok: false;
  message: string;
};

function humanSpecCorrectionMessage(result: CorrectProjectSpecResult): string {
  if (result.ok) return "Unable to save the correction.";
  if (result.reason === "invalid-input" && result.code === "implausible-finger-size") {
    return "That finger size isn't plausible. Enter the real size without changing nearby fields.";
  }
  if (result.reason === "invalid-input" && result.code === "invalid-value") {
    return "That value couldn't be saved.";
  }
  if (result.reason === "invalid-input" && result.code === "invalid-field") {
    return "That detail can't be corrected here.";
  }
  if (result.reason === "entity-kind-mismatch" || result.reason === "project-not-found") {
    return "That project could not be found.";
  }
  if (result.reason === "project-history-not-found") {
    return "This project has no details to correct yet.";
  }
  return "Unable to save the correction.";
}

export async function saveProjectSpecCorrection(
  _prev: SaveProjectSpecCorrectionState | null,
  formData: FormData,
): Promise<SaveProjectSpecCorrectionState> {
  const auth = await getAuthenticatedClientMemoryProjectSpecWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the correction.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const result = await auth.writer.correctProjectSpec({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    fieldName: String(formData.get("fieldName") ?? "").trim(),
    newValue: String(formData.get("newValue") ?? ""),
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeProjectPath(projectId)}?saved=spec`);
  }
  return { ok: false, message: humanSpecCorrectionMessage(result) };
}

export type SaveProjectKindCorrectionState = {
  ok: false;
  message: string;
};

function humanKindCorrectionMessage(result: CorrectProjectKindResult): string {
  if (result.ok) return "Unable to save the correction.";
  if (result.reason === "invalid-input" && result.code === "invalid-value") {
    return "That project kind couldn't be saved.";
  }
  if (result.reason === "entity-kind-mismatch" || result.reason === "project-not-found") {
    return "That project could not be found.";
  }
  if (result.reason === "project-history-not-found") {
    return "This project has no details to correct yet.";
  }
  return "Unable to save the correction.";
}

export async function saveProjectKindCorrection(
  _prev: SaveProjectKindCorrectionState | null,
  formData: FormData,
): Promise<SaveProjectKindCorrectionState> {
  const auth = await getAuthenticatedClientMemoryProjectSpecWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the correction.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const result = await auth.writer.correctProjectKind({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    newValue: String(formData.get("newValue") ?? ""),
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeProjectPath(projectId)}?saved=kind`);
  }
  return { ok: false, message: humanKindCorrectionMessage(result) };
}

export async function editConciergeNote(
  _prev: MutateNoteState | null,
  formData: FormData,
): Promise<MutateNoteState> {
  const auth = await getAuthenticatedClientMemoryNoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the note.",
    };
  }
  const personId = String(formData.get("personId") ?? "").trim();
  const result = await auth.writer.editNote({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    noteId: String(formData.get("noteId") ?? "").trim(),
    noteText: String(formData.get("noteText") ?? ""),
    actor: auth.username,
  });
  if (result.ok) {
    redirect(noteReturnPath(formData, personId, { saved: "note" }));
  }
  return { ok: false, message: humanMutateMessage(result, "save") };
}

export async function moveConciergeNote(
  _prev: MutateNoteState | null,
  formData: FormData,
): Promise<MutateNoteState> {
  const auth = await getAuthenticatedClientMemoryNoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to move the note.",
    };
  }
  const contextLayerRaw = String(formData.get("contextLayer") ?? "").trim();
  if (!isRelationshipContextLayer(contextLayerRaw)) {
    return { ok: false, message: "Unable to move the note." };
  }
  const currentPersonId = String(formData.get("currentPersonId") ?? "").trim();
  const targetPersonId = String(formData.get("personId") ?? "").trim();
  const confirmed = String(formData.get("crossPersonConfirmed") ?? "") === "1";
  const result = await auth.writer.moveNote({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    noteId: String(formData.get("noteId") ?? "").trim(),
    personId: targetPersonId,
    projectId: String(formData.get("projectId") ?? "").trim() || null,
    contextLayer: contextLayerRaw,
    actor: auth.username,
    crossPersonConfirmed: confirmed,
  });
  if (result.ok) {
    redirect(`${conciergeClientPath(targetPersonId || currentPersonId)}?moved=1`);
  }
  return { ok: false, message: humanMutateMessage(result, "move") };
}

export async function trashConciergeNote(
  _prev: MutateNoteState | null,
  formData: FormData,
): Promise<MutateNoteState> {
  const auth = await getAuthenticatedClientMemoryNoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to trash the note.",
    };
  }
  const personId = String(formData.get("personId") ?? "").trim();
  const result = await auth.writer.trashNote({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    noteId: String(formData.get("noteId") ?? "").trim(),
    actor: auth.username,
  });
  if (result.ok) {
    redirect(noteReturnPath(formData, personId, { trashed: "1" }));
  }
  return { ok: false, message: humanMutateMessage(result, "trash") };
}

export async function restoreConciergeNote(
  _prev: MutateNoteState | null,
  formData: FormData,
): Promise<MutateNoteState> {
  const auth = await getAuthenticatedClientMemoryNoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to restore the note.",
    };
  }
  const personId = String(formData.get("personId") ?? "").trim();
  const result = await auth.writer.restoreNote({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    noteId: String(formData.get("noteId") ?? "").trim(),
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeHistoryPath(personId)}?restored=1`);
  }
  return { ok: false, message: humanMutateMessage(result, "restore") };
}

export type SaveManualBirthdayState = {
  ok: false;
  message: string;
};

function humanBirthdayMessage(result: SetManualBirthdayResult): string {
  if (result.ok) return "Unable to save the birthday.";
  if (result.reason === "invalid-input" && result.code === "missing-month") {
    return "Choose a month.";
  }
  if (result.reason === "invalid-input" && result.code === "invalid-month") {
    return "Choose a month.";
  }
  if (result.reason === "invalid-input" && result.code === "invalid-day") {
    return "That day isn't valid for the selected month.";
  }
  if (result.reason === "invalid-input" && result.code === "invalid-year") {
    return "Enter a valid year, or leave year blank.";
  }
  if (result.reason === "person-not-found") {
    return "This person could not be found.";
  }
  return "Unable to save the birthday.";
}

export async function saveManualBirthday(
  _prev: SaveManualBirthdayState | null,
  formData: FormData,
): Promise<SaveManualBirthdayState> {
  const auth = await getAuthenticatedClientMemoryFactWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the birthday.",
    };
  }

  const personId = String(formData.get("personId") ?? "").trim();
  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const monthRaw = String(formData.get("month") ?? "").trim();
  const dayRaw = String(formData.get("day") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();

  const result = await auth.writer.setManualBirthday({
    personId,
    submissionId,
    month: monthRaw,
    day: dayRaw || null,
    year: yearRaw || null,
  });

  if (result.ok) {
    redirect(`${conciergeClientPath(personId)}?saved=birthday`);
  }

  return { ok: false, message: humanBirthdayMessage(result) };
}

export type SaveManualClientState = {
  ok: false;
  message: string;
  conflictingPersonIds?: string[];
};

function humanClientMessage(result: AddManualClientResult): string {
  if (result.status === "validation-error") return result.message;
  if (result.status === "identity-conflict") {
    return "These contact details match different people already in Continuum. Nothing was changed.";
  }
  return "Unable to save the client.";
}

export async function saveManualClient(
  _prev: SaveManualClientState | null,
  formData: FormData,
): Promise<SaveManualClientState> {
  const auth = await getAuthenticatedClientMemoryPersonWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the client.",
    };
  }

  const result = await auth.writer.addManualClient({
    submissionId: String(formData.get("submissionId") ?? ""),
    givenName: String(formData.get("givenName") ?? ""),
    familyName: String(formData.get("familyName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    organization: String(formData.get("organization") ?? ""),
  });

  if (result.status === "created") {
    redirect(`${conciergeClientPath(result.personId)}?saved=client`);
  }
  if (result.status === "existing-person") {
    redirect(`${conciergeClientPath(result.personId)}?existing=client`);
  }

  return {
    ok: false,
    message: humanClientMessage(result),
    conflictingPersonIds:
      result.status === "identity-conflict" ? result.conflictingPersonIds : undefined,
  };
}

export type SavePersonProfileState = {
  ok: false;
  message: string;
  conflictingPersonIds?: string[];
};

function humanProfileMessage(result: EditPersonProfileResult): string {
  if (result.status === "validation-error") return result.message;
  if (result.status === "identity-conflict") {
    return "These contact details match a different person already in Continuum. Nothing was changed.";
  }
  if (result.status === "person-not-found") {
    return "This person could not be found.";
  }
  return "Unable to save the profile.";
}

export async function savePersonProfile(
  _prev: SavePersonProfileState | null,
  formData: FormData,
): Promise<SavePersonProfileState> {
  const auth = await getAuthenticatedClientMemoryPersonWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the profile.",
    };
  }

  const personId = String(formData.get("personId") ?? "").trim();
  const result = await auth.writer.editPersonProfile({
    personId,
    submissionId: String(formData.get("submissionId") ?? ""),
    givenName: String(formData.get("givenName") ?? ""),
    familyName: String(formData.get("familyName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    organization: String(formData.get("organization") ?? ""),
  });

  if (result.status === "updated") {
    redirect(`${conciergeClientPath(result.personId)}?saved=profile`);
  }

  return {
    ok: false,
    message: humanProfileMessage(result),
    conflictingPersonIds:
      result.status === "identity-conflict" ? result.conflictingPersonIds : undefined,
  };
}

export type LinkedProjectOption = {
  id: string;
  title: string;
};

export async function loadLinkedProjectsForPerson(
  personId: string,
): Promise<
  | {
      ok: true;
      projects: LinkedProjectOption[];
      suggestedContext: RelationshipContextLayer | null;
    }
  | { ok: false }
> {
  const auth = await getAuthenticatedClientMemoryReader();
  if (!auth.ok) return { ok: false };
  try {
    const result = await auth.reader.getPersonProfile(personId);
    if (!result.ok) {
      return { ok: true, projects: [], suggestedContext: null };
    }
    return {
      ok: true,
      projects: result.profile.projects.map((project) => ({
        id: project.profile.projectId,
        title: project.profile.displayTitle,
      })),
      suggestedContext: suggestRelationshipContextLayer(result.profile.person.roles),
    };
  } catch {
    return { ok: false };
  }
}

export type SavePlaudSourceState = {
  ok: false;
  message: string;
};

function isCommunicationType(value: string): value is HumanCommunicationType {
  return (HUMAN_COMMUNICATION_TYPES as readonly string[]).includes(value);
}

function humanPlaudMessage(result: IngestHumanSourceResult): string {
  if (result.ok) return "Unable to save the source.";
  if (result.reason === "invalid-input" && result.code === "empty-text") {
    return "Paste a transcript or choose a file.";
  }
  if (result.reason === "invalid-input" && result.code === "oversized-text") {
    return "That transcript is too long to store.";
  }
  if (result.reason === "invalid-input" && result.code === "oversized-file") {
    return "That file is too large.";
  }
  if (result.reason === "entity-not-found" || result.reason === "entity-kind-mismatch") {
    return "That person or project could not be used.";
  }
  if (result.reason === "idempotency-conflict") {
    return "This source conflicts with a record already stored.";
  }
  return "Unable to save the source.";
}

async function plaudTextFromForm(formData: FormData): Promise<
  | { ok: true; text: string; file: { bytes: Uint8Array; mimeType: string; fileName: string } | null }
  | { ok: false; message: string }
> {
  const pasted = String(formData.get("transcript") ?? "");
  const fileValue = formData.get("transcriptFile");
  const file =
    fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  if (!file) {
    return { ok: true, text: pasted, file: null };
  }
  if (file.size > HUMAN_SOURCE_FILE_MAX_BYTES) {
    return { ok: false, message: "That file is too large." };
  }
  const kind = plaudFileKindFromName(file.name);
  if (!kind) {
    return { ok: false, message: "Use a .txt, .vtt, .json, or .md file." };
  }
  if (!isAllowedPlaudMime(file.type)) {
    return { ok: false, message: "Use a .txt, .vtt, .json, or .md file." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoded = decodeUtf8Bytes(bytes);
  if (decoded == null) {
    return { ok: false, message: "That file could not be read as text." };
  }
  return {
    ok: true,
    text: extractPlaudRawText({ kind, decoded }),
    file: {
      bytes,
      mimeType: file.type || "text/plain",
      fileName: file.name,
    },
  };
}

export async function savePlaudHumanSource(
  _prev: SavePlaudSourceState | null,
  formData: FormData,
): Promise<SavePlaudSourceState> {
  const auth = await getAuthenticatedHumanSourceStore();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the source.",
    };
  }

  const parsed = await plaudTextFromForm(formData);
  if (!parsed.ok) return parsed;

  const communicationRaw = String(formData.get("communicationType") ?? "").trim();
  const communicationType = isCommunicationType(communicationRaw)
    ? communicationRaw
    : "unknown";
  if (communicationType === "handwritten") {
    return { ok: false, message: "Unable to save the source." };
  }

  const contextRaw = String(formData.get("contextLayer") ?? "").trim();
  const contextLayer = contextRaw
    ? isRelationshipContextLayer(contextRaw)
      ? contextRaw
      : null
    : null;
  if (contextRaw && !contextLayer) {
    return { ok: false, message: "Unable to save the source." };
  }

  const personId = String(formData.get("personId") ?? "").trim() || null;
  const projectId = String(formData.get("projectId") ?? "").trim() || null;

  const result = await auth.store.ingest({
    sourceType: PLAUD_SOURCE_TYPE,
    rawText: parsed.text,
    rawFile: parsed.file,
    reportedCommunicationType: communicationType,
    contextLayerConfirmed: contextLayer,
    contextLayerProposed: contextLayer,
    personId,
    projectId,
  });

  if (result.ok) {
    redirect(conciergeInboxSourcePath(result.sourceId));
  }
  return { ok: false, message: humanPlaudMessage(result) };
}
