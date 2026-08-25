"use server";

import { redirect } from "next/navigation";
import { answerAskConciergeQuery } from "@/lib/continuum/client-memory/ask/query";
import type { AskConciergeAnswer } from "@/lib/continuum/client-memory/ask/types";
import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import { conciergeClientPath } from "@/lib/continuum/client-memory/read/presentation";
import type { ClientSearchResult } from "@/lib/continuum/client-memory/read/types";
import { isRelationshipContextLayer } from "@/lib/continuum/client-memory/contracts";
import { getAuthenticatedClientMemoryFactWriter } from "@/lib/continuum/client-memory/facts/load";
import type { SetManualBirthdayResult } from "@/lib/continuum/client-memory/facts/write";
import { getAuthenticatedClientMemoryPersonWriter } from "@/lib/continuum/client-memory/person/load";
import type {
  AddManualClientResult,
  EditPersonProfileResult,
} from "@/lib/continuum/client-memory/person/types";
import { getAuthenticatedClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/load";
import type { AddManualNoteResult } from "@/lib/continuum/client-memory/write/types";

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
  });

  if (result.ok) {
    redirect(`${conciergeClientPath(personId)}?saved=1`);
  }

  return { ok: false, message: humanSaveMessage(result) };
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
