import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { join } from "node:path";
import { runLedgerAutomation } from "./engine";
import { APPROVED_LIVE_SOURCE_URLS, createLiveLedgerAdapter } from "./live-adapters";
import { LEDGER_SOURCE_REGISTRY } from "./source-registry";
import type { LedgerLiveProvider, LedgerSourceDefinition } from "./types";

const CHECKED_AT = "2026-10-02T12:00:00.000Z";

function source(provider: LedgerLiveProvider): LedgerSourceDefinition {
  const found = LEDGER_SOURCE_REGISTRY.find((entry) => entry.liveProvider === provider);
  assert.ok(found, `missing ${provider} source`);
  return found;
}

function manualSource(): LedgerSourceDefinition {
  const found = LEDGER_SOURCE_REGISTRY.find((entry) => entry.sourceMode === "MANUAL_APPROVED");
  assert.ok(found);
  return found;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function blsPayload(period = "M09", value = "4.1") {
  const ids = ["LNS14000000", "CES0000000001", "LNS11300000", "CES0500000002"];
  return {
    status: "REQUEST_SUCCEEDED",
    Results: {
      series: ids.map((seriesID) => ({
        seriesID,
        data: [{ year: "2026", period, value }],
      })),
    },
  };
}

function eiaPayload(value: unknown = "123", units: unknown = "thousand barrels") {
  return {
    response: {
      data: [{ period: "2026-09-25", "series-description": "Approved series", value, units }],
    },
  };
}

async function check(
  definition: LedgerSourceDefinition,
  fetchImpl: typeof fetch,
  extra: Parameters<typeof createLiveLedgerAdapter>[0] = {},
) {
  return createLiveLedgerAdapter({ fetchImpl, maxAttempts: 1, ...extra }).check(definition, {
    runType: "TUESDAY_FULL",
    checkedAt: CHECKED_AT,
    runId: "test-run",
  });
}

describe("Ledger Automation V1.1 live adapters", () => {
  it("accepts a successful structured live response", async () => {
    const result = await check(source("BLS_EMPLOYMENT"), async () => jsonResponse(blsPayload()));
    assert.equal(result.failure, null);
    assert.equal(result.sourceMode, "LIVE");
    assert.equal(result.sourceFreshness, "CURRENT");
    assert.equal(result.status, "MANUAL_REVIEW_REQUIRED");
    assert.equal(result.normalizedObservation?.proposedMonitorState, undefined);
  });

  it("rejects malformed JSON", async () => {
    const result = await check(source("BLS_EMPLOYMENT"), async () => new Response("{", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    assert.equal(result.status, "INVALID");
    assert.equal(result.failure?.code, "MALFORMED_JSON");
  });

  it("bounds request timeouts", async () => {
    const fetchImpl = ((_url: URL | RequestInfo, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })) as typeof fetch;
    const result = await check(source("BLS_EMPLOYMENT"), fetchImpl, { timeoutMs: 100 });
    assert.equal(result.failure?.code, "TIMEOUT");
    assert.equal(result.status, "UNAVAILABLE");
  });

  it("reports HTTP 500 without coercing an observation", async () => {
    const result = await check(source("BLS_EMPLOYMENT"), async () => jsonResponse({}, 500));
    assert.equal(result.failure?.code, "HTTP_500");
    assert.equal(result.rawValue, null);
  });

  it("reports rate limiting distinctly", async () => {
    const result = await check(source("BLS_EMPLOYMENT"), async () => jsonResponse({}, 429));
    assert.equal(result.status, "RATE_LIMITED");
  });

  it("marks old observations stale", async () => {
    const payload = blsPayload("M01");
    for (const row of payload.Results.series) row.data[0]!.year = "2025";
    const result = await check(source("BLS_EMPLOYMENT"), async () => jsonResponse(payload));
    assert.equal(result.status, "STALE");
    assert.equal(result.sourceFreshness, "STALE");
  });

  it("fails clearly when a credential is missing", async () => {
    let called = false;
    const result = await check(source("EIA_PETROLEUM"), async () => {
      called = true;
      return jsonResponse(eiaPayload());
    }, { env: {} });
    assert.equal(result.status, "AUTH_REQUIRED");
    assert.equal(result.failure?.code, "MISSING_CREDENTIAL");
    assert.equal(called, false);
  });

  it("rejects invalid observation timestamps", async () => {
    const result = await check(source("BLS_EMPLOYMENT"), async () => jsonResponse(blsPayload("M99")));
    assert.equal(result.failure?.code, "INVALID_TIMESTAMP");
  });

  it("rejects invalid units and values", async () => {
    const definition = source("EIA_PETROLEUM");
    const invalidUnit = await check(definition, async () => jsonResponse(eiaPayload("123", "")), {
      env: { EIA_API_KEY: "test-key" },
    });
    const invalidValue = await check(definition, async () => jsonResponse(eiaPayload("not-a-number")), {
      env: { EIA_API_KEY: "test-key" },
    });
    assert.equal(invalidUnit.failure?.code, "INVALID_UNIT");
    assert.equal(invalidValue.failure?.code, "INVALID_VALUE");
  });

  it("retains manual approved sources explicitly", async () => {
    const result = await check(manualSource(), async () => {
      throw new Error("manual sources must not fetch");
    });
    assert.equal(result.sourceMode, "MANUAL_APPROVED");
    assert.equal(result.status, "MANUAL_REVIEW_REQUIRED");
    assert.equal(result.metadata.fallback, "manual-approved");
  });

  it("supports a mixed live/manual monitor run", async () => {
    const live = source("BLS_EMPLOYMENT");
    const manual = manualSource();
    const run = await runLedgerAutomation({
      runType: "TUESDAY_FULL",
      scheduledDate: "2026-10-02",
      startedAt: CHECKED_AT,
      registry: [live, manual],
      adapter: createLiveLedgerAdapter({ fetchImpl: async () => jsonResponse(blsPayload()) }),
    });
    assert.deepEqual(new Set(run.evidencePacket.sourceChecks.map((row) => row.sourceMode)), new Set(["LIVE", "MANUAL_APPROVED"]));
    assert.equal(run.classification, "APPROVAL_REQUIRED");
  });

  it("fails a run when a required source is unavailable", async () => {
    const definition = source("EIA_PETROLEUM");
    const run = await runLedgerAutomation({
      runType: "TUESDAY_FULL",
      scheduledDate: "2026-10-02",
      startedAt: CHECKED_AT,
      registry: [definition],
      adapter: createLiveLedgerAdapter({ env: {}, fetchImpl: async () => jsonResponse({}) }),
    });
    assert.equal(run.state, "FAILED");
  });

  it("does not fail a run for an optional unavailable source", async () => {
    const definition = { ...source("EIA_PETROLEUM"), required: false };
    const run = await runLedgerAutomation({
      runType: "TUESDAY_FULL",
      scheduledDate: "2026-10-02",
      startedAt: CHECKED_AT,
      registry: [definition],
      adapter: createLiveLedgerAdapter({ env: {}, fetchImpl: async () => jsonResponse({}) }),
    });
    assert.notEqual(run.state, "FAILED");
    assert.equal(run.classification, "APPROVAL_REQUIRED");
  });

  it("normalizes identical live inputs deterministically", async () => {
    const definition = source("BLS_EMPLOYMENT");
    const first = await check(definition, async () => jsonResponse(blsPayload()));
    const second = await check(definition, async () => jsonResponse(blsPayload()));
    assert.deepEqual(first.normalizedValue, second.normalizedValue);
    assert.deepEqual(first.rawValue, second.rawValue);
  });

  it("does not invent methodology thresholds", async () => {
    const result = await check(source("BLS_EMPLOYMENT"), async () => jsonResponse(blsPayload()));
    assert.equal(result.normalizedObservation?.significance, "NONE");
    assert.equal(result.normalizedObservation?.proposedMonitorState, undefined);
    assert.equal(result.normalizedObservation?.proposedBufferState, undefined);
  });

  it("cannot publish from a dry-run engine invocation", async () => {
    const run = await runLedgerAutomation({
      runType: "TUESDAY_FULL",
      scheduledDate: "2026-10-02",
      startedAt: CHECKED_AT,
      registry: [source("BLS_EMPLOYMENT")],
      adapter: createLiveLedgerAdapter({ fetchImpl: async () => jsonResponse(blsPayload()) }),
    });
    assert.equal(run.mode, "APPROVAL_ONLY");
    assert.equal(run.publicationOccurred, false);
    assert.equal(run.publicationId, null);
  });

  it("keeps dry-run output outside public Ledger files", async () => {
    const script = await readFile(join(process.cwd(), "scripts", "ledger-dry-run.ts"), "utf8");
    assert.match(script, /\.tmp[\s\S]*ledger-dry-runs/);
    assert.doesNotMatch(script, /writeFile\([^)]*app[\\/]ledger/);
    assert.doesNotMatch(script, /writeFile\([^)]*public/);
  });

  it("never logs credentials", async () => {
    const secret = "secret-fred-key-123";
    const logs: string[] = [];
    await check(source("FRED_HIGH_YIELD_OAS"), async () => jsonResponse({
      observations: [{ date: "2026-10-01", value: "3.25" }],
    }), {
      env: { FRED_API_KEY: secret },
      logger: (event) => logs.push(JSON.stringify(event)),
    });
    assert.equal(logs.join("\n").includes(secret), false);
  });

  it("permits only the fixed approved HTTPS provider URLs", async () => {
    assert.ok(APPROVED_LIVE_SOURCE_URLS.length > 0);
    assert.ok(APPROVED_LIVE_SOURCE_URLS.every((url) => url.startsWith("https://")));
    assert.ok(APPROVED_LIVE_SOURCE_URLS.every((url) => !url.includes("localhost") && !url.includes("127.0.0.1")));
  });
});
