import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  EMAIL_HASH_SUPPORTING_NOT_IDENTITY,
  FOUNDER_CONFIRMED_ADDRESS_IDENTITY,
  FOUNDER_CONFIRMED_GMAIL_SOURCE_LINK,
  FOUNDER_CONFIRMED_PARTICIPANT_MAPPING,
  resolvePersonHit,
} from "./associate";
import type { GmailCandidatePerson } from "./types";

function person(input: {
  personId: string;
  displayName: string;
  email: string;
}): GmailCandidatePerson {
  return {
    personId: input.personId,
    displayName: input.displayName,
    emailHash: hashEmail(input.email),
    role: "client",
    projectIds: [],
  };
}

const CASTILLO = person({
  personId: "abbey-castillo",
  displayName: "Abbey Castillo",
  email: "serinitybloom@gmail.com",
});
const WAGNER = person({
  personId: "abbey-wagner",
  displayName: "Abbey Wagner",
  email: "abbey.wagner@example.test",
});

describe("Gmail Person identity ladder", () => {
  it("treats a unique raw email hash as supporting evidence only", () => {
    const hit = resolvePersonHit({
      fromEmailHash: hashEmail("serinitybloom@gmail.com"),
      people: [CASTILLO, WAGNER],
      internalEmailHashes: [],
    });
    assert.equal(hit.person, null);
    assert.equal(hit.possiblePerson?.personId, CASTILLO.personId);
    assert.deepEqual(hit.ruleIds, [EMAIL_HASH_SUPPORTING_NOT_IDENTITY]);
    assert.equal(hit.possiblePerson?.displayName, "Abbey Castillo");
  });

  it("never selects Abbey Wagner by name similarity", () => {
    const hit = resolvePersonHit({
      fromEmailHash: hashEmail("serinitybloom@gmail.com"),
      threadId: "t-abbey",
      people: [CASTILLO, WAGNER],
      internalEmailHashes: [],
    });
    assert.notEqual(hit.possiblePerson?.personId, WAGNER.personId);
    assert.notEqual(hit.person?.personId, WAGNER.personId);
  });

  it("does not use display name as identity when the hash is unknown", () => {
    const hit = resolvePersonHit({
      fromEmailHash: hashEmail("unknown.sender@example.test"),
      people: [CASTILLO, WAGNER],
      internalEmailHashes: [],
    });
    assert.equal(hit.person, null);
    assert.equal(hit.possiblePerson, null);
    assert.deepEqual(hit.ruleIds, ["unresolved_email_hash"]);
  });

  it("asserts a Person only from a founder-confirmed participant mapping", () => {
    const hit = resolvePersonHit({
      fromEmailHash: hashEmail("serinitybloom@gmail.com"),
      people: [CASTILLO, WAGNER],
      internalEmailHashes: [],
      confirmedParticipantMappings: [
        {
          emailHash: hashEmail("serinitybloom@gmail.com")!,
          personId: CASTILLO.personId,
        },
      ],
    });
    assert.equal(hit.person?.personId, CASTILLO.personId);
    assert.deepEqual(hit.ruleIds, [FOUNDER_CONFIRMED_PARTICIPANT_MAPPING]);
  });

  it("asserts a Person only from a founder-confirmed address identity", () => {
    const hit = resolvePersonHit({
      fromEmailHash: hashEmail("serinitybloom@gmail.com"),
      people: [CASTILLO, WAGNER],
      internalEmailHashes: [],
      founderConfirmedEmailIdentities: [
        {
          emailHash: hashEmail("serinitybloom@gmail.com")!,
          personId: CASTILLO.personId,
        },
      ],
    });
    assert.equal(hit.person?.personId, CASTILLO.personId);
    assert.deepEqual(hit.ruleIds, [FOUNDER_CONFIRMED_ADDRESS_IDENTITY]);
  });

  it("asserts a Person from a confirmed Gmail source link", () => {
    const hit = resolvePersonHit({
      fromEmailHash: hashEmail("serinitybloom@gmail.com"),
      threadId: "t-abbey",
      people: [CASTILLO, WAGNER],
      internalEmailHashes: [],
      confirmedSourceLinks: [{ threadId: "t-abbey", personId: CASTILLO.personId }],
    });
    assert.equal(hit.person?.personId, CASTILLO.personId);
    assert.deepEqual(hit.ruleIds, [FOUNDER_CONFIRMED_GMAIL_SOURCE_LINK]);
  });
});
