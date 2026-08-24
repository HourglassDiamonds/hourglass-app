import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryClientMemoryReader } from "./reader";
import { emptyReadSnapshot, fact, personProfile } from "./fixtures";
import { PERSON_FACT_TYPE_BIRTHDAY } from "../facts/types";

describe("current birthday month reader", () => {
  it("returns only current birthdays for the requested month", async () => {
    const sarah = personProfile({ displayName: "Sarah Miller" });
    const david = personProfile({ displayName: "David Carter" });
    const mike = personProfile({ displayName: "Mike Jones" });
    const june = personProfile({ displayName: "June Person" });
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles: [sarah, david, mike, june],
      facts: [
        fact({
          personId: sarah.personId,
          factType: PERSON_FACT_TYPE_BIRTHDAY,
          status: "current",
          value: { calendar: "gregorian", month: 11, day: 4, year: null },
        }),
        fact({
          personId: david.personId,
          factType: PERSON_FACT_TYPE_BIRTHDAY,
          status: "current",
          value: { calendar: "gregorian", month: 11, day: 12, year: 1985 },
        }),
        fact({
          personId: mike.personId,
          factType: PERSON_FACT_TYPE_BIRTHDAY,
          status: "current",
          value: { calendar: "gregorian", month: 11, day: null, year: null },
        }),
        fact({
          personId: june.personId,
          factType: PERSON_FACT_TYPE_BIRTHDAY,
          status: "current",
          value: { calendar: "gregorian", month: 6, day: 1, year: null },
        }),
        fact({
          personId: sarah.personId,
          factType: PERSON_FACT_TYPE_BIRTHDAY,
          status: "superseded",
          value: { calendar: "gregorian", month: 11, day: 5, year: null },
        }),
        fact({
          personId: david.personId,
          factType: PERSON_FACT_TYPE_BIRTHDAY,
          status: "candidate",
          value: { calendar: "gregorian", month: 11, day: 20, year: null },
        }),
        fact({
          personId: mike.personId,
          factType: "ring-size",
          status: "current",
          value: "6.25",
        }),
        fact({
          personId: june.personId,
          factType: PERSON_FACT_TYPE_BIRTHDAY,
          status: "current",
          value: { nested: true },
        }),
      ],
    });

    const november = await reader.listCurrentBirthdaysByMonth(11);
    assert.deepEqual(
      november.map((row) => ({
        name: row.displayName,
        month: row.month,
        day: row.day,
        year: row.year,
      })),
      [
        { name: "Sarah Miller", month: 11, day: 4, year: null },
        { name: "David Carter", month: 11, day: 12, year: 1985 },
        { name: "Mike Jones", month: 11, day: null, year: null },
      ],
    );
    assert.equal(november.every((row) => row.factId.length > 0), true);
    assert.equal(november.every((row) => row.personId.length > 0), true);

    const juneRows = await reader.listCurrentBirthdaysByMonth(6);
    assert.deepEqual(
      juneRows.map((row) => row.displayName),
      ["June Person"],
    );
    assert.deepEqual(await reader.listCurrentBirthdaysByMonth(2), []);
    assert.deepEqual(await reader.listCurrentBirthdaysByMonth(0), []);
    assert.deepEqual(await reader.listCurrentBirthdaysByMonth(13), []);
  });
});
