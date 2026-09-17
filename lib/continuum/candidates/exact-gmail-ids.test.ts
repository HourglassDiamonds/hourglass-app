import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CANDIDATE_CONTRACT_VERSION, type ContinuumCandidate } from "./types";
import {
  collectExactGmailIds,
  exactGmailIdsFromCandidate,
  exactGmailIdsFromPointer,
} from "./exact-gmail-ids";

const THREAD = "1a0b7c8d9e0f1234";
const MESSAGE = "1a0b7c8d9e0f9999";

function gmailRow(
  extra: Pick<ContinuumCandidate, "candidateId" | "sourceRef"> &
    Partial<Pick<ContinuumCandidate, "evidenceBasis">>,
): ContinuumCandidate {
  return {
    candidateId: extra.candidateId,
    sourceSystem: "gmail",
    sourceRef: extra.sourceRef,
    sourceTimestamp: "2026-09-07T18:00:00.000Z",
    candidateType: "project_context",
    proposedTarget: { kind: "none" },
    payload: { kind: "project_context", topic: "design_refinement", value: "Could we try that?" },
    confidence: "high",
    evidenceBasis: extra.evidenceBasis ?? {
      ruleIds: ["explicit_design_refinement"],
      matchedText: "Could we try that?",
    },
    candidateState: "active",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: "2026-09-07T18:00:00.000Z",
    canonical: false,
    automaticApply: false,
    parserVersion: CANDIDATE_CONTRACT_VERSION,
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}

describe("exact Gmail id recovery", () => {
  it("reads packed gc1 thread and message ids", () => {
    assert.deepEqual(exactGmailIdsFromPointer(`gc1|${THREAD}|${MESSAGE}`), {
      threadId: THREAD,
      messageId: MESSAGE,
    });
  });

  it("recovers a message id when the packed thread slot is empty", () => {
    assert.deepEqual(exactGmailIdsFromPointer(`gc1||${MESSAGE}`), {
      threadId: null,
      messageId: MESSAGE,
    });
  });

  it("reads an exact Gmail web href and ignores non-hex pointers", () => {
    assert.deepEqual(
      exactGmailIdsFromPointer(
        `https://mail.google.com/mail/u/0/#all/${THREAD}/${MESSAGE}`,
      ),
      { threadId: THREAD, messageId: MESSAGE },
    );
    assert.deepEqual(exactGmailIdsFromPointer("subject: Cornflower Blue"), {
      threadId: null,
      messageId: null,
    });
    assert.deepEqual(exactGmailIdsFromPointer("Jen Spiegel"), {
      threadId: null,
      messageId: null,
    });
  });

  it("collects supporting source refs without inventing ids", () => {
    const row = gmailRow({
      candidateId: "legacy-jen",
      sourceRef: `gc1||${MESSAGE}`,
      evidenceBasis: {
        ruleIds: ["explicit_design_refinement"],
        matchedText: "Could we try that?",
        supportingSourceRefs: [`gc1|${THREAD}|${MESSAGE}`],
      },
    });
    assert.deepEqual(exactGmailIdsFromCandidate(row), {
      threadIds: [THREAD],
      messageIds: [MESSAGE],
    });
    assert.deepEqual(collectExactGmailIds([row]), {
      threadIds: [THREAD],
      messageIds: [MESSAGE],
    });
  });
});
