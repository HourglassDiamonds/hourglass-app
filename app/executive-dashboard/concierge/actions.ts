"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import { conciergeClientPath } from "@/lib/continuum/client-memory/read/presentation";
import type { ClientSearchResult } from "@/lib/continuum/client-memory/read/types";
import { isRelationshipContextLayer } from "@/lib/continuum/client-memory/contracts";
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
