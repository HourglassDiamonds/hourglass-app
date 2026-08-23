/**
 * Client Memory note writer port and in-memory adapter.
 * Read/write are separate. Do not add writes to ClientMemoryReader.
 */

import { randomUUID } from "node:crypto";
import type { InMemoryClientMemoryStore } from "../store";
import { addManualNote } from "./add-manual-note";
import type { AddManualNoteInput, AddManualNoteResult } from "./types";

export type ClientMemoryNoteWriter = {
  addManualNote(input: AddManualNoteInput): Promise<AddManualNoteResult>;
};

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
}

export function createInMemoryClientMemoryNoteWriter(
  store: InMemoryClientMemoryStore,
): ClientMemoryNoteWriter {
  return new InMemoryClientMemoryNoteWriter(store);
}
