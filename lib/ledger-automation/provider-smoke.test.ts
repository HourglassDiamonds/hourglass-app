import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { POST as activationPost } from "@/app/api/cron/ledger-activation/route";
import { verifyLedgerActivationRequest } from "./activation-auth";
import { LEDGER_SMOKE_PROVIDERS, runLedgerProviderSmoke } from "./provider-smoke";
import { LEDGER_SOURCE_REGISTRY } from "./source-registry";
import type { LedgerSourceAdapter } from "./types";

const originalActivationToken = process.env.LEDGER_ACTIVATION_TOKEN;
const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalActivationToken === undefined) delete process.env.LEDGER_ACTIVATION_TOKEN;
  else process.env.LEDGER_ACTIVATION_TOKEN = originalActivationToken;
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
});

describe("Ledger production activation", () => {
  it("requires the temporary activation bearer token and fails closed when absent", async () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.LEDGER_ACTIVATION_TOKEN;
    const request = new Request("https://example.com/api/cron/ledger-activation", {
      method: "POST",
      body: JSON.stringify({ action: "provider-smoke" }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(verifyLedgerActivationRequest(request), false);
    assert.equal((await activationPost(request)).status, 401);
  });

  it("uses constant-time bearer authentication for a configured token", () => {
    process.env.LEDGER_ACTIVATION_TOKEN = "one-time-activation-token";
    assert.equal(verifyLedgerActivationRequest(new Request("https://example.com", {
      headers: { authorization: "Bearer one-time-activation-token" },
    })), true);
    assert.equal(verifyLedgerActivationRequest(new Request("https://example.com", {
      headers: { authorization: "Bearer wrong-token" },
    })), false);
  });

  it("smokes exactly the eight approved live providers and returns sanitized results", async () => {
    const adapter: LedgerSourceAdapter = {
      adapterId: "smoke-test",
      async check(source, context) {
        return {
          sourceId: source.sourceId,
          monitorId: source.monitorId,
          bufferDomainId: source.bufferDomainId,
          sourceName: source.sourceName,
          sourceAuthority: source.sourceAuthority,
          sourceLocation: source.sourceLocation,
          sourceUrl: source.sourceUrl,
          sourceType: source.sourceType,
          sourceMode: source.sourceMode,
          checkedAt: context.checkedAt,
          fetchedAt: context.checkedAt,
          observationTimestamp: "2026-10-19T00:00:00.000Z",
          rawObservation: "must not leak",
          rawValue: { secret: "must not leak" },
          rawPayload: { secret: "must not leak" },
          normalizedObservation: { summary: "Normalized successfully.", significance: "NONE" },
          normalizedValue: { interpretation: "MANUAL_REVIEW_REQUIRED" },
          unit: "test",
          reliability: source.reliability,
          confidence: source.reliability,
          required: source.required,
          freshness: "CURRENT",
          sourceFreshness: "CURRENT",
          status: "MANUAL_REVIEW_REQUIRED",
          failure: null,
          failureReason: null,
          metadata: { provider: source.liveProvider },
          contradictorySourceIds: [],
        };
      },
    };
    const results = await runLedgerProviderSmoke({ adapter, registry: LEDGER_SOURCE_REGISTRY });
    assert.deepEqual(results.map((result) => result.provider), [...LEDGER_SMOKE_PROVIDERS]);
    assert.ok(results.every((result) => result.outcome === "SUCCESS"));
    assert.ok(results.every((result) => result.normalizationResult === "Normalized successfully."));
    assert.equal(JSON.stringify(results).includes("must not leak"), false);
    assert.equal(JSON.stringify(results).includes("rawPayload"), false);
  });
});
