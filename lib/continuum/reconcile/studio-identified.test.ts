import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { InMemoryContinuumStore } from "../persistence/memory";
import { ingestStudioViewEmailed } from "../ingest/studio-view-emailed";
import type { StudioIdentifiedSourceRef } from "../ingest/studio-view-emailed";
import { createMemoryStudioIdentifiedSource } from "./source";
import { reconcileStudioIdentifiedEvents } from "./studio-identified";
import { findPiiViolation } from "../contracts/validation";

function source(id = randomUUID()): StudioIdentifiedSourceRef {
  return {
    identifiedRecordId: id,
    occurredAt: "2026-08-21T18:43:10.000Z",
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
  };
}

describe("Studio identified reconciliation", () => {
  it("repairs missing Event + Evidence", async () => {
    const store = new InMemoryContinuumStore();
    const row = source();
    const result = await reconcileStudioIdentifiedEvents({
      source: createMemoryStudioIdentifiedSource([row]),
      store,
    });
    assert.equal(result.scanned, 1);
    assert.equal(result.eventsInserted, 1);
    assert.equal(result.evidenceInserted, 1);
    assert.equal(result.skippedComplete, 0);
    assert.equal(result.observationsWritten, 0);
    assert.deepEqual(await store.listObservations(), []);
  });

  it("repairs Event present / Evidence missing", async () => {
    const store = new InMemoryContinuumStore();
    const row = source();
    const first = await ingestStudioViewEmailed(store, row);
    store.deleteEvidenceByIdempotencyKey(
      `studio-record:${row.identifiedRecordId}`,
    );
    assert.equal(
      await store.getEvidenceByIdempotencyKey(
        `studio-record:${row.identifiedRecordId}`,
      ),
      null,
    );
    assert.ok(await store.getEventByIdempotencyKey(first.event.idempotencyKey));
    const result = await reconcileStudioIdentifiedEvents({
      source: createMemoryStudioIdentifiedSource([row]),
      store,
    });
    assert.equal(result.repairedPartial, 1);
    assert.equal(result.eventsInserted, 0);
    assert.equal(result.evidenceInserted, 1);
    assert.equal(result.observationsWritten, 0);
  });

  it("skips fully represented rows and is idempotent", async () => {
    const store = new InMemoryContinuumStore();
    const row = source();
    await ingestStudioViewEmailed(store, row);
    const first = await reconcileStudioIdentifiedEvents({
      source: createMemoryStudioIdentifiedSource([row]),
      store,
    });
    const second = await reconcileStudioIdentifiedEvents({
      source: createMemoryStudioIdentifiedSource([row]),
      store,
    });
    assert.equal(first.skippedComplete, 1);
    assert.equal(first.eventsInserted, 0);
    assert.equal(second.skippedComplete, 1);
    assert.equal(second.eventsInserted, 0);
    assert.equal(second.evidenceInserted, 0);
    assert.equal(findPiiViolation(second), null);
    assert.deepEqual(await store.listObservations(), []);
  });
});
