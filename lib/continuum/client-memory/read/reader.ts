/**
 * Server-side Client Memory reader. Read-only. No write methods.
 */

import { listOpenReviewsForPerson, composePersonProfile } from "./profile";
import { composePersonCockpit, listPersonSourceHistoryFromSnapshot } from "./cockpit";
import { searchPeopleFromSnapshot } from "./search";
import { isCalendarMonth, listCurrentBirthdaysByMonthFromRows } from "./birthdays";
import {
  CLIENT_MEMORY_SEARCH_LIMIT,
  type ClientMemoryReadSnapshot,
  type ClientSearchResult,
  type ConciergePersonProfileResult,
  type IdentityReviewSummary,
  type PersonCockpitResult,
  type PersonSourceHistoryQuery,
  type PersonSourceHistoryResult,
} from "./types";
import type { BirthdayRead } from "../facts/types";

export type ClientMemoryReader = {
  searchPeople(
    query: string,
    options?: { limit?: number },
  ): Promise<ClientSearchResult[]>;
  getPersonProfile(personId: string): Promise<ConciergePersonProfileResult>;
  getPersonCockpit(personId: string): Promise<PersonCockpitResult>;
  listPersonSourceHistory(
    personId: string,
    query?: PersonSourceHistoryQuery,
  ): Promise<PersonSourceHistoryResult>;
  listOpenIdentityReviews(personId: string): Promise<IdentityReviewSummary[]>;
  listCurrentBirthdaysByMonth(month: number): Promise<BirthdayRead[]>;
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

  async getPersonCockpit(personId: string): Promise<PersonCockpitResult> {
    return composePersonCockpit(this.snapshot, personId);
  }

  async listPersonSourceHistory(
    personId: string,
    query?: PersonSourceHistoryQuery,
  ): Promise<PersonSourceHistoryResult> {
    return listPersonSourceHistoryFromSnapshot(this.snapshot, personId, query);
  }

  async listOpenIdentityReviews(personId: string): Promise<IdentityReviewSummary[]> {
    return listOpenReviewsForPerson(this.snapshot, personId);
  }

  async listCurrentBirthdaysByMonth(month: number): Promise<BirthdayRead[]> {
    if (!isCalendarMonth(month)) return [];
    const namesByPersonId = new Map(
      this.snapshot.profiles.map((row) => [row.personId, row.displayName]),
    );
    return listCurrentBirthdaysByMonthFromRows({
      month,
      facts: this.snapshot.facts,
      namesByPersonId,
    });
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
  "getPersonCockpit",
  "listPersonSourceHistory",
  "listOpenIdentityReviews",
  "listCurrentBirthdaysByMonth",
] as const satisfies readonly (keyof ClientMemoryReader)[];
