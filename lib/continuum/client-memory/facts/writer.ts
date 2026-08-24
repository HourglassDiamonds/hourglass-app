/**
 * Client Memory structured-fact writer port and in-memory adapter.
 * Separate from the note writer. Do not add writes to ClientMemoryReader.
 */

import type { InMemoryClientMemoryStore } from "../store";
import { setManualBirthday } from "./write";
import type { SetManualBirthdayInput, SetManualBirthdayResult } from "./write";

export type ClientMemoryFactWriter = {
  setManualBirthday(input: SetManualBirthdayInput): Promise<SetManualBirthdayResult>;
};

export class InMemoryClientMemoryFactWriter implements ClientMemoryFactWriter {
  constructor(private readonly store: InMemoryClientMemoryStore) {}

  setManualBirthday(input: SetManualBirthdayInput): Promise<SetManualBirthdayResult> {
    return setManualBirthday(
      {
        nowIso: () => new Date().toISOString(),
        getEntity: (id) => this.store.getEntity(id),
        setCurrentPersonFact: (fact) => this.store.setCurrentPersonFact(fact),
      },
      input,
    );
  }
}

export function createInMemoryClientMemoryFactWriter(
  store: InMemoryClientMemoryStore,
): ClientMemoryFactWriter {
  return new InMemoryClientMemoryFactWriter(store);
}
