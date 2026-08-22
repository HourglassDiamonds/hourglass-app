/**
 * Generic Capability runtime. Must stay domain-neutral.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { CONTINUUM_SCHEMA_VERSION, type ContinuumEvidence } from "../contracts/types";
import { InMemoryContinuumStore } from "../persistence/memory";
import { executeCapability } from "./runtime";
import { CAPABILITY_CONTRACT_VERSION } from "./types";
import type {
  Capability,
  CapabilityContext,
  CapabilityDefinition,
  CapabilitySourceHealth,
  JsonValue,
  ObservationDraft,
} from "./types";

const NOW = "2026-08-21T20:00:00.000Z";

const silentLog = {
  info() {},
  warn() {},
};

function context(
  capabilityId: string,
  extras?: Partial<CapabilityContext["invocation"]>,
): CapabilityContext {
  return {
    invocation: {
      invocationId: randomUUID(),
      capabilityId,
      requestedAt: NOW,
      asOf: NOW,
      mode: "fixture",
      ...extras,
    },
    now: () => new Date(NOW),
    log: silentLog,
  };
}

const baseDefinition: CapabilityDefinition = {
  capabilityId: "test-capability",
  contractVersion: CAPABILITY_CONTRACT_VERSION,
  capabilityVersion: "1.0.0",
  domain: "other",
  requiredSources: ["continuum"],
  allowedObservationTypes: ["test.finding"],
  reads: ["continuum.evidence"],
  producesObservations: true,
};

function continuumHealth(
  extras?: Partial<CapabilitySourceHealth>,
): CapabilitySourceHealth[] {
  return [
    {
      sourceId: "continuum",
      required: true,
      availability: "available",
      quality: "healthy",
      freshness: "fresh",
      note: "ok",
      ...extras,
    },
  ];
}

function draft(evidenceId: string, extras?: Partial<ObservationDraft>): ObservationDraft {
  return {
    observationType: "test.finding",
    subjectEntityId: null,
    statement: "A derived test finding.",
    value: { n: 1 },
    epistemicClass: "derived",
    confidence: 1,
    evidenceRefs: [evidenceId],
    materiality: "monitor",
    urgency: "low",
    ...extras,
  };
}

function capabilityWithRun(
  run: Capability<null>["run"],
  definition: CapabilityDefinition = baseDefinition,
): Capability<null> {
  return {
    definition,
    run,
    validateObservationValue(observationType, value): value is JsonValue {
      return observationType === "test.finding" && isJsonValueLocal(value);
    },
  };
}

function isJsonValueLocal(value: unknown): value is JsonValue {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "boolean") return true;
  if (t === "number") return Number.isFinite(value as number);
  if (Array.isArray(value)) return value.every(isJsonValueLocal);
  if (t === "object") {
    return Object.values(value as Record<string, unknown>).every(isJsonValueLocal);
  }
  return false;
}

function evidenceRow(id: string, kind: ContinuumEvidence["sourceKind"] = "source-record"): ContinuumEvidence {
  return {
    id,
    schemaVersion: CONTINUUM_SCHEMA_VERSION,
    sourceSystem: "studio-identified",
    sourceKind: kind,
    sourceRecordId: kind === "source-record" ? randomUUID() : null,
    eventId: kind === "event" ? randomUUID() : null,
    observationId: kind === "observation" ? randomUUID() : null,
    collectedAt: NOW,
    reportingPeriod: null,
    freshness: "fresh",
    reliability: "reliable",
    redactionStatus: "clean",
    summary: "fixture",
    supportingPointer: null,
    idempotencyKey: `fix-${id}`,
    claimFingerprint: null,
  };
}

describe("capability contract validation", () => {
  it("rejects unsupported contract version", async () => {
    const cap = capabilityWithRun(async () => {
      throw new Error("should not run");
    }, {
      ...baseDefinition,
      contractVersion: "0.0.1" as typeof CAPABILITY_CONTRACT_VERSION,
    });
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "unsupported-contract-version");
    assert.deepEqual(result.observations, []);
  });

  it("rejects invocation capabilityId mismatch", async () => {
    const cap = capabilityWithRun(async () => {
      throw new Error("should not run");
    });
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("other-id"),
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "capability-id-mismatch");
  });

  it("rejects undeclared observation type", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(evidenceId, { observationType: "not.allowed" })],
      sourceHealth: continuumHealth(),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "undeclared-observation-type");
  });

  it("rejects invalid confidence", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(evidenceId, { confidence: 1.2 })],
      sourceHealth: continuumHealth(),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "invalid-confidence");
  });

  it("rejects zero evidence refs", async () => {
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [
        draft(randomUUID(), {
          evidenceRefs: [] as unknown as [string, ...string[]],
        }),
      ],
      sourceHealth: continuumHealth(),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(randomUUID()) },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "empty-evidence-refs");
  });

  it("rejects observation-kind evidence", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(evidenceId)],
      sourceHealth: continuumHealth(),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: {
        getById: async () => evidenceRow(evidenceId, "observation"),
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "observation-kind-evidence");
  });

  it("rejects missing evidence", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(evidenceId)],
      sourceHealth: continuumHealth(),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => null },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "missing-evidence");
  });

  it("rejects malformed value through capability validator", async () => {
    const evidenceId = randomUUID();
    const cap: Capability<null> = {
      definition: baseDefinition,
      validateObservationValue: (
        observationType,
        value,
      ): value is JsonValue =>
        observationType === "__never__" && typeof value === "string",
      run: async () => ({
        status: "completed",
        observations: [draft(evidenceId)],
        sourceHealth: continuumHealth(),
        diagnostics: { capabilityVersion: "1.0.0", notes: [] },
      }),
    };
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "invalid-observation-value");
  });

  it("rejects PII in observation drafts", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [
        draft(evidenceId, { statement: "Email visitor@example.com a follow-up." }),
      ],
      sourceHealth: continuumHealth(),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "pii");
  });

  it("rejects non JSON-safe values", async () => {
    const evidenceId = randomUUID();
    const withDate = capabilityWithRun(async () => {
      const d = draft(evidenceId);
      (d as { value: unknown }).value = { when: new Date(NOW) };
      return {
        status: "completed",
        observations: [d],
        sourceHealth: continuumHealth(),
        diagnostics: { capabilityVersion: "1.0.0", notes: [] },
      };
    });
    const result = await executeCapability({
      capability: withDate,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "invalid-observation-value");
  });
});

describe("producesObservations and requiredSources enforcement", () => {
  it("rejects observations when producesObservations is false", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(
      async () => ({
        status: "completed",
        observations: [draft(evidenceId)],
        sourceHealth: continuumHealth(),
        diagnostics: { capabilityVersion: "1.0.0", notes: [] },
      }),
      { ...baseDefinition, producesObservations: false },
    );
    const store = new InMemoryContinuumStore();
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
      persist: store,
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "invalid-result");
    assert.deepEqual(result.observations, []);
    assert.equal((await store.listObservations()).length, 0);
  });

  it("rejects a required source missing from sourceHealth", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(evidenceId)],
      sourceHealth: [],
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const store = new InMemoryContinuumStore();
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
      persist: store,
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "invalid-source-health");
    assert.deepEqual(result.observations, []);
    assert.equal((await store.listObservations()).length, 0);
  });

  it("rejects a required source marked required=false", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(evidenceId)],
      sourceHealth: continuumHealth({ required: false }),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "invalid-source-health");
  });

  it("rejects required source unavailable reported as completed", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(evidenceId)],
      sourceHealth: continuumHealth({
        availability: "unavailable",
        quality: "unknown",
        freshness: "unknown",
      }),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "invalid-source-health");
    assert.deepEqual(result.observations, []);
  });

  it("rejects required source not-configured reported as completed", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(evidenceId)],
      sourceHealth: continuumHealth({
        availability: "not-configured",
        quality: "unknown",
        freshness: "unavailable",
      }),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "invalid-source-health");
  });

  it("accepts required source unavailable reported as blocked", async () => {
    const cap = capabilityWithRun(async () => ({
      status: "blocked",
      observations: [],
      sourceHealth: continuumHealth({
        availability: "unavailable",
        quality: "unknown",
        freshness: "unknown",
        note: "down",
      }),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
    });
    assert.equal(result.status, "blocked");
    assert.deepEqual(result.observations, []);
  });

  it("accepts required source empty as completed with no observations", async () => {
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [],
      sourceHealth: continuumHealth({
        availability: "empty",
        quality: "healthy",
      }),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
    });
    assert.equal(result.status, "completed");
    assert.deepEqual(result.observations, []);
  });

  it("accepts required stale/degraded as completed-degraded", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(async () => ({
      status: "completed-degraded",
      observations: [draft(evidenceId)],
      sourceHealth: continuumHealth({
        quality: "degraded",
        freshness: "stale",
        note: "partial",
      }),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
    });
    assert.equal(result.status, "completed-degraded");
    assert.equal(result.observations.length, 1);
  });

  it("rejects required degraded reported as completed with observations", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(evidenceId)],
      sourceHealth: continuumHealth({ quality: "degraded" }),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "invalid-source-health");
  });
});

describe("generic capability runtime", () => {
  it("returns completed with observations", async () => {
    const evidenceId = randomUUID();
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(evidenceId)],
      sourceHealth: continuumHealth(),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async () => evidenceRow(evidenceId) },
    });
    assert.equal(result.status, "completed");
    assert.equal(result.observations.length, 1);
  });

  it("returns completed with empty observations", async () => {
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [],
      sourceHealth: continuumHealth({ availability: "empty" }),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
    });
    assert.equal(result.status, "completed");
    assert.deepEqual(result.observations, []);
  });

  it("returns completed-degraded", async () => {
    const cap = capabilityWithRun(async () => ({
      status: "completed-degraded",
      observations: [],
      sourceHealth: [
        {
          sourceId: "continuum",
          required: true,
          availability: "available",
          quality: "degraded",
          freshness: "fresh",
          note: "partial",
        },
      ],
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
    });
    assert.equal(result.status, "completed-degraded");
  });

  it("returns blocked without treating it as failed", async () => {
    const cap = capabilityWithRun(async () => ({
      status: "blocked",
      observations: [],
      sourceHealth: [
        {
          sourceId: "continuum",
          required: true,
          availability: "unavailable",
          quality: "unknown",
          freshness: "unknown",
          note: "down",
        },
      ],
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
    });
    assert.equal(result.status, "blocked");
    assert.notEqual(result.failureCode, "unexpected");
  });

  it("maps unexpected throw to failed", async () => {
    const cap = capabilityWithRun(async () => {
      throw new Error("boom");
    });
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "unexpected");
    assert.deepEqual(result.observations, []);
  });

  it("does not persist failed results", async () => {
    const store = new InMemoryContinuumStore();
    const cap = capabilityWithRun(async () => {
      throw new Error("boom");
    });
    await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      persist: store,
    });
    assert.equal((await store.listObservations()).length, 0);
  });

  it("does not persist blocked results", async () => {
    const store = new InMemoryContinuumStore();
    const cap = capabilityWithRun(async () => ({
      status: "blocked",
      observations: [],
      sourceHealth: continuumHealth({
        availability: "unavailable",
        quality: "unknown",
        freshness: "unknown",
        note: "down",
      }),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      persist: store,
    });
    assert.equal((await store.listObservations()).length, 0);
  });

  it("contains no Studio or Agent OS coupling", () => {
    const runtimeSrc = readFileSync(
      resolve(process.cwd(), "lib/continuum/capabilities/runtime.ts"),
      "utf8",
    );
    const typesSrc = readFileSync(
      resolve(process.cwd(), "lib/continuum/capabilities/types.ts"),
      "utf8",
    );
    for (const src of [runtimeSrc, typesSrc]) {
      assert.doesNotMatch(src, /from ["'][^"']*capabilities\/studio/);
      assert.doesNotMatch(src, /from ["'][^"']*diamond-studio/);
      assert.doesNotMatch(src, /from ["'][^"']*agent-os/);
      assert.doesNotMatch(src, /from ["']@supabase/);
      assert.equal(src.includes("ShapeId"), false);
      assert.equal(src.includes("StudioShapeShareValue"), false);
      assert.equal(/\bRecommendation\b/.test(src), false);
      assert.equal(/\bHubSpot\b/.test(src), false);
      assert.equal(/\bSupabase\b/.test(src), false);
      assert.equal(/if\s*\(.*domain\s*===\s*"studio"/.test(src), false);
    }
  });
});

describe("in-memory persistence proof", () => {
  it("persists a valid draft with multiple evidence links and no supersession", async () => {
    const store = new InMemoryContinuumStore();
    const e1 = randomUUID();
    const e2 = randomUUID();
    await store.insertEvidence({
      ...evidenceRow(e1),
      idempotencyKey: `studio-record:${e1}`,
    });
    await store.insertEvidence({
      ...evidenceRow(e2),
      idempotencyKey: `studio-record:${e2}`,
    });
    const cap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(e1, { evidenceRefs: [e2, e1, e1] })],
      sourceHealth: continuumHealth(),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const result = await executeCapability({
      capability: cap,
      domainInput: null,
      context: context("test-capability"),
      evidence: {
        getById: async (id) => store.getEvidenceById(id),
      },
      persist: store,
    });
    assert.equal(result.status, "completed");
    assert.deepEqual(result.observations[0]?.evidenceRefs, [e1, e2].sort());
    const rows = await store.listObservations();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.producedBy, "test-capability@1.0.0");
    assert.equal(rows[0]?.supersedesId, null);
    const linked = await store.listEvidenceIdsForObservation(rows[0]!.id);
    assert.deepEqual(linked, [e1, e2].sort());
  });

  it("persists nested JSON-safe values without flattening to null", async () => {
    const store = new InMemoryContinuumStore();
    const evidenceId = randomUUID();
    await store.insertEvidence({
      ...evidenceRow(evidenceId),
      idempotencyKey: `studio-record:${evidenceId}`,
    });
    const nested = {
      shape: "oval",
      metrics: { share: 0.42, count: 4 },
      samples: [1, 2, 3],
    };
    const nestedCap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(evidenceId, { value: nested })],
      sourceHealth: continuumHealth(),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const nestedResult = await executeCapability({
      capability: nestedCap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async (id) => store.getEvidenceById(id) },
      persist: store,
    });
    assert.equal(nestedResult.status, "completed");
    const nestedStored = (await store.listObservations())[0];
    assert.deepEqual(nestedStored?.value, nested);

    store.reset();
    await store.insertEvidence({
      ...evidenceRow(evidenceId),
      idempotencyKey: `studio-record:${evidenceId}`,
    });
    const arrayValue = ["oval", "round"];
    const arrayCap = capabilityWithRun(async () => ({
      status: "completed",
      observations: [draft(evidenceId, { value: arrayValue })],
      sourceHealth: continuumHealth(),
      diagnostics: { capabilityVersion: "1.0.0", notes: [] },
    }));
    const arrayResult = await executeCapability({
      capability: arrayCap,
      domainInput: null,
      context: context("test-capability"),
      evidence: { getById: async (id) => store.getEvidenceById(id) },
      persist: store,
    });
    assert.equal(arrayResult.status, "completed");
    assert.deepEqual((await store.listObservations())[0]?.value, arrayValue);
  });
});
