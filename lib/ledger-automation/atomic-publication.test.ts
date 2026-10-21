import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OCTOBER_10_LEDGER_PUBLICATION,
  OCTOBER_10_LEDGER_PUBLICATION_ID,
} from "./baseline-publication";
import { createFixtureAdapter } from "./adapters";
import { buildRunKey, runLedgerAutomation } from "./engine";
import { buildCanonicalPublication } from "./publication-factory";
import { MemoryLedgerPublicationStore } from "./publication-store";
import { evaluateSafeUpdateAutoPublish } from "./auto-publish-policy";
import { publishLedgerPublication } from "./publication-writer";
import { validateLedgerPublication } from "./publication-validation";
import { evaluateLedgerSchedule } from "./schedule";
import { LEDGER_SOURCE_REGISTRY } from "./source-registry";
import { decideLedgerPublication, executeManualFullLedgerRun, executeScheduledLedgerRun, reviewLedgerRun } from "./service";
import { MemoryLedgerAutomationStore } from "./store";
import { validatePublishedLedger } from "./post-publication-acceptance";
import type { LedgerPublication, LedgerPublicationPointer } from "./publication-types";

const BASELINE_POINTER: LedgerPublicationPointer = {
  schemaVersion: "ledger-publication-pointer-v1",
  currentPublicationId: OCTOBER_10_LEDGER_PUBLICATION_ID,
  previousPublicationId: "ledger-2026-10-01",
  updatedAt: "2026-10-10T12:00:00.000Z",
};

function store() {
  return new MemoryLedgerPublicationStore({ current: BASELINE_POINTER });
}

function candidate(): LedgerPublication {
  const publicationDate = "October 13, 2026";
  const copy = structuredClone(OCTOBER_10_LEDGER_PUBLICATION);
  return {
    ...copy,
    publicationId: "ledger-2026-10-13-publication",
    publicationDate,
    evidenceReviewedThrough: publicationDate,
    createdAt: "2026-10-13T10:30:00.000Z",
    approvedAt: "2026-10-13T10:30:00.000Z",
    publishedAt: "2026-10-13T10:30:00.000Z",
    runId: "ledger-2026-10-13-tuesday-full",
    runType: "TUESDAY_FULL",
    previousPublicationId: OCTOBER_10_LEDGER_PUBLICATION_ID,
    overall: {
      ...copy.overall,
      temperatureSnapshot: {
        ...copy.overall.temperatureSnapshot,
        reviewDate: publicationDate,
        evidenceCutoff: publicationDate,
      },
    },
    monitors: copy.monitors.map((monitor) => ({
      ...monitor,
      publicationDate,
      evidenceReviewedThrough: publicationDate,
    })),
    bufferHealth: {
      ...copy.bufferHealth,
      publicationDate,
      evidenceReviewedThrough: publicationDate,
      domains: copy.bufferHealth.domains.map((domain) => ({
        ...domain,
        publicationDate,
        evidenceReviewedThrough: publicationDate,
      })),
    },
    historicalComparison: {
      previousPublicationId: OCTOBER_10_LEDGER_PUBLICATION_ID,
      previousPublicationDate: "October 10, 2026",
      temperatureDelta: 0,
    },
    audit: {
      ...copy.audit,
      classification: "SAFE_UPDATE",
      approvalRequired: false,
      founderDecision: null,
      publicationStatus: "APPROVED",
      materiallyNewNarrativeClaim: false,
    },
  };
}

async function issues(publication: LedgerPublication) {
  return validateLedgerPublication(publication, {
    publicationIdExists: async () => false,
    predecessorExists: async (id) => id === OCTOBER_10_LEDGER_PUBLICATION_ID,
  });
}

async function materialRun() {
  const target = LEDGER_SOURCE_REGISTRY.find((source) => source.monitorId === "global-pressure");
  assert.ok(target);
  return runLedgerAutomation({
    runType: "TUESDAY_FULL",
    scheduledDate: "2026-10-13",
    startedAt: "2026-10-13T10:30:00.000Z",
    registry: LEDGER_SOURCE_REGISTRY,
    adapter: createFixtureAdapter({
      [target.sourceId]: {
        normalizedObservation: {
          summary: "Material fixture for founder review.",
          proposedMonitorState: "Critical external pressure / Systemic transmission",
          significance: "MATERIAL",
        },
      },
    }),
  });
}

describe("Ledger Automation V2 canonical validation", () => {
  it("accepts a complete canonical publication", async () => assert.deepEqual(await issues(candidate()), []));

  it("rejects monitor and Buffer date drift", async () => {
    const value = candidate();
    value.monitors[0]!.evidenceReviewedThrough = "October 12, 2026";
    value.bufferHealth.domains[0]!.publicationDate = "October 12, 2026";
    const codes = (await issues(value)).map((issue) => issue.code);
    assert.ok(codes.includes("monitor-date-drift"));
    assert.ok(codes.includes("buffer-date-drift"));
  });

  it("rejects hub state and direction drift", async () => {
    const value = candidate();
    value.monitors[0]!.hubState = "Different";
    value.monitors[1]!.hubDirection = "Different";
    const codes = (await issues(value)).map((issue) => issue.code);
    assert.ok(codes.includes("hub-monitor-state"));
    assert.ok(codes.includes("hub-monitor-direction"));
  });

  it("rejects a missing or unsupported monitor", async () => {
    const value = candidate();
    value.monitors = value.monitors.slice(1);
    assert.ok((await issues(value)).some((issue) => issue.code === "monitor-set"));
  });

  it("rejects a missing Buffer domain", async () => {
    const value = candidate();
    value.bufferHealth.domains = value.bufferHealth.domains.slice(1);
    assert.ok((await issues(value)).some((issue) => issue.code === "buffer-domain-set"));
  });

  it("rejects temperature and qualitative-state inconsistency", async () => {
    const value = candidate();
    value.overall.temperature = 75;
    const codes = (await issues(value)).map((issue) => issue.code);
    assert.ok(codes.includes("temperature-methodology"));
    assert.ok(codes.includes("qualitative-state"));
  });

  it("rejects missing predecessors, invalid sources, and unsafe required-source failures", async () => {
    const value = candidate();
    value.previousPublicationId = "missing";
    value.monitors[0]!.sourceReferences = [];
    value.audit.requiredSourceFailure = true;
    const codes = (await issues(value)).map((issue) => issue.code);
    assert.ok(codes.includes("missing-predecessor"));
    assert.ok(codes.includes("invalid-source-reference"));
    assert.ok(codes.includes("required-source-failure"));
  });
});

describe("Ledger Automation V2 atomic writer and history", () => {
  it("appends history and advances the current pointer only after validation", async () => {
    const repository = store();
    const result = await publishLedgerPublication(repository, candidate(), new Date("2026-10-13T10:30:00.000Z"));
    assert.equal(result.currentPointer.pointer.currentPublicationId, "ledger-2026-10-13-publication");
    assert.equal((await repository.getPublication("ledger-2026-10-13-publication"))?.previousPublicationId, OCTOBER_10_LEDGER_PUBLICATION_ID);
  });

  it("rejects duplicate publication IDs", async () => {
    const repository = store();
    await publishLedgerPublication(repository, candidate());
    await assert.rejects(() => publishLedgerPublication(repository, candidate()), /predecessor|already exists|Duplicate/);
  });

  it("leaves the old current publication authoritative on a pointer failure", async () => {
    const repository = store();
    repository.failNextPointerWrite = true;
    await assert.rejects(() => publishLedgerPublication(repository, candidate()), /pointer failure/);
    assert.equal((await repository.getCurrentPointer())?.pointer.currentPublicationId, OCTOBER_10_LEDGER_PUBLICATION_ID);
  });

  it("never leaks later data into the frozen October 10 snapshot", async () => {
    const repository = store();
    const before = structuredClone(OCTOBER_10_LEDGER_PUBLICATION);
    const later = candidate();
    later.monitors[0]!.summary = "Later-only evidence";
    await publishLedgerPublication(repository, later);
    assert.deepEqual(OCTOBER_10_LEDGER_PUBLICATION, before);
    assert.notEqual((await repository.getPublication(later.publicationId))?.monitors[0]?.summary, before.monitors[0]?.summary);
  });
});

describe("Ledger Automation V2 policy and decisions", () => {
  it("keeps superseded evidence immutable and isolates a manual full run key", async () => {
    const runs = new MemoryLedgerAutomationStore();
    const original = await runLedgerAutomation({
      runType: "TUESDAY_FULL",
      scheduledDate: "2026-10-20",
      startedAt: "2026-10-20T10:30:00.000Z",
      registry: LEDGER_SOURCE_REGISTRY,
      adapter: createFixtureAdapter({
        [LEDGER_SOURCE_REGISTRY[0]!.sourceId]: {
          normalizedObservation: {
            ...LEDGER_SOURCE_REGISTRY[0]!.baselineNormalizedObservation,
            significance: "MATERIAL",
          },
        },
      }),
    });
    await runs.appendRun(original);
    const before = structuredClone((await runs.getRun(original.runKey))!.evidencePacket);
    const decision = await reviewLedgerRun({
      runKey: original.runKey,
      decision: "NEEDS_REVISION",
      decidedAt: "2026-10-21T12:00:00.000Z",
      decidedBy: "founder",
      note: "Superseded by newer review.",
      store: runs,
    });
    const manual = await executeManualFullLedgerRun({
      reviewDate: "2026-10-21",
      now: new Date("2026-10-21T12:00:00.000Z"),
      store: runs,
      publicationStore: store(),
      acceptance: false,
    });
    assert.equal(decision.resultingState, "NEEDS_REVISION");
    assert.deepEqual((await runs.getRun(original.runKey))!.evidencePacket, before);
    assert.equal(manual.run.runKey, "ledger:2026-10-21:manual-full");
    assert.notEqual(manual.run.runKey, buildRunKey("2026-10-21", "TUESDAY_FULL"));
  });

  it("allows only an interpretation-preserving SAFE_UPDATE", () => {
    assert.deepEqual(evaluateSafeUpdateAutoPublish(OCTOBER_10_LEDGER_PUBLICATION, candidate()), { eligible: true, reasons: [] });
  });

  it("blocks monitor, Buffer, temperature, methodology, narrative, confidence, and source changes", () => {
    const mutations: Array<(value: LedgerPublication) => void> = [
      (value) => { value.monitors[0]!.state = "Changed"; },
      (value) => { value.bufferHealth.domains[0]!.state = "Critical"; },
      (value) => { value.overall.temperature = 75; },
      (value) => { value.audit.methodologyChanged = true; },
      (value) => { value.audit.materiallyNewNarrativeClaim = true; },
      (value) => { value.overall.confidence = "low"; },
      (value) => { value.audit.requiredSourceFailure = true; },
    ];
    for (const mutate of mutations) {
      const value = candidate();
      mutate(value);
      assert.equal(evaluateSafeUpdateAutoPublish(OCTOBER_10_LEDGER_PUBLICATION, value).eligible, false);
    }
  });

  it("records NO_CHANGE without creating or advancing a publication", async () => {
    const runs = new MemoryLedgerAutomationStore();
    const publications = store();
    const result = await executeScheduledLedgerRun({
      runType: "TUESDAY_FULL",
      now: new Date("2026-10-13T10:30:00.000Z"),
      store: runs,
      publicationStore: publications,
      acceptance: false,
    });
    assert.equal(result.run.classification, "NO_CHANGE");
    assert.equal(result.run.publicationOccurred, false);
    assert.equal((await publications.getCurrentPointer())?.pointer.currentPublicationId, OCTOBER_10_LEDGER_PUBLICATION_ID);
  });

  it("auto-publishes a strict SAFE_UPDATE through the atomic writer", async () => {
    const target = LEDGER_SOURCE_REGISTRY[0]!;
    const runs = new MemoryLedgerAutomationStore();
    const publications = store();
    const result = await executeScheduledLedgerRun({
      runType: "TUESDAY_FULL",
      now: new Date("2026-10-13T10:30:00.000Z"),
      store: runs,
      publicationStore: publications,
      acceptance: false,
      adapter: createFixtureAdapter({
        [target.sourceId]: {
          normalizedObservation: {
            ...target.baselineNormalizedObservation,
            summary: "A low-risk statistic and source timestamp were refreshed.",
            significance: "MINOR",
          },
        },
      }),
    });
    assert.equal(result.run.state, "PUBLISHED");
    assert.equal(result.run.publicationOccurred, true);
    assert.equal((await publications.getCurrentPointer())?.pointer.currentPublicationId, result.run.publicationId);
  });

  it("deduplicates concurrent SAFE_UPDATE cron publication", async () => {
    const target = LEDGER_SOURCE_REGISTRY[0]!;
    const runs = new MemoryLedgerAutomationStore();
    const publications = store();
    const input = {
      runType: "TUESDAY_FULL" as const,
      now: new Date("2026-10-13T10:30:00.000Z"),
      store: runs,
      publicationStore: publications,
      acceptance: false as const,
      adapter: createFixtureAdapter({
        [target.sourceId]: {
          normalizedObservation: {
            ...target.baselineNormalizedObservation,
            summary: "Concurrent low-risk refresh.",
            significance: "MINOR",
          },
        },
      }),
    };
    const results = await Promise.all([executeScheduledLedgerRun(input), executeScheduledLedgerRun(input)]);
    assert.equal(results.filter((result) => result.created).length, 1);
    assert.ok(results.every((result) => result.run.state === "PUBLISHED"));
    assert.equal(runs.snapshot().runs.length, 1);
  });

  it("persists founder approval and publishes; duplicate approval is idempotent", async () => {
    const run = await materialRun();
    const proposal = buildCanonicalPublication(run, OCTOBER_10_LEDGER_PUBLICATION, new Date("2026-10-13T10:30:00.000Z"));
    const runs = new MemoryLedgerAutomationStore();
    await runs.appendRun({ ...run, canonicalPublication: proposal });
    const publications = store();
    const input = {
      runKey: run.runKey,
      decision: "APPROVE" as const,
      decidedAt: "2026-10-13T12:00:00.000Z",
      decidedBy: "founder",
      store: runs,
      publicationStore: publications,
    };
    assert.equal((await decideLedgerPublication(input)).state, "PUBLISHED");
    assert.equal((await decideLedgerPublication(input)).state, "PUBLISHED");
    assert.equal(runs.snapshot().decisions.length, 1);
  });

  for (const [decision, expected] of [["REJECT", "REJECTED"], ["NEEDS_REVISION", "NEEDS_REVISION"]] as const) {
    it(`persists founder ${decision.toLowerCase()} without publishing`, async () => {
      const run = await materialRun();
      const proposal = buildCanonicalPublication(run, OCTOBER_10_LEDGER_PUBLICATION, new Date("2026-10-13T10:30:00.000Z"));
      const runs = new MemoryLedgerAutomationStore();
      await runs.appendRun({ ...run, canonicalPublication: proposal });
      const publications = store();
      const result = await decideLedgerPublication({
        runKey: run.runKey,
        decision,
        decidedAt: "2026-10-13T12:00:00.000Z",
        decidedBy: "founder",
        store: runs,
        publicationStore: publications,
      });
      assert.equal(result.state, expected);
      assert.equal((await publications.getCurrentPointer())?.pointer.currentPublicationId, OCTOBER_10_LEDGER_PUBLICATION_ID);
    });
  }
});

describe("Ledger Automation V2 scheduler and acceptance", () => {
  it("accepts Tuesday and Friday at 06:30 Eastern", () => {
    assert.equal(evaluateLedgerSchedule(new Date("2026-06-02T10:30:00.000Z"), "TUESDAY_FULL").execute, true);
    assert.equal(evaluateLedgerSchedule(new Date("2026-06-05T10:30:00.000Z"), "FRIDAY_DELTA").execute, true);
  });

  it("handles DST candidate pairs without double execution", () => {
    assert.equal(evaluateLedgerSchedule(new Date("2026-06-02T11:30:00.000Z"), "TUESDAY_FULL").execute, false);
    assert.equal(evaluateLedgerSchedule(new Date("2026-11-03T10:30:00.000Z"), "TUESDAY_FULL").execute, false);
    assert.equal(evaluateLedgerSchedule(new Date("2026-11-03T11:30:00.000Z"), "TUESDAY_FULL").execute, true);
  });

  it("passes post-publication acceptance for all required routes", async () => {
    const value = candidate();
    const allText = [
      value.publicationDate,
      value.overall.temperature,
      value.overall.qualitativeState,
      value.overall.systemicDirection,
      value.bufferHealth.state,
      value.bufferHealth.direction,
      ...value.bufferHealth.domains.map((domain) => domain.state),
      ...value.monitors.flatMap((monitor) => [monitor.state, monitor.direction]),
    ].join(" ");
    const result = await validatePublishedLedger(value, {
      origin: "https://example.com",
      fetcher: async (url) => new Response(
        String(url).endsWith("sitemap.xml") || String(url).endsWith("robots.txt")
          ? "ok"
          : `<html><head><link rel="canonical" href="${url}"></head><body data-ledger-publication-id="${value.publicationId}" data-ledger-publication-date="${value.publicationDate}">${allText}</body></html>`,
        { status: 200 },
      ),
    });
    assert.equal(result.ok, true, result.failures.join("\n"));
  });

  it("fails acceptance on stale, noindex, non-200, and missing route data", async () => {
    const value = candidate();
    const result = await validatePublishedLedger(value, {
      origin: "https://example.com",
      fetcher: async (url) => String(url).endsWith("robots.txt")
        ? new Response("down", { status: 503 })
        : new Response('<html><head><meta name="robots" content="noindex"></head><body></body></html>', { status: 200 }),
    });
    assert.equal(result.ok, false);
    assert.ok(result.failures.length > 8);
  });
});
