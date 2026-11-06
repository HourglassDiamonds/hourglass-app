import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  founderAssociationReviewKey,
  buildRealClientAssociationBatch,
  type ReviewedAssociation,
} from "./real-client-association";
import {
  persistFounderAssociationDecision,
  type FounderAssociationDecisionStore,
  type FounderAssociationFacts,
  type FounderAssociationRecord,
} from "./founder-association-decision";

const PERSON = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const JOB = "33333333-3333-4333-8333-333333333333";
const THREAD = "1a15fb0c9b520621";
const EMAIL = "morgan@example.com";

function facts(current: FounderAssociationRecord | null = null): FounderAssociationFacts {
  return {
    threadId: THREAD,
    postAuthorizationMessageCount: 32,
    participantHashes: [hashEmail(EMAIL)!],
    projectNumbers: ["C026937"],
    person: { id: PERSON, label: "Morgan", email: EMAIL, sourceSystem: "continuum" },
    project: { id: PROJECT, label: "Morgan ring", sourceSystem: "continuum" },
    job: { id: JOB, projectId: PROJECT, associatedPersonId: PERSON, sourceSystem: "continuum" },
    activeRelationship: true,
    current,
    trustedOtherProjectId: null,
  };
}

function fakeStore(initial: FounderAssociationRecord | null = null) {
  let current = initial;
  let writes = 0;
  const store: FounderAssociationDecisionStore = {
    async loadFacts() { return facts(current); },
    async insert(input) {
      if (current) return "conflict";
      writes += 1;
      current = { id: input.id, projectId: input.projectId, threadId: input.threadId, status: input.status, updatedAt: input.reviewedAt };
      return "saved";
    },
    async updateIfUnchanged(input) {
      if (!current || current.updatedAt !== input.expectedUpdatedAt) return "conflict";
      writes += 1;
      current = { ...current, status: input.status, updatedAt: input.reviewedAt };
      return "saved";
    },
  };
  return { store, current: () => current, writes: () => writes };
}

function key(current: FounderAssociationRecord | null): string {
  return founderAssociationReviewKey({ threadId: THREAD, personId: PERSON, projectId: PROJECT, jobId: JOB, current });
}

function input(store: FounderAssociationDecisionStore, decision: "confirm" | "reject", reviewKey: string) {
  return { threadId: THREAD, personId: PERSON, projectId: PROJECT, jobId: JOB, decision, reviewKey, reviewedBy: "founder", store, now: new Date("2026-11-05T19:00:00.000Z") } as const;
}

describe("founder-reviewed real correspondence persistence", () => {
  it("persists an approved exact linkage and survives recomputation", async () => {
    const fake = fakeStore();
    let savedProjectNumbers: unknown = null;
    const insert = fake.store.insert;
    fake.store.insert = async (row) => {
      savedProjectNumbers = row.basis.projectNumbers;
      return insert(row);
    };
    assert.deepEqual(await persistFounderAssociationDecision(input(fake.store, "confirm", key(null))), { ok: true, status: "trusted" });
    assert.equal(fake.writes(), 1);
    assert.deepEqual(savedProjectNumbers, []);
    const saved = fake.current()!;
    const reviewed: ReviewedAssociation[] = [{ ...saved }];
    const batch = buildRealClientAssociationBatch({
      messages: [{ messageId: "m1", threadId: THREAD, subject: "Morgan ring", sentAt: "2026-11-05T14:32:22Z", indexedAt: "2026-11-05T14:34:48Z", direction: "inbound", participantHashes: [hashEmail(EMAIL)!] }],
      people: [{ personId: PERSON, label: "Morgan", emailHash: hashEmail(EMAIL), sourceSystem: "continuum" }],
      projects: [{ projectId: PROJECT, label: "Morgan ring", sourceSystem: "continuum" }],
      jobs: [{ jobId: JOB, projectId: PROJECT, label: "Reply", state: "open", waitingOn: "founder", sourceSystem: "continuum" }],
      relationships: [{ personId: PERSON, projectId: PROJECT }],
      reviewedAssociations: reviewed,
      trustedThreadIds: [THREAD],
      authorizationAt: "2026-11-04T15:00:50Z", associationPersistence: "available", nowIso: "2026-11-05T19:01:00Z",
    });
    assert.equal(batch.trustedCurrentProviderThreadCount, 1);
    assert.equal(batch.reviews[0].currentProviderThreads[0].target?.currentDecision, "trusted");
  });

  it("keeps a rejection durable and rejects replay of the earlier confirmation", async () => {
    const fake = fakeStore();
    const absentKey = key(null);
    assert.deepEqual(await persistFounderAssociationDecision(input(fake.store, "reject", absentKey)), { ok: true, status: "rejected" });
    assert.deepEqual(await persistFounderAssociationDecision(input(fake.store, "confirm", absentKey)), { ok: false, reason: "replayed" });
    assert.equal(fake.current()?.status, "rejected");
    assert.equal(fake.writes(), 1);
  });

  it("leaves ambiguous identity unresolved without a write", async () => {
    const fake = fakeStore();
    fake.store.loadFacts = async () => ({ ...facts(), participantHashes: ["different"] });
    assert.deepEqual(await persistFounderAssociationDecision(input(fake.store, "confirm", key(null))), { ok: false, reason: "identity-unverified" });
    assert.equal(fake.writes(), 0);
  });

  it("prevents fixture-era targets from becoming real-client evidence", async () => {
    const fake = fakeStore();
    fake.store.loadFacts = async () => ({ ...facts(), project: { id: PROJECT, label: "STERLING ACCEPTANCE SANDBOX — Morgan", sourceSystem: "sterling-preview-acceptance" } });
    assert.deepEqual(await persistFounderAssociationDecision(input(fake.store, "confirm", key(null))), { ok: false, reason: "fixture" });
    assert.equal(fake.writes(), 0);
  });

  it("fails closed on an unverified relationship or Job and never exposes lifecycle writers", async () => {
    const noRelationship = fakeStore();
    noRelationship.store.loadFacts = async () => ({ ...facts(), activeRelationship: false });
    assert.deepEqual(await persistFounderAssociationDecision(input(noRelationship.store, "confirm", key(null))), { ok: false, reason: "relationship-unverified" });
    const wrongJob = fakeStore();
    wrongJob.store.loadFacts = async () => ({ ...facts(), job: { ...facts().job!, projectId: "44444444-4444-4444-8444-444444444444" } });
    assert.deepEqual(await persistFounderAssociationDecision(input(wrongJob.store, "confirm", key(null))), { ok: false, reason: "job-unverified" });
    assert.equal(noRelationship.writes() + wrongJob.writes(), 0);
  });
});
