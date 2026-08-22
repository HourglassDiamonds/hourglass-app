import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, beforeEach, afterEach } from "node:test";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DIAMOND_STUDIO_CONFIGURATION_DEFAULTS } from "@/lib/diamond-studio/configuration";
import type { StudioSnapshotResult } from "@/lib/diamond-studio/snapshot";
import { handleEmailStudioView } from "./handle";
import { createFakeStudioViewEmailSender } from "./send";
import { resetStudioEmailRateLimits } from "./rate-limit";
import { resetStudioIdentifiedEventStore } from "./store";
import { resetStudioOperationalSignals } from "@/lib/agent-os/diamond-studio/operational";
import { InMemoryContinuumStore } from "@/lib/continuum/persistence/memory";
import {
  studioIdentifiedRecordEvidenceIdempotencyKey,
  studioViewEmailedEventIdempotencyKey,
} from "@/lib/continuum/contracts/ids";

const CONFIG = DIAMOND_STUDIO_CONFIGURATION_DEFAULTS;
const TEST_ENV = {
  RESEND_API_KEY: "re_test",
  STUDIO_VIEW_EMAIL_FROM: "Hourglass Diamonds <concierge@hourglassdiamonds.com>",
  NODE_ENV: "test",
} as NodeJS.ProcessEnv;

const JPEG: StudioSnapshotResult = {
  mimeType: "image/jpeg",
  width: 1200,
  height: 1640,
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  variant: "card",
};

function payload() {
  return JSON.stringify({
    email: "visitor@example.com",
    configuration: CONFIG,
  });
}

beforeEach(() => {
  resetStudioEmailRateLimits();
  resetStudioIdentifiedEventStore();
  resetStudioOperationalSignals();
});

afterEach(() => {
  resetStudioEmailRateLimits();
  resetStudioIdentifiedEventStore();
  resetStudioOperationalSignals();
});

describe("Studio Continuum kernel integration", () => {
  it("durable identified persist writes Continuum Event + Evidence and no Observation", async () => {
    const continuum = new InMemoryContinuumStore();
    const result = await handleEmailStudioView({
      rawBody: payload(),
      ip: "203.0.113.10",
      deps: {
        sender: createFakeStudioViewEmailSender(),
        composeCard: async () => JPEG,
        env: TEST_ENV,
        continuum,
        persist: async () => ({
          ok: true,
          adapter: "supabase",
          durable: true,
          status: "durable",
        }),
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok || !result.record) return;
    const eventKey = studioViewEmailedEventIdempotencyKey(result.record.id);
    const evidenceKey = studioIdentifiedRecordEvidenceIdempotencyKey(
      result.record.id,
    );
    const event = await continuum.getEventByIdempotencyKey(eventKey);
    const evidence = await continuum.getEvidenceByIdempotencyKey(evidenceKey);
    assert.ok(event);
    assert.ok(evidence);
    assert.equal(event.eventType, "studio.view_emailed");
    assert.equal(evidence.sourceKind, "source-record");
    assert.equal(evidence.eventId, null);
    assert.deepEqual(await continuum.listObservations(), []);
    assert.deepEqual(await continuum.listEntities(), []);
    assert.equal(JSON.stringify(event).includes("@"), false);
    assert.equal(JSON.stringify(evidence).includes("@"), false);
  });

  it("Continuum ingest failure does not fail the visitor email", async () => {
    const continuum = new InMemoryContinuumStore();
    continuum.insertEvent = async () => {
      throw new Error("continuum unavailable");
    };
    const sender = createFakeStudioViewEmailSender();
    const result = await handleEmailStudioView({
      rawBody: payload(),
      ip: "203.0.113.10",
      deps: {
        sender,
        composeCard: async () => JPEG,
        env: TEST_ENV,
        continuum,
        persist: async () => ({
          ok: true,
          adapter: "supabase",
          durable: true,
          status: "durable",
        }),
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.accepted, true);
      assert.equal(result.persistence?.status, "durable");
    }
    assert.equal(sender.calls.length, 1);
  });

  it("persist-fail-after-send writes a durable Continuum exception keyed by operation_id", async () => {
    const continuum = new InMemoryContinuumStore();
    const operationId = randomUUID();
    const result = await handleEmailStudioView({
      rawBody: payload(),
      ip: "203.0.113.10",
      deps: {
        sender: createFakeStudioViewEmailSender(),
        composeCard: async () => JPEG,
        env: {
          ...TEST_ENV,
          NODE_ENV: "production",
          VERCEL_ENV: "preview",
        },
        continuum,
        createOperationId: () => operationId,
        persist: async () => ({
          ok: false,
          adapter: "supabase",
          durable: false,
          status: "failed",
          reason: "write_failed",
        }),
      },
    });
    assert.equal(result.ok, true);
    const exception = await continuum.getException(
      "studio.identified_persistence_failed",
      operationId,
    );
    assert.ok(exception);
    assert.equal(exception.subjectKey, operationId);
    assert.equal(exception.detector, "studio-email-view");
    assert.deepEqual(exception.payload, { emailsSent: 1 });
    assert.equal(JSON.stringify(exception).includes("visitor@"), false);
    assert.deepEqual(await continuum.listObservations(), []);
  });

  it("does not invoke CoS, HubSpot, or GA from the Studio email handler", () => {
    const src = readFileSync(
      resolve(process.cwd(), "lib/diamond-studio/email-view/handle.ts"),
      "utf8",
    );
    assert.equal(src.includes("runAgentOsBrief"), false);
    assert.equal(src.includes("chief-of-staff"), false);
    assert.equal(src.includes("hubspot"), false);
    assert.equal(src.includes("gtag"), false);
    assert.equal(src.includes("trackDiamondStudioEvent"), false);
    assert.equal(src.includes("@/lib/integrations/ga4"), false);
  });
});
