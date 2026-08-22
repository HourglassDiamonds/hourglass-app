import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { CONTINUUM_SCHEMA_VERSION } from "../contracts/types";
import type {
  ContinuumEvent,
  ContinuumEvidence,
  ContinuumObservation,
} from "../contracts/types";
import { InMemoryContinuumStore } from "./memory";

const NOW = "2026-08-21T20:00:00.000Z";

function studioEvent(identifiedId: string): ContinuumEvent {
  return {
    id: randomUUID(),
    schemaVersion: CONTINUUM_SCHEMA_VERSION,
    eventType: "studio.view_emailed",
    occurredAt: NOW,
    ingestedAt: NOW,
    producer: "diamond-studio-email-view",
    sourceSystem: "studio-identified",
    sourceRecordId: identifiedId,
    subjectEntityId: null,
    idempotencyKey: `studio.view_emailed:identified:${identifiedId}`,
    payload: {
      identifiedRecordId: identifiedId,
      sharePath: "/diamond-studio?shape=oval",
      configuration: {
        shape: "oval",
        carat: 2.5,
        ringSize: 6,
        bandWidth: 2,
        skinTone: "light",
        orientation: "ns",
        metal: "yellow-gold",
      },
    },
  };
}

function sourceRecordEvidence(
  identifiedId: string,
  extras?: Partial<ContinuumEvidence>,
): ContinuumEvidence {
  return {
    id: randomUUID(),
    schemaVersion: CONTINUUM_SCHEMA_VERSION,
    sourceSystem: "studio-identified",
    sourceKind: "source-record",
    sourceRecordId: identifiedId,
    eventId: null,
    observationId: null,
    collectedAt: NOW,
    reportingPeriod: null,
    freshness: "fresh",
    reliability: "reliable",
    redactionStatus: "clean",
    summary: "Identified Studio view emailed",
    supportingPointer: `diamond_studio_identified_events:${identifiedId}`,
    idempotencyKey: `studio-record:${identifiedId}`,
    claimFingerprint: extras?.claimFingerprint ?? null,
    ...extras,
  };
}

describe("Continuum event persistence", () => {
  it("replays the same identified record into one event", async () => {
    const store = new InMemoryContinuumStore();
    const id = randomUUID();
    const first = await store.insertEvent(studioEvent(id));
    const second = await store.insertEvent(studioEvent(id));
    assert.equal(first.status, "inserted");
    assert.equal(second.status, "already-present");
    assert.equal(second.record.id, first.record.id);
    assert.equal(second.record.payload.identifiedRecordId, id);
  });

  it("creates distinct events for different identified records", async () => {
    const store = new InMemoryContinuumStore();
    const a = await store.insertEvent(studioEvent(randomUUID()));
    const b = await store.insertEvent(studioEvent(randomUUID()));
    assert.equal(a.status, "inserted");
    assert.equal(b.status, "inserted");
    assert.notEqual(a.record.id, b.record.id);
    assert.notEqual(a.record.idempotencyKey, b.record.idempotencyKey);
  });

  it("does not expose an event update API and replay preserves the original payload", async () => {
    const store = new InMemoryContinuumStore();
    const id = randomUUID();
    const first = await store.insertEvent(studioEvent(id));
    const mutated = studioEvent(id);
    mutated.payload.sharePath = "/diamond-studio?shape=round";
    const replay = await store.insertEvent(mutated);
    assert.equal(replay.status, "already-present");
    assert.equal(replay.record.payload.sharePath, first.record.payload.sharePath);
    assert.equal("updateEvent" in store, false);
  });
});

describe("Continuum evidence persistence", () => {
  it("is idempotent for source-record keys", async () => {
    const store = new InMemoryContinuumStore();
    const id = randomUUID();
    const first = await store.insertEvidence(sourceRecordEvidence(id));
    const second = await store.insertEvidence(sourceRecordEvidence(id));
    assert.equal(first.status, "inserted");
    assert.equal(second.status, "already-present");
    assert.equal(first.record.eventId, null);
    assert.equal(second.record.id, first.record.id);
  });

  it("allows the same claim text under different source semantics", async () => {
    const store = new InMemoryContinuumStore();
    const identified = randomUUID();
    await store.insertEvent(studioEvent(identified));
    const eventId = (await store.getEventByIdempotencyKey(
      `studio.view_emailed:identified:${identified}`,
    ))!.id;
    const a = await store.insertEvidence(
      sourceRecordEvidence(identified, {
        summary: "Identified Studio view emailed",
        claimFingerprint: "same-claim",
      }),
    );
    const b = await store.insertEvidence({
      ...sourceRecordEvidence(randomUUID(), {
        sourceKind: "event",
        sourceRecordId: null,
        eventId,
        observationId: null,
        summary: "Identified Studio view emailed",
        idempotencyKey: `event:${eventId}`,
        claimFingerprint: "same-claim",
      }),
    });
    assert.equal(a.status, "inserted");
    assert.equal(b.status, "inserted");
    assert.equal(a.record.claimFingerprint, b.record.claimFingerprint);
    assert.notEqual(a.record.idempotencyKey, b.record.idempotencyKey);
  });

  it("rejects source-record evidence that also sets event_id", async () => {
    const store = new InMemoryContinuumStore();
    await assert.rejects(() =>
      store.insertEvidence(
        sourceRecordEvidence(randomUUID(), { eventId: randomUUID() }),
      ),
    );
  });

  it("does not use claim_fingerprint as uniqueness", async () => {
    const store = new InMemoryContinuumStore();
    const first = await store.insertEvidence(
      sourceRecordEvidence(randomUUID(), { claimFingerprint: "dup" }),
    );
    const second = await store.insertEvidence(
      sourceRecordEvidence(randomUUID(), { claimFingerprint: "dup" }),
    );
    assert.equal(first.status, "inserted");
    assert.equal(second.status, "inserted");
    assert.notEqual(first.record.id, second.record.id);
  });
});

describe("Continuum observation persistence", () => {
  it("writes observations independently of events and supports multiple evidence links", async () => {
    const store = new InMemoryContinuumStore();
    const e1 = await store.insertEvidence(sourceRecordEvidence(randomUUID()));
    const e2 = await store.insertEvidence(sourceRecordEvidence(randomUUID()));
    const observation: ContinuumObservation = {
      id: randomUUID(),
      schemaVersion: CONTINUUM_SCHEMA_VERSION,
      observationType: "studio.identified_shape_share",
      subjectEntityId: null,
      statement: "Oval accounted for 42% of identified Studio activity.",
      value: { kind: "shape-share", ovalShare: 0.42 },
      epistemicClass: "derived",
      confidence: 0.9,
      producedBy: "continuum.test",
      createdAt: NOW,
      validFrom: NOW,
      validUntil: null,
      supersedesId: null,
      materiality: "notable",
      urgency: "low",
    };
    const inserted = await store.insertObservation(observation);
    assert.equal(inserted.status, "inserted");
    await store.linkObservationEvidence({
      observationId: observation.id,
      evidenceId: e1.record.id,
    });
    await store.linkObservationEvidence({
      observationId: observation.id,
      evidenceId: e2.record.id,
    });
    const linked = await store.listEvidenceIdsForObservation(observation.id);
    assert.deepEqual(linked.sort(), [e1.record.id, e2.record.id].sort());
    assert.equal("evidenceIds" in inserted.record, false);
  });

  it("round-trips nested JSON-safe observation values", async () => {
    const store = new InMemoryContinuumStore();
    const nested = {
      shape: "oval",
      metrics: { share: 0.42, count: 4 },
      samples: [1, 2, 3],
    };
    const observation: ContinuumObservation = {
      id: randomUUID(),
      schemaVersion: CONTINUUM_SCHEMA_VERSION,
      observationType: "test.nested",
      subjectEntityId: null,
      statement: "Nested JSON-safe value.",
      value: nested,
      epistemicClass: "derived",
      confidence: 1,
      producedBy: "continuum.test",
      createdAt: NOW,
      validFrom: NOW,
      validUntil: null,
      supersedesId: null,
      materiality: "monitor",
      urgency: "low",
    };
    await store.insertObservation(observation);
    const read = await store.getObservationById(observation.id);
    assert.deepEqual(read?.value, nested);
    const arrayObservation: ContinuumObservation = {
      ...observation,
      id: randomUUID(),
      value: ["oval", "round"],
    };
    await store.insertObservation(arrayObservation);
    const arrayRead = await store.getObservationById(arrayObservation.id);
    assert.deepEqual(arrayRead?.value, ["oval", "round"]);
  });

  it("supersession closes prior validity without deleting history", async () => {
    const store = new InMemoryContinuumStore();
    const first: ContinuumObservation = {
      id: randomUUID(),
      schemaVersion: CONTINUUM_SCHEMA_VERSION,
      observationType: "studio.identified_shape_share",
      subjectEntityId: null,
      statement: "Oval share was 30%.",
      value: { kind: "shape-share", ovalShare: 0.3 },
      epistemicClass: "derived",
      confidence: 0.7,
      producedBy: "continuum.test",
      createdAt: NOW,
      validFrom: NOW,
      validUntil: null,
      supersedesId: null,
      materiality: "monitor",
      urgency: "low",
    };
    await store.insertObservation(first);
    const later = "2026-08-22T00:00:00.000Z";
    await store.closeObservationValidity(first.id, later);
    const next: ContinuumObservation = {
      ...first,
      id: randomUUID(),
      statement: "Oval share was 42%.",
      value: { kind: "shape-share", ovalShare: 0.42 },
      createdAt: later,
      validFrom: later,
      supersedesId: first.id,
    };
    await store.insertObservation(next);
    const prior = await store.getObservationById(first.id);
    const current = await store.getObservationById(next.id);
    assert.equal(prior?.validUntil, later);
    assert.equal(current?.validUntil, null);
    assert.equal(current?.supersedesId, first.id);
  });

  it("rejects observation confidence outside 0–1", async () => {
    const store = new InMemoryContinuumStore();
    await assert.rejects(() =>
      store.insertObservation({
        id: randomUUID(),
        schemaVersion: CONTINUUM_SCHEMA_VERSION,
        observationType: "test",
        subjectEntityId: null,
        statement: "bad",
        value: null,
        epistemicClass: "derived",
        confidence: 1.5,
        producedBy: "continuum.test",
        createdAt: NOW,
        validFrom: NOW,
        validUntil: null,
        supersedesId: null,
        materiality: "monitor",
        urgency: "low",
      }),
    );
  });
});

describe("Continuum exceptions", () => {
  it("keeps distinct open exceptions per operation_id and retries the same open row", async () => {
    const store = new InMemoryContinuumStore();
    const opA = randomUUID();
    const opB = randomUUID();
    const a = await store.upsertOpenException({
      id: randomUUID(),
      exceptionType: "studio.identified_persistence_failed",
      subjectKey: opA,
      subjectEntityId: null,
      status: "open",
      openedAt: NOW,
      lastSeenAt: NOW,
      resolvedAt: null,
      detector: "studio-email-view",
      evidenceId: null,
      payload: { emailsSent: 1 },
    });
    const b = await store.upsertOpenException({
      id: randomUUID(),
      exceptionType: "studio.identified_persistence_failed",
      subjectKey: opB,
      subjectEntityId: null,
      status: "open",
      openedAt: NOW,
      lastSeenAt: NOW,
      resolvedAt: null,
      detector: "studio-email-view",
      evidenceId: null,
      payload: { emailsSent: 1 },
    });
    assert.notEqual(a.id, b.id);
    const retried = await store.upsertOpenException({
      ...a,
      id: randomUUID(),
      lastSeenAt: "2026-08-21T21:00:00.000Z",
    });
    assert.equal(retried.id, a.id);
    assert.equal(retried.lastSeenAt, "2026-08-21T21:00:00.000Z");
    assert.deepEqual(retried.payload, { emailsSent: 1 });
    assert.equal("email" in retried.payload, false);
  });

  it("resolves and suppresses without duplicating the operation", async () => {
    const store = new InMemoryContinuumStore();
    const op = randomUUID();
    await store.upsertOpenException({
      id: randomUUID(),
      exceptionType: "studio.identified_persistence_failed",
      subjectKey: op,
      subjectEntityId: null,
      status: "open",
      openedAt: NOW,
      lastSeenAt: NOW,
      resolvedAt: null,
      detector: "studio-email-view",
      evidenceId: null,
      payload: { emailsSent: 1 },
    });
    const resolved = await store.setExceptionStatus({
      exceptionType: "studio.identified_persistence_failed",
      subjectKey: op,
      status: "resolved",
      at: "2026-08-21T22:00:00.000Z",
    });
    assert.equal(resolved?.status, "resolved");
    const again = await store.upsertOpenException({
      id: randomUUID(),
      exceptionType: "studio.identified_persistence_failed",
      subjectKey: op,
      subjectEntityId: null,
      status: "open",
      openedAt: NOW,
      lastSeenAt: NOW,
      resolvedAt: null,
      detector: "studio-email-view",
      evidenceId: null,
      payload: { emailsSent: 1 },
    });
    assert.equal(again.status, "resolved");
    assert.equal(again.id, resolved?.id);

    const other = randomUUID();
    await store.upsertOpenException({
      id: randomUUID(),
      exceptionType: "studio.identified_persistence_failed",
      subjectKey: other,
      subjectEntityId: null,
      status: "open",
      openedAt: NOW,
      lastSeenAt: NOW,
      resolvedAt: null,
      detector: "studio-email-view",
      evidenceId: null,
      payload: { emailsSent: 1 },
    });
    const suppressed = await store.setExceptionStatus({
      exceptionType: "studio.identified_persistence_failed",
      subjectKey: other,
      status: "suppressed",
      at: "2026-08-21T22:05:00.000Z",
    });
    assert.equal(suppressed?.status, "suppressed");
  });
});
