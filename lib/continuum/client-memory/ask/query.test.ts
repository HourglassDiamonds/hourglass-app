import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BirthdayRead } from "../facts/types";
import type { ClientMemoryReader } from "../read/reader";
import type { ClientSearchResult, ConciergePersonProfileResult, IdentityReviewSummary } from "../read/types";
import { answerAskConciergeQuery } from "./query";
import {
  ASK_ERROR_MESSAGE,
  ASK_UNSUPPORTED_MESSAGE,
  askBirthdaysByMonthHeadline,
  formatAskBirthdayDate,
} from "./types";

type ReaderCalls = {
  listCurrentBirthdaysByMonth: number[];
  searchPeople: string[];
  getPersonProfile: string[];
  listOpenIdentityReviews: string[];
};

function birthday(input: Partial<BirthdayRead> & Pick<BirthdayRead, "displayName" | "month">): BirthdayRead {
  return {
    factId: input.factId ?? "fact-1",
    personId: input.personId ?? "person-1",
    displayName: input.displayName,
    month: input.month,
    day: input.day === undefined ? 12 : input.day,
    year: input.year === undefined ? null : input.year,
    verification: input.verification ?? "manual",
    sourceSystem: input.sourceSystem ?? "concierge-manual",
  };
}

function createSpyReader(options?: {
  people?: BirthdayRead[];
  throwOnList?: boolean;
}): { reader: ClientMemoryReader; calls: ReaderCalls } {
  const calls: ReaderCalls = {
    listCurrentBirthdaysByMonth: [],
    searchPeople: [],
    getPersonProfile: [],
    listOpenIdentityReviews: [],
  };
  const reader: ClientMemoryReader = {
    async searchPeople(query: string): Promise<ClientSearchResult[]> {
      calls.searchPeople.push(query);
      return [];
    },
    async getPersonProfile(personId: string): Promise<ConciergePersonProfileResult> {
      calls.getPersonProfile.push(personId);
      return { ok: false, reason: "not-found" };
    },
    async getPersonCockpit() {
      return { ok: false as const, reason: "not-found" as const };
    },
    async listPersonSourceHistory() {
      return { ok: false as const, reason: "not-found" as const };
    },
    async listOpenIdentityReviews(personId: string): Promise<IdentityReviewSummary[]> {
      calls.listOpenIdentityReviews.push(personId);
      return [];
    },
    async listCurrentBirthdaysByMonth(month: number): Promise<BirthdayRead[]> {
      calls.listCurrentBirthdaysByMonth.push(month);
      if (options?.throwOnList) throw new Error("read-birthdays-failed");
      return options?.people ?? [];
    },
  };
  return { reader, calls };
}

describe("Ask Concierge query router", () => {
  it("calls the birthday month reader exactly once for a supported month query", async () => {
    const sarah = birthday({
      displayName: "Sarah Miller",
      month: 11,
      day: 12,
      year: 1985,
      personId: "sarah",
    });
    const { reader, calls } = createSpyReader({ people: [sarah] });
    const answer = await answerAskConciergeQuery(reader, "Who has a birthday in November?");
    assert.deepEqual(answer, {
      kind: "birthdays-by-month",
      month: 11,
      people: [sarah],
    });
    assert.deepEqual(calls.listCurrentBirthdaysByMonth, [11]);
    assert.deepEqual(calls.searchPeople, []);
    assert.deepEqual(calls.getPersonProfile, []);
    assert.deepEqual(calls.listOpenIdentityReviews, []);
  });

  it("does not call Client Memory readers for unsupported questions", async () => {
    const { reader, calls } = createSpyReader({
      people: [birthday({ displayName: "Sarah Miller", month: 11 })],
    });
    const answer = await answerAskConciergeQuery(reader, "What did Mike say about Italy?");
    assert.deepEqual(answer, { kind: "unsupported" });
    assert.deepEqual(calls.listCurrentBirthdaysByMonth, []);
    assert.deepEqual(calls.searchPeople, []);
    assert.deepEqual(calls.getPersonProfile, []);
  });

  it("returns error when the birthday reader throws, not a zero result", async () => {
    const { reader, calls } = createSpyReader({ throwOnList: true });
    const answer = await answerAskConciergeQuery(reader, "November birthdays");
    assert.deepEqual(answer, { kind: "error" });
    assert.deepEqual(calls.listCurrentBirthdaysByMonth, [11]);
  });

  it("returns a birthdays-by-month answer with an empty list for zero matches", async () => {
    const { reader } = createSpyReader({ people: [] });
    const answer = await answerAskConciergeQuery(reader, "Birthdays in November");
    assert.deepEqual(answer, { kind: "birthdays-by-month", month: 11, people: [] });
  });

  it("returns many structured birthday rows without re-sorting", async () => {
    const people = [
      birthday({ displayName: "Sarah Miller", month: 11, day: 4, personId: "a" }),
      birthday({ displayName: "David Carter", month: 11, day: 12, personId: "b" }),
      birthday({ displayName: "Mike Jones", month: 11, day: null, personId: "c" }),
    ];
    const { reader } = createSpyReader({ people });
    const answer = await answerAskConciergeQuery(reader, "November birthdays");
    assert.equal(answer.kind, "birthdays-by-month");
    if (answer.kind !== "birthdays-by-month") return;
    assert.deepEqual(
      answer.people.map((row) => row.displayName),
      ["Sarah Miller", "David Carter", "Mike Jones"],
    );
  });

  it("resolves next month in the founder timezone, wrapping December to January", async () => {
    const august = createSpyReader();
    const augustAnswer = await answerAskConciergeQuery(
      august.reader,
      "Who has a birthday next month?",
      new Date("2026-08-24T16:00:00.000Z"),
    );
    assert.deepEqual(augustAnswer, { kind: "birthdays-by-month", month: 9, people: [] });
    assert.deepEqual(august.calls.listCurrentBirthdaysByMonth, [9]);

    const december = createSpyReader();
    const decemberAnswer = await answerAskConciergeQuery(
      december.reader,
      "Birthdays next month",
      new Date("2026-12-15T17:00:00.000Z"),
    );
    assert.deepEqual(decemberAnswer, { kind: "birthdays-by-month", month: 1, people: [] });
    assert.deepEqual(december.calls.listCurrentBirthdaysByMonth, [1]);
  });
});

describe("Ask Concierge presentation helpers", () => {
  it("uses currently-recorded language and omits birth year and age", () => {
    assert.equal(
      askBirthdaysByMonthHeadline(11, 0),
      "No birthdays are currently recorded for November.",
    );
    assert.equal(
      askBirthdaysByMonthHeadline(11, 1),
      "I currently have 1 November birthday recorded.",
    );
    assert.equal(
      askBirthdaysByMonthHeadline(11, 3),
      "I currently have 3 November birthdays recorded.",
    );
    assert.doesNotMatch(askBirthdaysByMonthHeadline(11, 1), /Only one|Nobody|3 people have/i);
    assert.equal(
      formatAskBirthdayDate({ month: 11, day: 12 }),
      "November 12",
    );
    assert.equal(
      formatAskBirthdayDate({ month: 11, day: null }),
      "November",
    );
    assert.equal(
      formatAskBirthdayDate({ month: 11, day: 12 }),
      formatAskBirthdayDate(birthday({ displayName: "Sarah", month: 11, day: 12, year: 1985 })),
    );
    assert.doesNotMatch(formatAskBirthdayDate({ month: 11, day: 12 }), /1985|age|years old/i);
    assert.doesNotMatch(formatAskBirthdayDate({ month: 11, day: null }), /Unknown|November 0|November 1/);
    assert.equal(ASK_UNSUPPORTED_MESSAGE, "I can't answer that from structured memory yet.");
    assert.equal(ASK_ERROR_MESSAGE, "I couldn't read relationship memory just now.");
    assert.notEqual(askBirthdaysByMonthHeadline(11, 0), ASK_ERROR_MESSAGE);
    assert.notEqual(ASK_UNSUPPORTED_MESSAGE, ASK_ERROR_MESSAGE);
    assert.notEqual(ASK_UNSUPPORTED_MESSAGE, askBirthdaysByMonthHeadline(11, 0));
  });
});
