import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRealClientAssociationBatch, cohortForSubject } from "./real-client-association";

const AUTH = "2026-11-04T15:00:50.223Z";

function message(override: Partial<Parameters<typeof buildRealClientAssociationBatch>[0]["messages"][number]> = {}) {
  return {
    messageId: "m1",
    threadId: "abc123def456",
    subject: "Morgan current project",
    sentAt: "2026-11-05T14:32:22.000Z",
    indexedAt: "2026-11-05T14:34:48.000Z",
    direction: "inbound" as const,
    participantHashes: ["hash-morgan"],
    ...override,
  };
}

function batch(override: Partial<Parameters<typeof buildRealClientAssociationBatch>[0]> = {}) {
  return buildRealClientAssociationBatch({
    messages: [message()],
    people: [],
    projects: [],
    jobs: [],
    relationships: [],
    authorizationAt: AUTH,
    associationPersistence: "missing",
    nowIso: "2026-11-05T15:00:00.000Z",
    ...override,
  });
}

describe("real-client association review batch", () => {
  it("keeps subject discovery unresolved and treats a latest inbound only as plausible founder ownership", () => {
    const result = batch();
    const morgan = result.reviews.find((row) => row.key === "morgan")!;
    assert.equal(morgan.status, "founder-review-required");
    assert.equal(morgan.currentProviderThreads[0].identityEvidence, "subject-discovery-only");
    assert.equal(morgan.currentProviderThreads[0].plausibleNextOwner, "founder");
    assert.equal(morgan.currentProviderThreads[0].target, null);
    assert.equal(morgan.currentProviderThreads[0].recommendedDecision, "leave-unresolved");
  });

  it("excludes fixture-era ids and fixture canonical targets", () => {
    const result = batch({
      messages: [
        message({ messageId: "old", threadId: "face000000000001", indexedAt: "2026-10-30T14:00:00.000Z" }),
        message(),
      ],
      projects: [{ projectId: "fixture-project", label: "STERLING ACCEPTANCE SANDBOX — Morgan Jines — CAD", sourceSystem: "sterling-preview-acceptance" }],
    });
    const morgan = result.reviews.find((row) => row.key === "morgan")!;
    assert.deepEqual(morgan.fixtureEraThreadIds, ["face000000000001"]);
    assert.deepEqual(morgan.currentProviderThreads[0].fixtureTargetsExcluded, ["STERLING ACCEPTANCE SANDBOX — Morgan Jines — CAD"]);
    assert.equal(morgan.currentProviderThreads[0].target, null);
  });

  it("requires exact participant identity and a non-fixture canonical relationship before confirmation is possible", () => {
    const result = batch({
      people: [{ personId: "person-morgan", label: "Morgan Real", emailHash: "hash-morgan", sourceSystem: "continuum" }],
      projects: [{ projectId: "project-morgan", label: "Morgan engagement ring", sourceSystem: "continuum" }],
      jobs: [{ jobId: "job-morgan", projectId: "project-morgan", label: "Review current reply", state: "open", waitingOn: "founder", sourceSystem: "continuum" }],
      relationships: [{ personId: "person-morgan", projectId: "project-morgan" }],
      associationPersistence: "available",
    });
    const thread = result.reviews.find((row) => row.key === "morgan")!.currentProviderThreads[0];
    assert.equal(thread.identityEvidence, "exact-canonical-email");
    assert.equal(thread.target?.projectId, "project-morgan");
    assert.equal(thread.target?.jobId, "job-morgan");
    assert.equal(thread.recommendedDecision, "confirm");
    assert.equal(thread.founderConfirmationRequired, true);
  });

  it("keeps JP separate from Pennock", () => {
    assert.deepEqual(cohortForSubject("JP custom ring"), ["jp"]);
    assert.deepEqual(cohortForSubject("J. Pennock CAD"), ["pennock"]);
  });
});
