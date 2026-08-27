/**
 * Atomic source-note mutations. Same row identity for edit / move / trash / restore.
 * Writes a prior-state revision and updates the current note together.
 * Does not create a corrected copy. Does not log note text.
 */

import { randomUUID } from "node:crypto";
import {
  isRelationshipContextLayer,
  isSourceNoteChangeKind,
} from "../contracts";
import {
  classifySourceNoteLifecycle,
  type ClientMemoryEntity,
  type SourceNote,
  type SourceNoteChangeKind,
  type SourceNoteLifecycleStatus,
  type SourceNoteRevision,
} from "../types";
import { MANUAL_NOTE_MAX_LENGTH } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MutateNoteInvalidCode =
  | "empty-note"
  | "oversized-note"
  | "invalid-context"
  | "invalid-id"
  | "invalid-kind"
  | "project-not-allowed"
  | "cross-person-unconfirmed";

export type MutateNoteResult =
  | {
      ok: true;
      noteId: string;
      status: "updated" | "already-present";
      revisionId: string | null;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "note-not-found"
        | "person-not-found"
        | "project-not-linked"
        | "entity-kind-mismatch"
        | "not-editable"
        | "not-trashed"
        | "unavailable";
      code?: MutateNoteInvalidCode;
      operationId?: string;
    };

export type EditSourceNoteInput = {
  mutationId: string;
  noteId: string;
  noteText: string;
  actor: string;
};

export type MoveSourceNoteInput = {
  mutationId: string;
  noteId: string;
  personId: string;
  projectId?: string | null;
  contextLayer: SourceNote["contextLayer"];
  actor: string;
  crossPersonConfirmed?: boolean;
};

export type LifecycleSourceNoteInput = {
  mutationId: string;
  noteId: string;
  actor: string;
};

export type NoteMutationApplyInput = {
  mutationId: string;
  revisionId: string;
  changeKind: SourceNoteChangeKind;
  editedAt: string;
  editedBy: string;
  prior: SourceNote;
  next: SourceNote;
};

export type NoteMutationApplyResult =
  | {
      status: "updated" | "already-present";
      note: SourceNote;
      revisionId: string | null;
    };

export type MutateNoteDeps = {
  nowIso: () => string;
  newRevisionId: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getNote: (id: string) => Promise<SourceNote | null>;
  hasActiveClientProjectLink: (
    personId: string,
    projectId: string,
  ) => Promise<boolean>;
  applyMutation: (
    input: NoteMutationApplyInput,
  ) => Promise<NoteMutationApplyResult>;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function unavailable(): MutateNoteResult {
  return { ok: false, reason: "unavailable", operationId: randomUUID() };
}

function actorOrFail(actor: string): string | null {
  const trimmed = actor.trim();
  return trimmed ? trimmed : null;
}

function notesEqual(a: SourceNote, b: SourceNote): boolean {
  return (
    a.noteText === b.noteText &&
    a.personId === b.personId &&
    (a.projectId ?? null) === (b.projectId ?? null) &&
    a.contextLayer === b.contextLayer &&
    a.lifecycleStatus === b.lifecycleStatus &&
    (a.deletedAt ?? null) === (b.deletedAt ?? null) &&
    (a.previousLifecycle ?? null) === (b.previousLifecycle ?? null)
  );
}

function restoreLifecycle(note: SourceNote): SourceNoteLifecycleStatus {
  const previous = note.previousLifecycle;
  if (previous && previous !== "trashed") return previous;
  return classifySourceNoteLifecycle(note.sourceSystem);
}

async function apply(
  deps: MutateNoteDeps,
  changeKind: SourceNoteChangeKind,
  input: { mutationId: string; actor: string },
  prior: SourceNote,
  next: SourceNote,
): Promise<MutateNoteResult> {
  if (!isSourceNoteChangeKind(changeKind)) {
    return { ok: false, reason: "invalid-input", code: "invalid-kind" };
  }
  const editedBy = actorOrFail(input.actor);
  if (!editedBy) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  const editedAt = deps.nowIso();
  const patched: SourceNote = {
    ...next,
    updatedAt: editedAt,
    updatedBy: editedBy,
  };
  try {
    const result = await deps.applyMutation({
      mutationId: input.mutationId,
      revisionId: deps.newRevisionId(),
      changeKind,
      editedAt,
      editedBy,
      prior,
      next: patched,
    });
    return {
      ok: true,
      noteId: result.note.id,
      status: result.status,
      revisionId: result.revisionId,
    };
  } catch {
    return unavailable();
  }
}

export async function editSourceNote(
  deps: MutateNoteDeps,
  input: EditSourceNoteInput,
): Promise<MutateNoteResult> {
  const mutationId = input.mutationId.trim();
  const noteId = input.noteId.trim();
  if (!isUuid(mutationId) || !isUuid(noteId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  const noteText = input.noteText.trim();
  if (!noteText) {
    return { ok: false, reason: "invalid-input", code: "empty-note" };
  }
  if (noteText.length > MANUAL_NOTE_MAX_LENGTH) {
    return { ok: false, reason: "invalid-input", code: "oversized-note" };
  }
  try {
    const prior = await deps.getNote(noteId);
    if (!prior) return { ok: false, reason: "note-not-found" };
    if (prior.lifecycleStatus === "trashed") {
      return { ok: false, reason: "not-editable" };
    }
    return apply(deps, "edit", input, prior, { ...prior, noteText });
  } catch {
    return unavailable();
  }
}

export async function moveSourceNote(
  deps: MutateNoteDeps,
  input: MoveSourceNoteInput,
): Promise<MutateNoteResult> {
  const mutationId = input.mutationId.trim();
  const noteId = input.noteId.trim();
  const personId = input.personId.trim();
  if (!isUuid(mutationId) || !isUuid(noteId) || !isUuid(personId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  if (!isRelationshipContextLayer(input.contextLayer)) {
    return { ok: false, reason: "invalid-input", code: "invalid-context" };
  }
  const requestedProjectId = normalizeOptionalId(input.projectId);
  if (requestedProjectId && !isUuid(requestedProjectId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  if (requestedProjectId && input.contextLayer !== "client") {
    return { ok: false, reason: "invalid-input", code: "project-not-allowed" };
  }
  try {
    const prior = await deps.getNote(noteId);
    if (!prior) return { ok: false, reason: "note-not-found" };
    if (prior.lifecycleStatus === "trashed") {
      return { ok: false, reason: "not-editable" };
    }
    const person = await deps.getEntity(personId);
    if (!person || person.kind !== "person") {
      return { ok: false, reason: "person-not-found" };
    }
    let projectId: string | null = null;
    if (requestedProjectId) {
      const project = await deps.getEntity(requestedProjectId);
      if (!project) return { ok: false, reason: "project-not-linked" };
      if (project.kind !== "project") {
        return { ok: false, reason: "entity-kind-mismatch" };
      }
      const linked = await deps.hasActiveClientProjectLink(
        personId,
        requestedProjectId,
      );
      if (!linked) return { ok: false, reason: "project-not-linked" };
      projectId = requestedProjectId;
    }
    if (prior.personId !== personId && !input.crossPersonConfirmed) {
      return {
        ok: false,
        reason: "invalid-input",
        code: "cross-person-unconfirmed",
      };
    }
    return apply(deps, "move", input, prior, {
      ...prior,
      personId,
      projectId,
      contextLayer: input.contextLayer,
    });
  } catch {
    return unavailable();
  }
}

export async function trashSourceNote(
  deps: MutateNoteDeps,
  input: LifecycleSourceNoteInput,
): Promise<MutateNoteResult> {
  const mutationId = input.mutationId.trim();
  const noteId = input.noteId.trim();
  if (!isUuid(mutationId) || !isUuid(noteId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  try {
    const prior = await deps.getNote(noteId);
    if (!prior) return { ok: false, reason: "note-not-found" };
    if (prior.lifecycleStatus === "trashed") {
      return {
        ok: true,
        noteId: prior.id,
        status: "already-present",
        revisionId: null,
      };
    }
    return apply(deps, "trash", input, prior, {
      ...prior,
      previousLifecycle: prior.lifecycleStatus,
      lifecycleStatus: "trashed",
      deletedAt: deps.nowIso(),
    });
  } catch {
    return unavailable();
  }
}

export async function restoreSourceNote(
  deps: MutateNoteDeps,
  input: LifecycleSourceNoteInput,
): Promise<MutateNoteResult> {
  const mutationId = input.mutationId.trim();
  const noteId = input.noteId.trim();
  if (!isUuid(mutationId) || !isUuid(noteId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  try {
    const prior = await deps.getNote(noteId);
    if (!prior) return { ok: false, reason: "note-not-found" };
    if (prior.lifecycleStatus !== "trashed") {
      return { ok: false, reason: "not-trashed" };
    }
    return apply(deps, "restore", input, prior, {
      ...prior,
      lifecycleStatus: restoreLifecycle(prior),
      previousLifecycle: "trashed",
      deletedAt: null,
    });
  } catch {
    return unavailable();
  }
}

export async function keepSourceNote(
  deps: MutateNoteDeps,
  input: LifecycleSourceNoteInput,
): Promise<MutateNoteResult> {
  const mutationId = input.mutationId.trim();
  const noteId = input.noteId.trim();
  if (!isUuid(mutationId) || !isUuid(noteId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  try {
    const prior = await deps.getNote(noteId);
    if (!prior) return { ok: false, reason: "note-not-found" };
    if (prior.lifecycleStatus === "trashed") {
      return { ok: false, reason: "not-editable" };
    }
    return apply(deps, "keep", input, prior, {
      ...prior,
      previousLifecycle: prior.lifecycleStatus,
      lifecycleStatus: "kept",
      deletedAt: null,
    });
  } catch {
    return unavailable();
  }
}

export async function absorbSourceNote(
  deps: MutateNoteDeps,
  input: LifecycleSourceNoteInput,
): Promise<MutateNoteResult> {
  const mutationId = input.mutationId.trim();
  const noteId = input.noteId.trim();
  if (!isUuid(mutationId) || !isUuid(noteId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  try {
    const prior = await deps.getNote(noteId);
    if (!prior) return { ok: false, reason: "note-not-found" };
    if (prior.lifecycleStatus === "trashed") {
      return { ok: false, reason: "not-editable" };
    }
    return apply(deps, "absorb", input, prior, {
      ...prior,
      previousLifecycle: prior.lifecycleStatus,
      lifecycleStatus: "absorbed",
      deletedAt: null,
    });
  } catch {
    return unavailable();
  }
}

export function priorStateRevision(
  input: NoteMutationApplyInput,
): SourceNoteRevision {
  return {
    id: input.revisionId,
    noteId: input.prior.id,
    mutationId: input.mutationId,
    noteText: input.prior.noteText,
    personId: input.prior.personId,
    projectId: input.prior.projectId,
    contextLayer: input.prior.contextLayer,
    lifecycleStatus: input.prior.lifecycleStatus,
    changeKind: input.changeKind,
    editedAt: input.editedAt,
    editedBy: input.editedBy,
  };
}

export { notesEqual };
