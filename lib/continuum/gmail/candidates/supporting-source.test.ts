import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { GENERATED_FOUNDER_OPERATING_BRIEF_RULE } from "./generated-source";
import {
  attachObservedSupportingGmailProvenance,
  sanitizeSupportingGmailSourceRefs,
} from "./supporting-source";

const CLIENT_REF = "gc1|1a04a565e20ee5f5|1a082e6c4dcb5849";
const OTHER_REF = "gc1|1a04a565e20ee5f6|1a082e6c4dcb5850";
const BRIEF_REF = "gc1|1a085d41ae9efcf6|1a085d41ae9efcf6";

function row(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId" | "sourceRef">,
): ContinuumCandidate {
  return {
    sourceSystem: "gmail",
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
    ...extra,
  };
}

describe("Observed supporting Gmail provenance", () => {
  it("retains ingested client sourceRefs on a generated Brief restatement", () => {
    const attached = attachObservedSupportingGmailProvenance([
      row({
        candidateId: "brief",
        sourceRef: BRIEF_REF,
        evidenceBasis: {
          ruleIds: ["explicit_follow_up", GENERATED_FOUNDER_OPERATING_BRIEF_RULE],
          matchedText: "follow-up window",
        },
      }),
      row({
        candidateId: "client",
        sourceRef: CLIENT_REF,
        sourceTimestamp: "2026-09-08T15:00:00.000Z",
        proposedTarget: {
          kind: "project",
          projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      }),
    ]);
    assert.deepEqual(attached[0]?.evidenceBasis.supportingSourceRefs, [CLIENT_REF]);
    assert.equal(attached[0]?.sourceRef, BRIEF_REF);
    assert.equal(attached[1]?.evidenceBasis.supportingSourceRefs, undefined);
  });

  it("does not guess a supporting thread that was not observed", () => {
    const attached = attachObservedSupportingGmailProvenance([
      row({
        candidateId: "brief",
        sourceRef: BRIEF_REF,
        evidenceBasis: {
          ruleIds: ["explicit_follow_up", GENERATED_FOUNDER_OPERATING_BRIEF_RULE],
          matchedText: "follow-up window",
        },
      }),
    ]);
    assert.equal(attached[0]?.evidenceBasis.supportingSourceRefs, undefined);
  });

  it("fails closed when the same restatement matches two different Projects", () => {
    const attached = attachObservedSupportingGmailProvenance([
      row({
        candidateId: "brief",
        sourceRef: BRIEF_REF,
        evidenceBasis: {
          ruleIds: ["explicit_follow_up", GENERATED_FOUNDER_OPERATING_BRIEF_RULE],
          matchedText: "follow-up window",
        },
      }),
      row({
        candidateId: "client-a",
        sourceRef: CLIENT_REF,
        proposedTarget: {
          kind: "project",
          projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      }),
      row({
        candidateId: "client-b",
        sourceRef: OTHER_REF,
        proposedTarget: {
          kind: "project",
          projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
      }),
    ]);
    assert.equal(attached[0]?.evidenceBasis.supportingSourceRefs, undefined);
  });

  it("rejects non-Gmail supporting refs", () => {
    assert.deepEqual(sanitizeSupportingGmailSourceRefs(["hi1|nope", CLIENT_REF, CLIENT_REF]), [
      CLIENT_REF,
    ]);
  });
});
