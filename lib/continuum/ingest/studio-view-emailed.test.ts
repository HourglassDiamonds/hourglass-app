import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { InMemoryContinuumStore } from "../persistence/memory";
import {
  ingestStudioViewEmailed,
  type StudioIdentifiedSourceRef,
} from "./studio-view-emailed";

function source(id = randomUUID()): StudioIdentifiedSourceRef {
  return {
    identifiedRecordId: id,
    occurredAt: "2026-08-21T18:43:10.000Z",
    sharePath: "/diamond-studio?shape=oval&carat=2.5",
    configuration: {
      shape: "oval",
      carat: 2.5,
      ringSize: 6,
      bandWidth: 2,
      skinTone: "light",
      orientation: "ns",
      metal: "yellow-gold",
    },
  };
}

describe("Studio view emailed ingest", () => {
  it("writes Event + source-record Evidence and no Observation", async () => {
    const store = new InMemoryContinuumStore();
    const row = source();
    const result = await ingestStudioViewEmailed(store, row);
    assert.equal(result.eventStatus, "inserted");
    assert.equal(result.evidenceStatus, "inserted");
    assert.equal(result.event.eventType, "studio.view_emailed");
    assert.equal(result.event.sourceRecordId, row.identifiedRecordId);
    assert.equal(result.event.subjectEntityId, null);
    assert.equal(result.evidence.sourceKind, "source-record");
    assert.equal(result.evidence.eventId, null);
    assert.equal(result.evidence.observationId, null);
    assert.equal(result.evidence.sourceRecordId, row.identifiedRecordId);
    assert.deepEqual(await store.listObservations(), []);
    assert.deepEqual(await store.listEntities(), []);
  });

  it("rejects PII in the ingest source", async () => {
    const store = new InMemoryContinuumStore();
    await assert.rejects(() =>
      ingestStudioViewEmailed(store, {
        ...source(),
        sharePath: "/diamond-studio?email=visitor@example.com",
      }),
    );
  });
});
