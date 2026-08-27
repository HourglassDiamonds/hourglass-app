/**
 * Client Memory note writer port and in-memory adapter.
 * Read/write are separate. Do not add writes to ClientMemoryReader.
 */

import { randomUUID } from "node:crypto";
import type { InMemoryClientMemoryStore } from "../store";
import { addManualNote } from "./add-manual-note";
import {
  absorbSourceNote,
  editSourceNote,
  keepSourceNote,
  moveSourceNote,
  restoreSourceNote,
  trashSourceNote,
  type EditSourceNoteInput,
  type LifecycleSourceNoteInput,
  type MoveSourceNoteInput,
  type MutateNoteDeps,
  type MutateNoteResult,
} from "./mutate-note";
import type { AddManualNoteInput, AddManualNoteResult } from "./types";
import type { SourceNote } from "../types";

export type ClientMemoryNoteWriter = {
  addManualNote(input: AddManualNoteInput): Promise<AddManualNoteResult>;
  getSourceNote(id: string): Promise<SourceNote | null>;
  editNote(input: EditSourceNoteInput): Promise<MutateNoteResult>;
  moveNote(input: MoveSourceNoteInput): Promise<MutateNoteResult>;
  trashNote(input: LifecycleSourceNoteInput): Promise<MutateNoteResult>;
  restoreNote(input: LifecycleSourceNoteInput): Promise<MutateNoteResult>;
};

function mutateDeps(store: InMemoryClientMemoryStore): MutateNoteDeps {
  return {
    nowIso: () => new Date().toISOString(),
    newRevisionId: () => randomUUID(),
    getEntity: (id) => store.getEntity(id),
    getNote: (id) => store.getSourceNote(id),
    hasActiveClientProjectLink: (personId, projectId) =>
      store.hasActiveClientProjectLink(personId, projectId),
    applyMutation: (input) => store.applySourceNoteMutation(input),
  };
}

export class InMemoryClientMemoryNoteWriter implements ClientMemoryNoteWriter {
  constructor(private readonly store: InMemoryClientMemoryStore) {}

  addManualNote(input: AddManualNoteInput): Promise<AddManualNoteResult> {
    return addManualNote(
      {
        nowIso: () => new Date().toISOString(),
        newNoteId: () => randomUUID(),
        getEntity: (id) => this.store.getEntity(id),
        hasActiveClientProjectLink: (personId, projectId) =>
          this.store.hasActiveClientProjectLink(personId, projectId),
        insertNote: async (row) => {
          const result = await this.store.insertSourceNote(row);
          return result.status === "inserted" ? "inserted" : "duplicate-key";
        },
        findNoteByIdentity: (identity) =>
          this.store.findSourceNoteByIdentity(identity),
      },
      input,
    );
  }

  getSourceNote(id: string): Promise<SourceNote | null> {
    return this.store.getSourceNote(id);
  }

  editNote(input: EditSourceNoteInput): Promise<MutateNoteResult> {
    return editSourceNote(mutateDeps(this.store), input);
  }

  moveNote(input: MoveSourceNoteInput): Promise<MutateNoteResult> {
    return moveSourceNote(mutateDeps(this.store), input);
  }

  trashNote(input: LifecycleSourceNoteInput): Promise<MutateNoteResult> {
    return trashSourceNote(mutateDeps(this.store), input);
  }

  restoreNote(input: LifecycleSourceNoteInput): Promise<MutateNoteResult> {
    return restoreSourceNote(mutateDeps(this.store), input);
  }

  keepNote(input: LifecycleSourceNoteInput): Promise<MutateNoteResult> {
    return keepSourceNote(mutateDeps(this.store), input);
  }

  absorbNote(input: LifecycleSourceNoteInput): Promise<MutateNoteResult> {
    return absorbSourceNote(mutateDeps(this.store), input);
  }
}

export function createInMemoryClientMemoryNoteWriter(
  store: InMemoryClientMemoryStore,
): InMemoryClientMemoryNoteWriter {
  return new InMemoryClientMemoryNoteWriter(store);
}
