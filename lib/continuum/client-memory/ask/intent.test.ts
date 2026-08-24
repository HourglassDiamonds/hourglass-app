import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAskConciergeIntent } from "./intent";
import { ASK_CONCIERGE_QUERY_MAX_LENGTH } from "./types";

describe("Ask Concierge intent parser", () => {
  it("recognizes named-month birthday queries", () => {
    assert.deepEqual(parseAskConciergeIntent("Who has a birthday in November?"), {
      kind: "birthdays-by-month",
      month: 11,
    });
    assert.deepEqual(parseAskConciergeIntent("November birthdays"), {
      kind: "birthdays-by-month",
      month: 11,
    });
    assert.deepEqual(parseAskConciergeIntent("Birthdays in November"), {
      kind: "birthdays-by-month",
      month: 11,
    });
    assert.deepEqual(parseAskConciergeIntent("Who has birthdays during November?"), {
      kind: "birthdays-by-month",
      month: 11,
    });
    assert.deepEqual(parseAskConciergeIntent("Any birthdays in Nov?"), {
      kind: "birthdays-by-month",
      month: 11,
    });
    assert.deepEqual(parseAskConciergeIntent("november BIRTHDAYS"), {
      kind: "birthdays-by-month",
      month: 11,
    });
    assert.deepEqual(parseAskConciergeIntent("Birthdays in Sept"), {
      kind: "birthdays-by-month",
      month: 9,
    });
    assert.deepEqual(parseAskConciergeIntent("Birthdays in Sep"), {
      kind: "birthdays-by-month",
      month: 9,
    });
  });

  it("treats Sep and Sept as the same month, not as ambiguity", () => {
    assert.deepEqual(parseAskConciergeIntent("Sep Sept birthdays"), {
      kind: "birthdays-by-month",
      month: 9,
    });
  });

  it("accepts May only when it is a month, not a modal verb", () => {
    assert.deepEqual(parseAskConciergeIntent("May birthdays"), {
      kind: "birthdays-by-month",
      month: 5,
    });
    assert.deepEqual(parseAskConciergeIntent("Birthdays in May"), {
      kind: "birthdays-by-month",
      month: 5,
    });
    assert.deepEqual(parseAskConciergeIntent("Birthdays during May"), {
      kind: "birthdays-by-month",
      month: 5,
    });
    assert.deepEqual(parseAskConciergeIntent("Birthdays for May"), {
      kind: "birthdays-by-month",
      month: 5,
    });
    assert.deepEqual(parseAskConciergeIntent("birthday in May"), {
      kind: "birthdays-by-month",
      month: 5,
    });
    assert.deepEqual(parseAskConciergeIntent("Who may have a birthday?"), {
      kind: "unsupported",
    });
  });

  it("returns unsupported for questions that are not month birthday lookups", () => {
    assert.deepEqual(parseAskConciergeIntent("Who should I buy a birthday gift for?"), {
      kind: "unsupported",
    });
    assert.deepEqual(parseAskConciergeIntent("Who should I follow up with?"), {
      kind: "unsupported",
    });
    assert.deepEqual(parseAskConciergeIntent("Who is important this month?"), {
      kind: "unsupported",
    });
    assert.deepEqual(parseAskConciergeIntent("Who am I forgetting?"), {
      kind: "unsupported",
    });
    assert.deepEqual(parseAskConciergeIntent("What do I know about Sarah?"), {
      kind: "unsupported",
    });
    assert.deepEqual(parseAskConciergeIntent("What did Mike say about Italy?"), {
      kind: "unsupported",
    });
    assert.deepEqual(parseAskConciergeIntent("When is Sarah's birthday?"), {
      kind: "unsupported",
    });
    assert.deepEqual(parseAskConciergeIntent("Who has birthdays?"), {
      kind: "unsupported",
    });
    assert.deepEqual(parseAskConciergeIntent("November or December birthdays"), {
      kind: "unsupported",
    });
    assert.deepEqual(parseAskConciergeIntent("Birthdays in November or December"), {
      kind: "unsupported",
    });
    assert.deepEqual(parseAskConciergeIntent(""), { kind: "unsupported" });
    assert.deepEqual(parseAskConciergeIntent("   "), { kind: "unsupported" });
    assert.deepEqual(parseAskConciergeIntent("x".repeat(ASK_CONCIERGE_QUERY_MAX_LENGTH + 1)), {
      kind: "unsupported",
    });
    assert.deepEqual(parseAskConciergeIntent("11 birthdays"), { kind: "unsupported" });
    assert.deepEqual(parseAskConciergeIntent("Who has a birthday next week?"), {
      kind: "unsupported",
    });
    assert.deepEqual(parseAskConciergeIntent("Who has a birthday this month?"), {
      kind: "unsupported",
    });
  });

  it("recognizes next-month birthday queries without resolving the month", () => {
    assert.deepEqual(parseAskConciergeIntent("Who has a birthday next month?"), {
      kind: "birthdays-next-month",
    });
    assert.deepEqual(parseAskConciergeIntent("Birthdays next month"), {
      kind: "birthdays-next-month",
    });
    assert.deepEqual(parseAskConciergeIntent("Who has a birthday in November next month?"), {
      kind: "unsupported",
    });
  });
});
