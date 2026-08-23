/**
 * Server-side Client Memory reader. Read-only. No write methods.
 */

import { listOpenReviewsForPerson, composePersonProfile } from "./profile";
import { searchPeopleFromSnapshot } from "./search";
import {
  CLIENT_MEMORY_SEARCH_LIMIT,
  type ClientMemoryReadSnapshot,
  type ClientSearchResult,
  type ConciergePersonProfileResult,
  type IdentityReviewSummary,
} from "./types";

export type ClientMemoryReader = {
  searchPeople(
    query: string,
    options?: { limit?: number },
  ): Promise<ClientSearchResult[]>;
  getPersonProfile(personId: string): Promise<ConciergePersonProfileResult>;
  listOpenIdentityReviews(personId: string): Promise<IdentityReviewSummary[]>;
};

export class InMemoryClientMemoryReader implements ClientMemoryReader {
  constructor(private readonly snapshot: ClientMemoryReadSnapshot) {}

  async searchPeople(
    query: string,
    options?: { limit?: number },
  ): Promise<ClientSearchResult[]> {
    return searchPeopleFromSnapshot(
      this.snapshot,
      query,
      options?.limit ?? CLIENT_MEMORY_SEARCH_LIMIT,
    );
  }

  async getPersonProfile(personId: string): Promise<ConciergePersonProfileResult> {
    return composePersonProfile(this.snapshot, personId);
  }

  async listOpenIdentityReviews(personId: string): Promise<IdentityReviewSummary[]> {
    return listOpenReviewsForPerson(this.snapshot, personId);
  }
}

export function createInMemoryClientMemoryReader(
  snapshot: ClientMemoryReadSnapshot,
): ClientMemoryReader {
  return new InMemoryClientMemoryReader(snapshot);
}

export const CLIENT_MEMORY_READER_METHODS = [
  "searchPeople",
  "getPersonProfile",
  "listOpenIdentityReviews",
] as const satisfies readonly (keyof ClientMemoryReader)[];
