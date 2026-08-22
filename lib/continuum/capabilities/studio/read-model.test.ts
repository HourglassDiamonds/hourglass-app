import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { CONTINUUM_SCHEMA_VERSION } from "../../contracts/types";
import type { ContinuumEvent, ContinuumEvidence } from "../../contracts/types";
import { InMemoryContinuumStore } from "../../persistence/memory";
import {
  prepareStudioIdentifiedShapeShareInput,
  type StudioShapeFact,
} from "./read-model";

const WINDOW = {
  start: "2026-07-01T00:00:00.000Z",
  end: "2026-07-31T23:59:59.000Z",
};
const AS_OF = "2026-08-01T00:00:00.000Z";

function eventRow(input: {
  id?: string;
  recordId: string;
  occurredAt: string;
  shape: string;
}): ContinuumEvent {
  const recordId = input.recordId;
  return {
    id: input.id ?? randomUUID(),
    schemaVersion: CONTINUUM_SCHEMA_VERSION,
    eventType: "studio.view_emailed",
    occurredAt: input.occurredAt,
    ingestedAt: input.occurredAt,
    producer: "diamond-studio-email-view",
    sourceSystem: "studio-identified",
    sourceRecordId: recordId,
    subjectEntityId: null,
    idempotencyKey: `studio.view_emailed:identified:${recordId}`,
    payload: {
      identifiedRecordId: recordId,
      sharePath: "/diamond-studio",
      configuration: {
        shape: input.shape,
        carat: 2,
        ringSize: 6,
        bandWidth: 2,
        skinTone: "light",
        orientation: "ns",
        metal: "yellow-gold",
      },
    },
  };
}

function evidenceRow(recordId: string, id = randomUUID()): ContinuumEvidence {
  return {
    id,
    schemaVersion: CONTINUUM_SCHEMA_VERSION,
    sourceSystem: "studio-identified",
    sourceKind: "source-record",
    sourceRecordId: recordId,
    eventId: null,
    observationId: null,
    collectedAt: "2026-07-15T12:00:00.000Z",
    reportingPeriod: null,
    freshness: "fresh",
    reliability: "reliable",
    redactionStatus: "clean",
    summary: "Identified Studio view emailed",
    supportingPointer: `diamond_studio_identified_events:${recordId}`,
    idempotencyKey: `studio-record:${recordId}`,
    claimFingerprint: null,
  };
}

describe("studio identified shape-share read model", () => {
  it("joins Event+Evidence into a PII-safe fact", () => {
    const recordId = randomUUID();
    const evidenceId = randomUUID();
    const prepared = prepareStudioIdentifiedShapeShareInput({
      asOf: AS_OF,
      window: WINDOW,
      source: {
        kind: "snapshot",
        events: [
          eventRow({
            recordId,
            occurredAt: "2026-07-10T12:00:00.000Z",
            shape: "oval",
          }),
        ],
        evidence: [evidenceRow(recordId, evidenceId)],
      },
    });
    assert.equal(prepared.sourceHealth.availability, "available");
    assert.equal(prepared.sourceHealth.quality, "healthy");
    assert.equal(prepared.facts.length, 1);
    const fact = prepared.facts[0] as StudioShapeFact;
    assert.deepEqual(Object.keys(fact).sort(), [
      "evidenceId",
      "occurredAt",
      "shape",
    ]);
    assert.equal(fact.shape, "oval");
    assert.equal(fact.evidenceId, evidenceId);
    assert.equal("email" in fact, false);
    assert.equal("carat" in fact, false);
    assert.equal("sharePath" in fact, false);
  });

  it("skips Event with no Evidence and marks degraded", () => {
    const prepared = prepareStudioIdentifiedShapeShareInput({
      asOf: AS_OF,
      window: WINDOW,
      source: {
        kind: "snapshot",
        events: [
          eventRow({
            recordId: randomUUID(),
            occurredAt: "2026-07-10T12:00:00.000Z",
            shape: "round",
          }),
        ],
        evidence: [],
      },
    });
    assert.deepEqual(prepared.facts, []);
    assert.equal(prepared.sourceHealth.availability, "available");
    assert.equal(prepared.sourceHealth.quality, "degraded");
  });

  it("skips invalid shape and marks degraded", () => {
    const recordId = randomUUID();
    const prepared = prepareStudioIdentifiedShapeShareInput({
      asOf: AS_OF,
      window: WINDOW,
      source: {
        kind: "snapshot",
        events: [
          eventRow({
            recordId,
            occurredAt: "2026-07-10T12:00:00.000Z",
            shape: "hexagon",
          }),
        ],
        evidence: [evidenceRow(recordId)],
      },
    });
    assert.deepEqual(prepared.facts, []);
    assert.equal(prepared.sourceHealth.quality, "degraded");
  });

  it("does not emit a fact for Evidence with no Event", () => {
    const prepared = prepareStudioIdentifiedShapeShareInput({
      asOf: AS_OF,
      window: WINDOW,
      source: {
        kind: "snapshot",
        events: [],
        evidence: [evidenceRow(randomUUID())],
      },
    });
    assert.deepEqual(prepared.facts, []);
    assert.equal(prepared.sourceHealth.availability, "empty");
    assert.equal(prepared.sourceHealth.quality, "healthy");
  });

  it("excludes events outside the window", () => {
    const recordId = randomUUID();
    const prepared = prepareStudioIdentifiedShapeShareInput({
      asOf: AS_OF,
      window: WINDOW,
      source: {
        kind: "snapshot",
        events: [
          eventRow({
            recordId,
            occurredAt: "2026-06-30T23:59:59.000Z",
            shape: "oval",
          }),
        ],
        evidence: [evidenceRow(recordId)],
      },
    });
    assert.equal(prepared.sourceHealth.availability, "empty");
    assert.deepEqual(prepared.facts, []);
  });

  it("excludes events after asOf", () => {
    const recordId = randomUUID();
    const prepared = prepareStudioIdentifiedShapeShareInput({
      asOf: "2026-07-05T00:00:00.000Z",
      window: WINDOW,
      source: {
        kind: "snapshot",
        events: [
          eventRow({
            recordId,
            occurredAt: "2026-07-10T12:00:00.000Z",
            shape: "oval",
          }),
        ],
        evidence: [evidenceRow(recordId)],
      },
    });
    assert.equal(prepared.sourceHealth.availability, "empty");
  });

  it("reports healthy empty when Continuum has no in-window events", () => {
    const prepared = prepareStudioIdentifiedShapeShareInput({
      asOf: AS_OF,
      window: WINDOW,
      source: { kind: "snapshot", events: [], evidence: [] },
    });
    assert.equal(prepared.sourceHealth.availability, "empty");
    assert.equal(prepared.sourceHealth.quality, "healthy");
    assert.equal(prepared.sourceHealth.freshness, "fresh");
  });

  it("reports unavailable without inferring from empty facts", () => {
    const prepared = prepareStudioIdentifiedShapeShareInput({
      asOf: AS_OF,
      window: WINDOW,
      source: { kind: "unavailable" },
    });
    assert.equal(prepared.sourceHealth.availability, "unavailable");
    assert.equal(prepared.sourceHealth.quality, "unknown");
    assert.equal(prepared.sourceHealth.freshness, "unknown");
    assert.deepEqual(prepared.facts, []);
  });

  it("reports not-configured", () => {
    const prepared = prepareStudioIdentifiedShapeShareInput({
      asOf: AS_OF,
      window: WINDOW,
      source: { kind: "not-configured" },
    });
    assert.equal(prepared.sourceHealth.availability, "not-configured");
    assert.equal(prepared.sourceHealth.freshness, "unavailable");
  });

  it("can be driven from the in-memory Continuum store", async () => {
    const store = new InMemoryContinuumStore();
    const recordId = randomUUID();
    await store.insertEvent(
      eventRow({
        recordId,
        occurredAt: "2026-07-12T00:00:00.000Z",
        shape: "pear",
      }),
    );
    await store.insertEvidence(evidenceRow(recordId));
    const prepared = prepareStudioIdentifiedShapeShareInput({
      asOf: AS_OF,
      window: WINDOW,
      source: {
        kind: "snapshot",
        events: store.listEvents(),
        evidence: store.listEvidence(),
      },
    });
    assert.equal(prepared.facts[0]?.shape, "pear");
  });
});
