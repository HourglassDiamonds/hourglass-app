import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUFFER_HEALTH_DOMAINS } from "@/app/ledger/buffer-health-data";
import {
  SYSTEM_TEMPERATURE_READING,
  SYSTEM_TEMPERATURE_SNAPSHOT_2026_10_01,
} from "@/app/ledger/system-temperature";
import { GET as runTuesdayRoute } from "@/app/api/cron/ledger-tuesday/route";
import { approvedSnapshotAdapter, createFixtureAdapter } from "./adapters";
import { runLedgerAutomation } from "./engine";
import { LEDGER_SOURCE_REGISTRY } from "./source-registry";
import { executeScheduledLedgerRun, reviewLedgerRun } from "./service";
import { MemoryLedgerAutomationStore } from "./store";
import type { LedgerSourceCheck, LedgerSourceDefinition, LedgerRunType } from "./types";

const TUESDAY_DATE = "2026-10-06";
const TUESDAY_AT = "2026-10-06T13:00:00.000Z";
const FRIDAY_DATE = "2026-10-09";
const FRIDAY_AT = "2026-10-09T13:00:00.000Z";

function source(monitorId: LedgerSourceDefinition["monitorId"], index = 0) {
  const matches = LEDGER_SOURCE_REGISTRY.filter((entry) => entry.monitorId === monitorId);
  const found = matches[index];
  assert.ok(found, `expected source ${monitorId}[${index}]`);
  return found;
}

async function directRun(
  runType: LedgerRunType,
  overrides: Readonly<Record<string, Partial<LedgerSourceCheck>>> = {},
) {
  const scheduledDate = runType === "TUESDAY_FULL" ? TUESDAY_DATE : FRIDAY_DATE;
  const startedAt = runType === "TUESDAY_FULL" ? TUESDAY_AT : FRIDAY_AT;
  return runLedgerAutomation({
    runType,
    scheduledDate,
    startedAt,
    completedAt: startedAt,
    registry: LEDGER_SOURCE_REGISTRY,
    adapter: Object.keys(overrides).length ? createFixtureAdapter(overrides) : approvedSnapshotAdapter,
  });
}

describe("Ledger automation V1", () => {
  it("runs a Tuesday full review across every monitor and Buffer Health domain", async () => {
    const run = await directRun("TUESDAY_FULL");
    assert.equal(run.runType, "TUESDAY_FULL");
    assert.equal(run.evidencePacket.monitorObservations.length, 6);
    assert.equal(run.evidencePacket.bufferHealthChanges.length, 6);
    assert.ok(run.evidencePacket.sourceChecks.length > 0);
  });

  it("runs a Friday delta and omits unchanged source detail", async () => {
    const run = await directRun("FRIDAY_DELTA");
    assert.equal(run.runType, "FRIDAY_DELTA");
    assert.equal(run.evidencePacket.sourceChecks.length, 0);
    assert.deepEqual(run.proposedPublication.whatChanged, [
      "No material change since the prior formal Ledger review.",
    ]);
  });

  it("returns NO_CHANGE when approved observations match the formal snapshot", async () => {
    const run = await directRun("TUESDAY_FULL");
    assert.equal(run.classification, "NO_CHANGE");
    assert.equal(run.state, "NO_CHANGE");
  });

  it("requires approval for a material monitor-state change", async () => {
    const target = source("global-pressure");
    const run = await directRun("TUESDAY_FULL", {
      [target.sourceId]: {
        normalizedObservation: {
          summary: "Deterministic material fixture.",
          proposedMonitorState: "Critical external pressure / Systemic transmission",
          significance: "MATERIAL",
        },
      },
    });
    assert.equal(run.classification, "APPROVAL_REQUIRED");
    assert.equal(run.state, "AWAITING_APPROVAL");
    assert.ok(run.evidencePacket.monitorObservations.find((item) => item.monitorId === "global-pressure")?.materialChange);
  });

  it("requires approval when the existing methodology derives a temperature change", async () => {
    const target = source("ai-capability");
    const run = await directRun("TUESDAY_FULL", {
      [target.sourceId]: {
        normalizedObservation: {
          summary: "Deterministic temperature fixture.",
          proposedMonitorState: target.baselineNormalizedObservation.proposedMonitorState,
          proposedTemperatureChannel: {
            channelId: "technology-ai",
            pressure: "critical",
            transmission: "broad",
            explanation: "Fixture establishes a material transmitted change.",
            coolingNotes: "No fixture cooling offset was established.",
          },
          significance: "MATERIAL",
        },
      },
    });
    assert.notEqual(
      run.evidencePacket.overallTemperature.proposedDegrees,
      run.evidencePacket.overallTemperature.previousDegrees,
    );
    assert.equal(run.classification, "APPROVAL_REQUIRED");
  });

  it("requires approval for a Buffer Health category change", async () => {
    const targets = LEDGER_SOURCE_REGISTRY.filter((entry) => entry.bufferDomainId === "energy");
    assert.ok(targets.length > 0);
    const overrides = Object.fromEntries(targets.map((target) => [
      target.sourceId,
      {
        normalizedObservation: {
          summary: "Deterministic Buffer fixture.",
          proposedBufferState: "Critical",
          significance: "MATERIAL",
        },
      },
    ]));
    const run = await directRun("TUESDAY_FULL", overrides);
    assert.equal(run.classification, "APPROVAL_REQUIRED");
    assert.ok(run.evidencePacket.bufferHealthChanges.find((item) => item.domainId === "energy")?.materialChange);
  });

  it("preserves conflicting evidence and retains the prior state", async () => {
    const first = source("global-pressure", 0);
    const second = source("global-pressure", 1);
    const run = await directRun("TUESDAY_FULL", {
      [first.sourceId]: {
        normalizedObservation: { summary: "Conflict A", proposedMonitorState: "State A", significance: "MATERIAL" },
      },
      [second.sourceId]: {
        normalizedObservation: { summary: "Conflict B", proposedMonitorState: "State B", significance: "MATERIAL" },
      },
    });
    const proposal = run.evidencePacket.monitorObservations.find((item) => item.monitorId === "global-pressure");
    assert.equal(proposal?.proposedState, proposal?.previousState);
    assert.ok((proposal?.contradictorySourceIds.length ?? 0) >= 2);
    assert.equal(run.classification, "APPROVAL_REQUIRED");
  });

  it("requires approval for stale evidence", async () => {
    const target = source("precious-materials");
    const run = await directRun("TUESDAY_FULL", { [target.sourceId]: { freshness: "STALE" } });
    assert.equal(run.classification, "APPROVAL_REQUIRED");
    assert.match(run.evidencePacket.reasons.join(" "), /stale/i);
  });

  it("fails safely when a required source fails", async () => {
    const target = source("infrastructure-strain");
    const run = await directRun("TUESDAY_FULL", {
      [target.sourceId]: {
        failure: { code: "fixture-timeout", message: "Fixture source timed out.", retryable: true },
        rawObservation: null,
        normalizedObservation: null,
        freshness: "UNKNOWN",
      },
    });
    assert.equal(run.state, "FAILED");
    assert.equal(run.classification, "APPROVAL_REQUIRED");
    assert.equal(run.evidencePacket.sourceFailures.length, 1);
  });

  it("returns the existing artifact on an idempotent retry", async () => {
    const store = new MemoryLedgerAutomationStore();
    const now = new Date(TUESDAY_AT);
    const first = await executeScheduledLedgerRun({ runType: "TUESDAY_FULL", now, store });
    const retry = await executeScheduledLedgerRun({ runType: "TUESDAY_FULL", now, store });
    assert.equal(first.created, true);
    assert.equal(retry.created, false);
    assert.deepEqual(retry.run, first.run);
  });

  it("deduplicates concurrent scheduled invocations", async () => {
    const store = new MemoryLedgerAutomationStore();
    const input = { runType: "TUESDAY_FULL" as const, now: new Date(TUESDAY_AT), store };
    const results = await Promise.all([
      executeScheduledLedgerRun(input),
      executeScheduledLedgerRun(input),
    ]);
    assert.equal(results.filter((result) => result.created).length, 1);
    assert.equal(store.snapshot().runs.length, 1);
  });

  it("rejects an unauthorized scheduler request", async () => {
    const original = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const response = await runTuesdayRoute(new Request("https://example.com/api/cron/ledger-tuesday"));
      assert.equal(response.status, 401);
    } finally {
      if (original === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = original;
    }
  });

  it("keeps run and decision artifacts append-only", async () => {
    const store = new MemoryLedgerAutomationStore();
    const executed = await executeScheduledLedgerRun({
      runType: "TUESDAY_FULL",
      now: new Date(TUESDAY_AT),
      store,
      adapter: createFixtureAdapter({
        [source("global-pressure").sourceId]: {
          normalizedObservation: {
            summary: "Material review fixture.",
            proposedMonitorState: "Review required",
            significance: "MATERIAL",
          },
        },
      }),
    });
    const decision = await reviewLedgerRun({
      runKey: executed.run.runKey,
      decision: "APPROVE",
      decidedAt: "2026-10-06T15:00:00.000Z",
      decidedBy: "founder",
      store,
    });
    const audit = store.snapshot();
    assert.equal(audit.runs.length, 1);
    assert.equal(audit.runs[0]?.founderApproval, null);
    assert.equal(audit.decisions.length, 1);
    assert.equal(decision.resultingState, "APPROVED");
  });

  it("leaves the October 1 publication and Buffer baseline unchanged", () => {
    assert.equal(SYSTEM_TEMPERATURE_SNAPSHOT_2026_10_01.reviewDate, "October 1, 2026");
    assert.equal(SYSTEM_TEMPERATURE_READING.degrees, 74);
    assert.equal(SYSTEM_TEMPERATURE_READING.bandLabel, "High");
    assert.equal(BUFFER_HEALTH_DOMAINS.find((domain) => domain.id === "energy")?.reserveState, "Low");
  });

  it("never auto-publishes in APPROVAL_ONLY mode", async () => {
    const target = source("global-pressure");
    const run = await directRun("TUESDAY_FULL", {
      [target.sourceId]: {
        normalizedObservation: {
          summary: "Minor refreshed statistic.",
          proposedMonitorState: target.baselineNormalizedObservation.proposedMonitorState,
          significance: "MINOR",
        },
      },
    });
    assert.equal(run.classification, "SAFE_UPDATE");
    assert.equal(run.theoreticalAutoPublishEligible, true);
    assert.equal(run.mode, "APPROVAL_ONLY");
    assert.equal(run.state, "AWAITING_APPROVAL");
    assert.equal(run.publicationOccurred, false);
  });
});
