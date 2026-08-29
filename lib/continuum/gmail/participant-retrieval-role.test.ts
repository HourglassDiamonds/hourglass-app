/**
 * Participant retrieval-role contract tests.
 * Synthetic hashes only. Does not write production truth.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  GMAIL_SOURCE_SYSTEM,
  type GmailIndexedMessage,
} from "@/lib/continuum/client-memory/gmail/types";
import {
  classifyIndexedThreadParticipants,
  classifyParticipantRetrievalRole,
  personDiscoverySeedHashes,
  threadTouchesPersonDiscoverySeed,
} from "./participant-retrieval-role";
import { INTERNAL_HOURGLASS_ADDRESSES } from "./project-reconstruction";

const PERSON = hashEmail("chedekal@example.com")!;
const VENDOR = hashEmail("workshop@example.com")!;
const CC = hashEmail("support-cc@example.com")!;
const FOUNDER = hashEmail(INTERNAL_HOURGLASS_ADDRESSES[0])!;
const STUDIO = hashEmail(INTERNAL_HOURGLASS_ADDRESSES[1])!;

function indexed(from: string, to: string, cc: string[] = []): GmailIndexedMessage {
  return {
    messageId: "msg-role",
    threadId: "thread-role",
    sentAt: "2026-08-06T00:00:00.000Z",
    indexedAt: "2026-08-28T00:00:00.000Z",
    subject: "RE: HGD - A. Achedekal-CBR2000037",
    fromEmailHash: hashEmail(from),
    toEmailHashes: [hashEmail(to)!],
    ccEmailHashes: cc.map((value) => hashEmail(value)!),
    bccEmailHashes: [],
    direction: "inbound",
    labelIds: [],
    hasAttachments: false,
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

describe("participant retrieval roles", () => {
  it("lets only canonical Person hashes seed Person discovery", () => {
    assert.equal(
      classifyParticipantRetrievalRole({
        emailHash: PERSON,
        canonicalPersonEmailHashes: [PERSON],
        internalEmailHashes: [FOUNDER],
      }),
      "can_seed_person_discovery",
    );
    assert.deepEqual(
      personDiscoverySeedHashes({
        canonicalPersonEmailHashes: [PERSON, PERSON, FOUNDER],
        internalEmailHashes: [FOUNDER],
      }),
      [PERSON],
    );
    assert.deepEqual(
      personDiscoverySeedHashes({
        canonicalPersonEmailHashes: [],
        internalEmailHashes: [FOUNDER],
      }),
      [],
    );
  });

  it("treats vendor and other external/CC hashes as supporting-only", () => {
    assert.equal(
      classifyParticipantRetrievalRole({
        emailHash: VENDOR,
        canonicalPersonEmailHashes: [PERSON],
      }),
      "supporting_only",
    );
    assert.equal(
      classifyParticipantRetrievalRole({
        emailHash: CC,
        canonicalPersonEmailHashes: [PERSON],
      }),
      "supporting_only",
    );
  });

  it("excludes founder and Hourglass internal hashes", () => {
    assert.equal(
      classifyParticipantRetrievalRole({
        emailHash: FOUNDER,
        canonicalPersonEmailHashes: [PERSON],
        internalEmailHashes: [FOUNDER],
      }),
      "excluded",
    );
    assert.equal(
      classifyParticipantRetrievalRole({
        emailHash: STUDIO,
        canonicalPersonEmailHashes: [PERSON],
      }),
      "excluded",
    );
  });

  it("does not treat co-occurrence on the known thread as Person identity", () => {
    const classified = classifyIndexedThreadParticipants({
      messages: [
        indexed("workshop@example.com", INTERNAL_HOURGLASS_ADDRESSES[0], [
          "support-cc@example.com",
        ]),
        indexed("chedekal@example.com", INTERNAL_HOURGLASS_ADDRESSES[0]),
      ],
      canonicalPersonEmailHashes: [PERSON],
      internalEmailHashes: [FOUNDER],
    });
    const byHash = new Map(classified.map((row) => [row.emailHash, row.role]));
    assert.equal(byHash.get(PERSON), "can_seed_person_discovery");
    assert.equal(byHash.get(VENDOR), "supporting_only");
    assert.equal(byHash.get(CC), "supporting_only");
    assert.equal(byHash.get(FOUNDER), "excluded");
    assert.equal(
      personDiscoverySeedHashes({
        canonicalPersonEmailHashes: [],
        internalEmailHashes: [FOUNDER],
      }).length,
      0,
    );
    assert.equal(
      threadTouchesPersonDiscoverySeed(
        [indexed("workshop@example.com", INTERNAL_HOURGLASS_ADDRESSES[0])],
        [PERSON],
      ),
      false,
    );
  });
});
