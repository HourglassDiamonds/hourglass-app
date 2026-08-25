import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryClientMemoryReader } from "./reader";
import { SEARCH_RANK, rankSearchHit } from "./search";
import { CLIENT_MEMORY_SEARCH_LIMIT } from "./types";
import { emptyReadSnapshot, personProfile, relationship } from "./fixtures";

describe("Client Memory search", () => {
  it("ranks exact normalized email above a display-name contains hit", async () => {
    const emailPerson = personProfile({
      displayName: "Zed Client",
      email: "Ada@Example.com",
    });
    const namePerson = personProfile({
      displayName: "Reach ada@example.com",
      email: "other@example.com",
    });
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles: [namePerson, emailPerson],
    });
    const results = await reader.searchPeople("  ADA@example.com  ");
    assert.equal(results[0]?.personId, emailPerson.personId);
    assert.equal(results[1]?.personId, namePerson.personId);
    assert.equal(
      rankSearchHit(emailPerson, "ADA@example.com"),
      SEARCH_RANK.exactEmail,
    );
  });

  it("finds a person by exact normalized US phone", async () => {
    const match = personProfile({
      displayName: "Phone Person",
      phone: "(305) 555-0100",
    });
    const other = personProfile({
      displayName: "305 Club",
      phone: "2125550199",
    });
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles: [other, match],
    });
    const results = await reader.searchPeople("1-305-555-0100");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.personId, match.personId);
  });

  it("matches exact display name case-insensitively", async () => {
    const exact = personProfile({ displayName: "Ada Lovelace" });
    const prefix = personProfile({ displayName: "Ada Lovelace Smith" });
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles: [prefix, exact],
    });
    const results = await reader.searchPeople("ada lovelace");
    assert.equal(results[0]?.personId, exact.personId);
    assert.equal(results[1]?.personId, prefix.personId);
  });

  it("matches display-name prefix before contains", async () => {
    const prefix = personProfile({ displayName: "Ann Smith" });
    const contains = personProfile({ displayName: "Joanna Stone" });
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles: [contains, prefix],
    });
    const results = await reader.searchPeople("ann");
    assert.equal(results[0]?.personId, prefix.personId);
    assert.equal(results[1]?.personId, contains.personId);
  });

  it("matches a display-name substring", async () => {
    const person = personProfile({ displayName: "Ada Lovelace" });
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles: [person],
    });
    const results = await reader.searchPeople("lace");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.personId, person.personId);
  });

  it("matches organization contains at the lowest rank", async () => {
    const org = personProfile({
      displayName: "Zed",
      organizationName: "Hourglass Diamonds",
    });
    const named = personProfile({ displayName: "Hourglass Client" });
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles: [org, named],
    });
    const results = await reader.searchPeople("hourglass");
    assert.equal(results[0]?.personId, named.personId);
    assert.equal(results[1]?.personId, org.personId);
  });

  it("returns no rows for an empty or whitespace query", async () => {
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles: [personProfile({ displayName: "Ada Lovelace" })],
    });
    assert.deepEqual(await reader.searchPeople(""), []);
    assert.deepEqual(await reader.searchPeople("   "), []);
  });

  it("caps results at the V1 search limit", async () => {
    const profiles = Array.from({ length: 25 }, (_, i) =>
      personProfile({ displayName: `Ada ${String(i).padStart(2, "0")}` }),
    );
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles,
    });
    const results = await reader.searchPeople("Ada", { limit: 100 });
    assert.equal(results.length, CLIENT_MEMORY_SEARCH_LIMIT);
  });

  it("does not throw on a malformed phone query", async () => {
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles: [personProfile({ displayName: "Ada", phone: "3055550100" })],
    });
    const results = await reader.searchPeople("not-a-phone!!!");
    assert.equal(Array.isArray(results), true);
  });

  it("counts linked client-project relationships on search hits", async () => {
    const person = personProfile({ displayName: "Ada Lovelace" });
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles: [person],
      relationships: [
        relationship({ fromEntityId: person.personId, toEntityId: "project-a" }),
        relationship({ fromEntityId: person.personId, toEntityId: "project-b" }),
      ],
    });
    const results = await reader.searchPeople("Ada Lovelace");
    assert.equal(results[0]?.linkedProjectCount, 2);
  });

  it("exposes no write methods", async () => {
    const reader = createInMemoryClientMemoryReader(emptyReadSnapshot());
    assert.equal("searchPeople" in reader, true);
    assert.equal("getPersonProfile" in reader, true);
    assert.equal("listOpenIdentityReviews" in reader, true);
    assert.equal("insertEntity" in reader, false);
    assert.equal("insertPersonProfile" in reader, false);
    assert.equal("updatePersonProfile" in reader, false);
    assert.equal("applyExistingPersonAtomic" in reader, false);
    assert.equal("updatePersonContactAtomic" in reader, false);
  });
});
