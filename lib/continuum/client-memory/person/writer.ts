/**
 * Client Memory Person writer port and in-memory adapter.
 * Separate from the note and fact writers. Do not add writes to ClientMemoryReader.
 */

import type { InMemoryClientMemoryStore } from "../store";
import { addManualClient } from "./add-manual-client";
import { editPersonProfile } from "./edit-person";
import type {
  AddManualClientInput,
  AddManualClientResult,
  EditPersonProfileInput,
  EditPersonProfileResult,
} from "./types";

export type ClientMemoryPersonWriter = {
  addManualClient(input: AddManualClientInput): Promise<AddManualClientResult>;
  editPersonProfile(input: EditPersonProfileInput): Promise<EditPersonProfileResult>;
};

export class InMemoryClientMemoryPersonWriter implements ClientMemoryPersonWriter {
  constructor(private readonly store: InMemoryClientMemoryStore) {}

  addManualClient(input: AddManualClientInput): Promise<AddManualClientResult> {
    return addManualClient(
      {
        nowIso: () => new Date().toISOString(),
        findActiveIdentities: (query) => this.store.findActiveIdentities(query),
        createPersonAtomic: (row) => this.store.createPersonAtomic(row),
        getPersonProfile: (personId) => this.store.getPersonProfile(personId),
        updatePersonProfile: (personId, patch) =>
          this.store.updatePersonProfile(personId, patch),
      },
      input,
    );
  }

  editPersonProfile(input: EditPersonProfileInput): Promise<EditPersonProfileResult> {
    return editPersonProfile(
      {
        nowIso: () => new Date().toISOString(),
        findActiveIdentities: (query) => this.store.findActiveIdentities(query),
        getPersonProfile: (personId) => this.store.getPersonProfile(personId),
        updatePersonContactAtomic: (row) => this.store.updatePersonContactAtomic(row),
      },
      input,
    );
  }
}

export function createInMemoryClientMemoryPersonWriter(
  store: InMemoryClientMemoryStore,
): ClientMemoryPersonWriter {
  return new InMemoryClientMemoryPersonWriter(store);
}
