import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { GENERATED_FOUNDER_OPERATING_BRIEF_RULE } from "./generated-source";
import { withIndexedGeneratedOperatingMail } from "./tag-stored-generated";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";

const BRIEF_THREAD = "1a085d41ae9efcf6";
const BRIEF_MSG = "1a085d41ae9efcf6";
const CADENCE = hashEmail("cadence@hourglass.test")!;
const CLIENT = hashEmail("jen@client.test")!;

function storedBriefCandidate(): ContinuumCandidate {
  return {
    candidateId: "4393b28561d0106c285d9175d1df5a321cfba5265d4e05029696744aed22078a",
    sourceSystem: "gmail",
    sourceRef: `gc1|${BRIEF_THREAD}|${BRIEF_MSG}`,
    sourceTimestamp: "2026-09-09T11:01:04.000Z",
    candidateType: "follow_up",
    proposedTarget: { kind: "none" },
    payload: {
      kind: "follow_up",
      text: "follow-up window",
      dueAt: null,
      sourceTimestamp: "2026-09-09T11:01:04.000Z",
    },
    confidence: "medium",
    evidenceBasis: {
      ruleIds: ["explicit_follow_up"],
      matchedText: "follow-up window",
    },
    candidateState: "active",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: "2026-09-09T11:01:04.000Z",
    canonical: false,
    automaticApply: false,
    parserVersion: "gmail-candidates-deterministic-v1",
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}

describe("Stored generated-operating-mail tagging", () => {
  it("tags existing untagged Brief candidates from indexed sender hash", () => {
    const row = storedBriefCandidate();
    assert.equal(
      row.evidenceBasis.ruleIds.includes(GENERATED_FOUNDER_OPERATING_BRIEF_RULE),
      false,
    );
    const tagged = withIndexedGeneratedOperatingMail(
      [row],
      new Map([[BRIEF_MSG, CADENCE]]),
      [CADENCE],
    );
    assert.equal(
      tagged[0]?.evidenceBasis.ruleIds.includes(GENERATED_FOUNDER_OPERATING_BRIEF_RULE),
      true,
    );
  });

  it("does not tag a real client sender even when the stored row lacks the rule", () => {
    const tagged = withIndexedGeneratedOperatingMail(
      [storedBriefCandidate()],
      new Map([[BRIEF_MSG, CLIENT]]),
      [CADENCE],
    );
    assert.equal(
      tagged[0]?.evidenceBasis.ruleIds.includes(GENERATED_FOUNDER_OPERATING_BRIEF_RULE),
      false,
    );
  });

  it("attaches observed client sourceRefs when tagging a stored Brief restatement", () => {
    const tagged = withIndexedGeneratedOperatingMail(
      [
        storedBriefCandidate(),
        {
          ...storedBriefCandidate(),
          candidateId: "client-follow",
          sourceRef: `gc1|1a04a565e20ee5f5|1a082e6c4dcb5849`,
          sourceTimestamp: "2026-09-08T15:00:00.000Z",
          proposedTarget: {
            kind: "project",
            projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
        },
      ],
      new Map([
        [BRIEF_MSG, CADENCE],
        ["1a082e6c4dcb5849", CLIENT],
      ]),
      [CADENCE],
    );
    assert.deepEqual(tagged[0]?.evidenceBasis.supportingSourceRefs, [
      "gc1|1a04a565e20ee5f5|1a082e6c4dcb5849",
    ]);
    assert.equal(tagged[0]?.sourceRef, `gc1|${BRIEF_THREAD}|${BRIEF_MSG}`);
  });
});
