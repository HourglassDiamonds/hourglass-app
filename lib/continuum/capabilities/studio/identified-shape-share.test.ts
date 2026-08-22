import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { CONTINUUM_SCHEMA_VERSION } from "../../contracts/types";
import type { ContinuumEvent, ContinuumEvidence } from "../../contracts/types";
import { InMemoryContinuumStore } from "../../persistence/memory";
import { executeCapability } from "../runtime";
import type { CapabilityContext } from "../types";
import {
  STUDIO_IDENTIFIED_SHAPE_SHARE_ID,
  STUDIO_IDENTIFIED_SHAPE_SHARE_OBSERVATION_TYPE,
  studioIdentifiedShapeShareCapability,
} from "./identified-shape-share";
import {
  prepareStudioIdentifiedShapeShareInput,
  type StudioIdentifiedShapeShareInput,
  type StudioShapeFact,
} from "./read-model";

const JULY = {
  start: "2026-07-01T00:00:00.000Z",
  end: "2026-07-31T23:59:59.000Z",
};
const AUGUST = {
  start: "2026-08-01T00:00:00.000Z",
  end: "2026-08-31T23:59:59.000Z",
};

const silentLog = { info() {}, warn() {} };

function context(asOf: string, window = JULY): CapabilityContext {
  return {
    invocation: {
      invocationId: randomUUID(),
      capabilityId: STUDIO_IDENTIFIED_SHAPE_SHARE_ID,
      requestedAt: asOf,
      asOf,
      mode: "fixture",
      window,
    },
    now: () => new Date(asOf),
    log: silentLog,
  };
}

function eventRow(input: {
  recordId: string;
  occurredAt: string;
  shape: string;
}): ContinuumEvent {
  return {
    id: randomUUID(),
    schemaVersion: CONTINUUM_SCHEMA_VERSION,
    eventType: "studio.view_emailed",
    occurredAt: input.occurredAt,
    ingestedAt: input.occurredAt,
    producer: "diamond-studio-email-view",
    sourceSystem: "studio-identified",
    sourceRecordId: input.recordId,
    subjectEntityId: null,
    idempotencyKey: `studio.view_emailed:identified:${input.recordId}`,
    payload: {
      identifiedRecordId: input.recordId,
      sharePath: "/diamond-studio",
      configuration: {
        shape: input.shape,
        carat: 1.5,
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
    collectedAt: inputNow(recordId),
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

function inputNow(_recordId: string): string {
  return "2026-07-15T00:00:00.000Z";
}

async function seed(
  store: InMemoryContinuumStore,
  rows: Array<{ occurredAt: string; shape: string }>,
): Promise<{ recordIds: string[]; evidenceIds: string[] }> {
  const recordIds: string[] = [];
  const evidenceIds: string[] = [];
  for (const row of rows) {
    const recordId = randomUUID();
    const evidenceId = randomUUID();
    recordIds.push(recordId);
    evidenceIds.push(evidenceId);
    await store.insertEvent(
      eventRow({ recordId, occurredAt: row.occurredAt, shape: row.shape }),
    );
    await store.insertEvidence(evidenceRow(recordId, evidenceId));
  }
  return { recordIds, evidenceIds };
}

function preparedFromStore(
  store: InMemoryContinuumStore,
  window = JULY,
  asOf = "2026-08-01T00:00:00.000Z",
  freshness: StudioIdentifiedShapeShareInput["sourceHealth"]["freshness"] = "fresh",
): StudioIdentifiedShapeShareInput {
  return prepareStudioIdentifiedShapeShareInput({
    asOf,
    window,
    source: {
      kind: "snapshot",
      events: store.listEvents(),
      evidence: store.listEvidence(),
      freshness,
    },
  });
}

describe("studio-identified-shape-share capability", () => {
  it("computes shares and cites the full denominator", async () => {
    const store = new InMemoryContinuumStore();
    const seeded = await seed(store, [
      { occurredAt: "2026-07-02T00:00:00.000Z", shape: "oval" },
      { occurredAt: "2026-07-03T00:00:00.000Z", shape: "oval" },
      { occurredAt: "2026-07-04T00:00:00.000Z", shape: "round" },
      { occurredAt: "2026-07-05T00:00:00.000Z", shape: "round" },
    ]);
    const domainInput = preparedFromStore(store);
    const result = await executeCapability({
      capability: studioIdentifiedShapeShareCapability,
      domainInput,
      context: context("2026-08-01T00:00:00.000Z"),
      evidence: { getById: async (id) => store.getEvidenceById(id) },
    });
    assert.equal(result.status, "completed");
    assert.equal(result.observations.length, 2);
    const oval = result.observations.find((o) => o.value.shape === "oval");
    const round = result.observations.find((o) => o.value.shape === "round");
    assert.equal(oval?.value.count, 2);
    assert.equal(oval?.value.total, 4);
    assert.equal(oval?.value.share, 0.5);
    assert.equal(round?.value.count, 2);
    assert.equal(round?.value.total, 4);
    const expectedRefs = [...seeded.evidenceIds].sort();
    assert.deepEqual(oval?.evidenceRefs, expectedRefs);
    assert.deepEqual(round?.evidenceRefs, expectedRefs);
    assert.equal(oval?.subjectEntityId, null);
    assert.equal(oval?.epistemicClass, "derived");
    assert.equal(oval?.materiality, "monitor");
    assert.match(
      oval?.statement ?? "",
      /Oval represented 50% of identified Studio configurations during this window\./,
    );
    assert.equal(/demand|trending|prefer|purchase/i.test(oval?.statement ?? ""), false);
  });

  it("returns quiet success for a healthy empty source", async () => {
    const result = await studioIdentifiedShapeShareCapability.run(
      prepareStudioIdentifiedShapeShareInput({
        asOf: "2026-08-01T00:00:00.000Z",
        window: JULY,
        source: { kind: "snapshot", events: [], evidence: [] },
      }),
      context("2026-08-01T00:00:00.000Z"),
    );
    assert.equal(result.status, "completed");
    assert.deepEqual(result.observations, []);
    assert.equal(result.sourceHealth[0]?.availability, "empty");
  });

  it("blocks when the required source is unavailable", async () => {
    const result = await studioIdentifiedShapeShareCapability.run(
      prepareStudioIdentifiedShapeShareInput({
        asOf: "2026-08-01T00:00:00.000Z",
        window: JULY,
        source: { kind: "unavailable" },
      }),
      context("2026-08-01T00:00:00.000Z"),
    );
    assert.equal(result.status, "blocked");
    assert.deepEqual(result.observations, []);
  });

  it("blocks when the required source is not configured", async () => {
    const result = await studioIdentifiedShapeShareCapability.run(
      prepareStudioIdentifiedShapeShareInput({
        asOf: "2026-08-01T00:00:00.000Z",
        window: JULY,
        source: { kind: "not-configured" },
      }),
      context("2026-08-01T00:00:00.000Z"),
    );
    assert.equal(result.status, "blocked");
  });

  it("returns completed-degraded for degraded source with remaining facts", async () => {
    const goodId = randomUUID();
    const badId = randomUUID();
    const domainInput = prepareStudioIdentifiedShapeShareInput({
      asOf: "2026-08-01T00:00:00.000Z",
      window: JULY,
      source: {
        kind: "snapshot",
        events: [
          eventRow({
            recordId: goodId,
            occurredAt: "2026-07-10T00:00:00.000Z",
            shape: "oval",
          }),
          eventRow({
            recordId: badId,
            occurredAt: "2026-07-11T00:00:00.000Z",
            shape: "round",
          }),
        ],
        evidence: [evidenceRow(goodId)],
      },
    });
    const result = await studioIdentifiedShapeShareCapability.run(
      domainInput,
      context("2026-08-01T00:00:00.000Z"),
    );
    assert.equal(result.status, "completed-degraded");
    assert.equal(result.observations.length, 1);
    assert.equal(result.observations[0]?.value.shape, "oval");
    assert.equal(result.observations[0]?.value.total, 1);
  });

  it("returns completed-degraded for stale but usable source", async () => {
    const store = new InMemoryContinuumStore();
    await seed(store, [
      { occurredAt: "2026-07-02T00:00:00.000Z", shape: "marquise" },
    ]);
    const domainInput = preparedFromStore(
      store,
      JULY,
      "2026-08-01T00:00:00.000Z",
      "stale",
    );
    const result = await studioIdentifiedShapeShareCapability.run(
      domainInput,
      context("2026-08-01T00:00:00.000Z"),
    );
    assert.equal(result.status, "completed-degraded");
    assert.equal(result.observations[0]?.value.shape, "marquise");
  });

  it("owns value validation and rejects malformed values", () => {
    const ok = studioIdentifiedShapeShareCapability.validateObservationValue(
      STUDIO_IDENTIFIED_SHAPE_SHARE_OBSERVATION_TYPE,
      {
        shape: "oval",
        share: 0.5,
        count: 2,
        total: 4,
        windowStart: JULY.start,
        windowEnd: JULY.end,
      },
    );
    assert.equal(ok, true);
    assert.equal(
      studioIdentifiedShapeShareCapability.validateObservationValue(
        "other.type",
        {
          shape: "oval",
          share: 0.5,
          count: 2,
          total: 4,
          windowStart: JULY.start,
          windowEnd: JULY.end,
        },
      ),
      false,
    );
    assert.equal(
      studioIdentifiedShapeShareCapability.validateObservationValue(
        STUDIO_IDENTIFIED_SHAPE_SHARE_OBSERVATION_TYPE,
        {
          shape: "hexagon",
          share: 0.5,
          count: 2,
          total: 4,
          windowStart: JULY.start,
          windowEnd: JULY.end,
        },
      ),
      false,
    );
    assert.equal(
      studioIdentifiedShapeShareCapability.validateObservationValue(
        STUDIO_IDENTIFIED_SHAPE_SHARE_OBSERVATION_TYPE,
        {
          shape: "oval",
          share: 0.9,
          count: 2,
          total: 4,
          windowStart: JULY.start,
          windowEnd: JULY.end,
        },
      ),
      false,
    );
  });

  it("does not create entities, recommendations, or import Supabase", () => {
    const src = readFileSync(
      resolve(
        process.cwd(),
        "lib/continuum/capabilities/studio/identified-shape-share.ts",
      ),
      "utf8",
    );
    assert.equal(src.includes("Recommendation"), false);
    assert.equal(src.includes("chief-of-staff"), false);
    assert.equal(src.includes("HubSpot"), false);
    assert.equal(src.includes("supabase"), false);
    assert.equal(src.includes("LLM"), false);
    assert.equal(src.includes("demand"), false);
    assert.match(src, /studio-identified-shape-share/);
  });
});

describe("studio shape-share in-memory persistence", () => {
  it("writes Observation + join rows; one observation cites many evidence rows; two windows coexist", async () => {
    const store = new InMemoryContinuumStore();
    const julyRows: Array<{ occurredAt: string; shape: string }> = [
      ...Array.from({ length: 3 }, () => ({
        occurredAt: "2026-07-08T00:00:00.000Z",
        shape: "oval",
      })),
      ...Array.from({ length: 5 }, () => ({
        occurredAt: "2026-07-09T00:00:00.000Z",
        shape: "round",
      })),
    ];
    await seed(store, julyRows);
    const julyInput = preparedFromStore(store, JULY, "2026-08-01T00:00:00.000Z");
    const julyResult = await executeCapability({
      capability: studioIdentifiedShapeShareCapability,
      domainInput: julyInput,
      context: context("2026-08-01T00:00:00.000Z", JULY),
      evidence: { getById: async (id) => store.getEvidenceById(id) },
      persist: store,
    });
    const julyOval = julyResult.observations.find((o) => o.value.shape === "oval");
    assert.equal(julyOval?.value.share, 3 / 8);
    assert.match(julyOval?.statement ?? "", /38%/);

    const augustRows: Array<{ occurredAt: string; shape: string }> = [
      ...Array.from({ length: 4 }, () => ({
        occurredAt: "2026-08-08T00:00:00.000Z",
        shape: "oval",
      })),
      ...Array.from({ length: 5 }, () => ({
        occurredAt: "2026-08-09T00:00:00.000Z",
        shape: "round",
      })),
    ];
    await seed(store, augustRows);
    const augustInput = prepareStudioIdentifiedShapeShareInput({
      asOf: "2026-09-01T00:00:00.000Z",
      window: AUGUST,
      source: {
        kind: "snapshot",
        events: store.listEvents(),
        evidence: store.listEvidence(),
      },
    });
    const augustResult = await executeCapability({
      capability: studioIdentifiedShapeShareCapability,
      domainInput: augustInput,
      context: context("2026-09-01T00:00:00.000Z", AUGUST),
      evidence: { getById: async (id) => store.getEvidenceById(id) },
      persist: store,
    });
    const augustOval = augustResult.observations.find((o) => o.value.shape === "oval");
    assert.equal(augustOval?.value.count, 4);
    assert.equal(augustOval?.value.total, 9);
    assert.match(augustOval?.statement ?? "", /44%/);

    const observations = await store.listObservations();
    const ovalObs = observations.filter(
      (row) =>
        row.observationType === STUDIO_IDENTIFIED_SHAPE_SHARE_OBSERVATION_TYPE &&
        row.value &&
        row.value.shape === "oval",
    );
    assert.equal(ovalObs.length, 2);
    const julyStored = ovalObs.find((row) => row.validFrom === JULY.start);
    const augustStored = ovalObs.find((row) => row.validFrom === AUGUST.start);
    assert.ok(julyStored);
    assert.ok(augustStored);
    assert.equal(julyStored?.validUntil, JULY.end);
    assert.equal(augustStored?.validUntil, AUGUST.end);
    assert.equal(julyStored?.supersedesId, null);
    assert.equal(augustStored?.supersedesId, null);
    assert.notEqual(julyStored?.id, augustStored?.id);

    const julyLinks = await store.listEvidenceIdsForObservation(julyStored!.id);
    assert.equal(julyLinks.length, 8);
    const augustLinks = await store.listEvidenceIdsForObservation(augustStored!.id);
    assert.equal(augustLinks.length, 9);
    assert.equal((await store.listEntities()).length, 0);
  });
});

describe("studio fact typing", () => {
  it("keeps facts to occurredAt, shape, and evidenceId", () => {
    const fact: StudioShapeFact = {
      occurredAt: "2026-07-01T00:00:00.000Z",
      shape: "oval",
      evidenceId: randomUUID(),
    };
    assert.equal(Object.keys(fact).length, 3);
  });
});
