/**
 * Domain Add Note writer. Append-only source notes.
 * Does not create Facts, Wishes, or kernel Observations.
 * Does not log note text.
 */

import { randomUUID } from "node:crypto";
import { isRelationshipContextLayer } from "../contracts";
import type { ClientMemoryEntity, SourceNote } from "../types";
import {
  CONCIERGE_MANUAL_SOURCE_ARTIFACT,
  CONCIERGE_MANUAL_SOURCE_FIELD,
  CONCIERGE_MANUAL_SOURCE_SHEET,
  CONCIERGE_MANUAL_SOURCE_SYSTEM,
  MANUAL_NOTE_MAX_LENGTH,
  conciergeManualImportRowKey,
  type AddManualNoteInput,
  type AddManualNoteResult,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ManualNoteInsertStatus = "inserted" | "duplicate-key";

export type ManualNoteWriteDeps = {
  nowIso: () => string;
  newNoteId: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  hasActiveClientProjectLink: (
    personId: string,
    projectId: string,
  ) => Promise<boolean>;
  insertNote: (row: SourceNote) => Promise<ManualNoteInsertStatus>;
  findNoteByIdentity: (input: {
    sourceSystem: SourceNote["sourceSystem"];
    importRowKey: string;
    sourceField: string;
  }) => Promise<SourceNote | null>;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function notesMatch(existing: SourceNote, incoming: SourceNote): boolean {
  return (
    existing.personId === incoming.personId &&
    (existing.projectId ?? null) === (incoming.projectId ?? null) &&
    existing.contextLayer === incoming.contextLayer &&
    existing.noteText === incoming.noteText &&
    existing.sourceSystem === incoming.sourceSystem &&
    existing.sourceField === incoming.sourceField
  );
}

export async function addManualNote(
  deps: ManualNoteWriteDeps,
  input: AddManualNoteInput,
): Promise<AddManualNoteResult> {
  const submissionId = input.submissionId.trim();
  const personId = input.personId.trim();
  if (!isUuid(submissionId) || !isUuid(personId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  if (!isRelationshipContextLayer(input.contextLayer)) {
    return { ok: false, reason: "invalid-input", code: "invalid-context" };
  }

  const noteText = input.noteText.trim();
  if (!noteText) {
    return { ok: false, reason: "invalid-input", code: "empty-note" };
  }
  if (noteText.length > MANUAL_NOTE_MAX_LENGTH) {
    return { ok: false, reason: "invalid-input", code: "oversized-note" };
  }

  const requestedProjectId = normalizeOptionalId(input.projectId);
  if (requestedProjectId && !isUuid(requestedProjectId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  if (requestedProjectId && input.contextLayer !== "client") {
    return { ok: false, reason: "invalid-input", code: "project-not-allowed" };
  }

  try {
    const person = await deps.getEntity(personId);
    if (!person || person.kind !== "person") {
      return { ok: false, reason: "person-not-found" };
    }

    let projectId: string | null = null;
    if (requestedProjectId) {
      const project = await deps.getEntity(requestedProjectId);
      if (!project || project.kind !== "project") {
        return { ok: false, reason: "project-not-linked" };
      }
      const linked = await deps.hasActiveClientProjectLink(
        personId,
        requestedProjectId,
      );
      if (!linked) return { ok: false, reason: "project-not-linked" };
      projectId = requestedProjectId;
    }

    const row: SourceNote = {
      id: deps.newNoteId(),
      personId,
      projectId,
      contextLayer: input.contextLayer,
      sourceSystem: CONCIERGE_MANUAL_SOURCE_SYSTEM,
      sourceArtifact: CONCIERGE_MANUAL_SOURCE_ARTIFACT,
      sourceSheet: CONCIERGE_MANUAL_SOURCE_SHEET,
      sourceField: CONCIERGE_MANUAL_SOURCE_FIELD,
      importRowKey: conciergeManualImportRowKey(submissionId),
      gmailThreadId: null,
      noteText,
      createdAt: deps.nowIso(),
    };

    const status = await deps.insertNote(row);
    if (status === "inserted") {
      return { ok: true, noteId: row.id, status: "inserted" };
    }

    const existing = await deps.findNoteByIdentity({
      sourceSystem: row.sourceSystem,
      importRowKey: row.importRowKey,
      sourceField: row.sourceField,
    });
    if (!existing) {
      return {
        ok: false,
        reason: "unavailable",
        operationId: randomUUID(),
      };
    }
    if (notesMatch(existing, row)) {
      return { ok: true, noteId: existing.id, status: "already-present" };
    }
    return { ok: false, reason: "idempotency-conflict" };
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      operationId: randomUUID(),
    };
  }
}
