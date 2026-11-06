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

  it("carries exact attachment identifiers into an unresolved creation proposal without treating them as identity proof", () => {
    const result = batch({
      attachments: [
        { messageId: "m1", threadId: "abc123def456", filename: "NL-H017-Morgan-C026937-Mod1.jpg" },
        { messageId: "m2", threadId: "abc123def456", filename: "NL-H017-Morgan-C026937.jpg" },
      ],
    });
    const thread = result.reviews.find((row) => row.key === "morgan")!.currentProviderThreads[0];
    assert.deepEqual(thread.sourceAttachmentIdentifiers, ["C026937"]);
    assert.equal(thread.identityEvidence, "subject-discovery-only");
    assert.equal(thread.target, null);
    assert.equal(thread.recommendedDecision, "leave-unresolved");
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

  it("builds focused founder packets without converting vendor identifiers into canonical identity", () => {
    const result = batch({
      messages: [
        message({ messageId: "z1", threadId: "1a1212396a8ac111", subject: "Hourglass Diamonds x Zane - Wedding Band" }),
        message({ messageId: "a1", threadId: "1a0d00fedde6906a", subject: "HGD x Audrey-C026401" }),
        message({ messageId: "p1", threadId: "1a08d1c1443a8ede", subject: "HGD- J.Pennock-C025519-RN08286" }),
        message({ messageId: "p2", threadId: "1a10c5b8e4a52db7", subject: "HGD - Tim/Jenn C025964 & J. Pennock C025519 status" }),
      ],
    });
    const zane = result.reviews.find((row) => row.key === "zane")!;
    const audrey = result.reviews.find((row) => row.key === "audrey")!;
    const pennock = result.reviews.find((row) => row.key === "pennock")!;
    assert.equal(zane.founderPacket?.primaryThreadId, "1a1212396a8ac111");
    assert.match(zane.founderPacket?.ownershipAssessment ?? "", /founder-answered/);
    assert.match(zane.founderPacket?.founderSuppliedContext.join(" ") ?? "", /exact real Zane Kennedy.*In Production/);
    assert.match(zane.founderPacket?.proposedChangesAfterApproval.join(" ") ?? "", /zanemkennedy88@gmail\.com/);
    assert.match(zane.founderPacket?.proposedChangesAfterApproval.join(" ") ?? "", /Jobs: none/);
    assert.match(audrey.founderPacket?.safeguards[0] ?? "", /not infer Audrey's identity/);
    assert.deepEqual(pennock.founderPacket?.supportingThreadIds, ["1a10c5b8e4a52db7"]);
    assert.match(pennock.founderPacket?.unresolvedDecisions.join(" ") ?? "", /separate from JP/);
    assert.match(pennock.founderPacket?.founderSuppliedContext.join(" ") ?? "", /delivered.*closed/);
    assert.match(pennock.founderPacket?.verifiedEvidence.join(" ") ?? "", /C025519.*CAD\/design identifier/);
    assert.match(pennock.founderPacket?.verifiedEvidence.join(" ") ?? "", /RN08286.*workshop job identifier/);
    assert.match(pennock.founderPacket?.proposedChangesAfterApproval.join(" ") ?? "", /pennock3@gmail\.com/);
    assert.match(pennock.founderPacket?.proposedChangesAfterApproval.join(" ") ?? "", /Jobs: none/);
    assert.match(pennock.founderPacket?.safeguards[0] ?? "", /keep J\. Pennock separate from JP/);
  });

  it("promotes the indexed direct Pennock client thread for exact canonical review", () => {
    const result = batch({
      messages: [
        message({ messageId: "vendor", threadId: "1a08d1c1443a8ede", subject: "HGD- J.Pennock-C025519-RN08286", participantHashes: [] }),
        message({ messageId: "client", threadId: "19fdca18f516310d", subject: "Sapphire / Platinum Ring - John Pennock", participantHashes: ["pennock-hash"] }),
      ],
      people: [{ personId: "person-pennock", label: "John Pennock", emailHash: "pennock-hash", sourceSystem: "concierge-manual" }],
      projects: [{ projectId: "project-pennock", label: "John Pennock — Sapphire / Platinum Ring", sourceSystem: "concierge-manual", lifecycleStage: "completed" }],
      jobs: [], relationships: [{ personId: "person-pennock", projectId: "project-pennock" }], associationPersistence: "available",
    });
    const pennock = result.reviews.find((row) => row.key === "pennock")!;
    assert.equal(pennock.founderPacket?.primaryThreadId, "19fdca18f516310d");
    assert.equal(pennock.currentProviderThreads.find((row) => row.threadId === "19fdca18f516310d")?.target?.projectId, "project-pennock");
    assert.ok(pennock.founderPacket?.supportingThreadIds.includes("1a08d1c1443a8ede"));
  });
});
