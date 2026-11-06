import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { TodayPageModel } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { TODAY_DOCKET_VERSION } from "@/lib/continuum/chief-of-staff/operating-loop/types";
import { projectSterlingTodaySurface } from "./publisher-projection";
import { loadFreshSterlingTodayPublication } from "./publication-store";
import { isSterlingTodayPreviewPublisherEnabled } from "./server-config";
import type { SterlingTodayProposal } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

const originalEnvironment = process.env.CONTINUUM_ENV;
const originalFlag = process.env.CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED;
const originalVercel = process.env.VERCEL;
const originalVercelEnvironment = process.env.VERCEL_ENV;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalPreviewRef = process.env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF;
const originalProductionRef = process.env.CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.CONTINUUM_ENV;
  else process.env.CONTINUUM_ENV = originalEnvironment;
  if (originalFlag === undefined) delete process.env.CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED;
  else process.env.CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED = originalFlag;
  for (const [key, value] of Object.entries({
    VERCEL: originalVercel,
    VERCEL_ENV: originalVercelEnvironment,
    SUPABASE_URL: originalSupabaseUrl,
    CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF: originalPreviewRef,
    CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF: originalProductionRef,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function legacy(): TodayPageModel {
  return {
    freshness: "current",
    readModelStatus: "ready",
    readModelWatermark: "legacy-watermark",
    snapshotComposedAt: "2026-11-06T15:00:00.000Z",
    docket: {
      todayDocketVersion: TODAY_DOCKET_VERSION,
      title: "Up next",
      items: [], queuedCount: 0, watchingCount: 0, watching: [],
      showCaughtUp: true, showDisconnected: false,
      caughtUpHeading: "Caught up", caughtUpDetail: null,
      disconnectedHeading: null, disconnectedDetail: null,
    },
  };
}

function proposal(): SterlingTodayProposal {
  return {
    contractVersion: "sterling-today-proposal-v6",
    runId: "00000000-0000-5000-8000-000000000001",
    evidenceSnapshotId: "sterling-preview-snapshot",
    generatedAt: "2026-10-30T12:00:00.000Z",
    portfolioAssessments: [
      { workUnitId: "morgan", projectId: "p-morgan", identityStatus: "canonical_project", todayDisposition: "presented", recommendationItemId: "r-morgan",
        currentStage: { canonicalLifecycleStage: "cad", operationalSubstage: null, responsibleParty: "vendor_shop", confidence: "high", explanation: "Founder correction", evidenceRefs: ["e-morgan"] },
        obligations: [], nextStepOwner: "vendor_shop", attentionPriority: "monitor", confidence: "high", evidenceRefs: ["e-morgan"], ambiguities: [], explanation: "Waiting on shop", omissionReason: null },
      { workUnitId: "founder", projectId: "p-founder", identityStatus: "canonical_project", todayDisposition: "presented", recommendationItemId: "r-founder",
        currentStage: { canonicalLifecycleStage: "design", operationalSubstage: null, responsibleParty: "founder", confidence: "high", explanation: "Current", evidenceRefs: ["e-founder"] },
        obligations: [], nextStepOwner: "founder", attentionPriority: "action_now", confidence: "high", evidenceRefs: ["e-founder"], ambiguities: [], explanation: "Founder action", omissionReason: null },
      { workUnitId: "dylan", projectId: "p-dylan", identityStatus: "canonical_project", todayDisposition: "suppressed", recommendationItemId: null,
        currentStage: { canonicalLifecycleStage: "completed", operationalSubstage: null, responsibleParty: "unknown", confidence: "high", explanation: "Completed", evidenceRefs: ["e-dylan"] },
        obligations: [], nextStepOwner: "unknown", attentionPriority: "no_attention", confidence: "high", evidenceRefs: ["e-dylan"], ambiguities: [], explanation: "Completed", omissionReason: "Founder complete" },
    ],
    recommendations: [
      { itemId: "r-morgan", workUnitId: "morgan", category: "waiting_on_shop", projectId: "p-morgan", personId: null, relationshipRole: "client", title: "Morgan Jines", summary: "CAD waiting on shop", attentionPriority: "monitor", confidence: "high", explanation: "Founder correction", evidenceRefs: ["e-morgan"], ambiguities: [], obligations: [] },
      { itemId: "r-founder", workUnitId: "founder", category: "founder_actions", projectId: "p-founder", personId: null, relationshipRole: "client", title: "Founder decision", summary: "Review the design", attentionPriority: "action_now", confidence: "high", explanation: "Genuine founder action", evidenceRefs: ["e-founder"], ambiguities: [], obligations: [] },
      { itemId: "r-founder-duplicate", workUnitId: "founder", category: "up_next", projectId: "p-founder", personId: null, relationshipRole: "client", title: "Duplicate", summary: "Duplicate", attentionPriority: "action_now", confidence: "high", explanation: "Duplicate", evidenceRefs: ["e-founder"], ambiguities: [], obligations: [] },
      { itemId: "r-dylan", workUnitId: "dylan", category: "closed_or_superseded", projectId: "p-dylan", personId: null, relationshipRole: "client", title: "Dylan", summary: "Completed", attentionPriority: "no_attention", confidence: "high", explanation: "Completed", evidenceRefs: ["e-dylan"], ambiguities: [], obligations: [] },
    ],
    relationshipProposals: [], proposedCanonicalMutations: [], portfolioAmbiguities: [],
  };
}

describe("Sterling Preview Today publisher", () => {
  it("is default-off and cannot activate in Production", () => {
    delete process.env.CONTINUUM_ENV;
    delete process.env.CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED;
    assert.equal(isSterlingTodayPreviewPublisherEnabled(), false);
    process.env.CONTINUUM_ENV = "production";
    process.env.CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED = "true";
    assert.equal(isSterlingTodayPreviewPublisherEnabled(), false);
    process.env.CONTINUUM_ENV = "preview";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    process.env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF = "hrmpzplffuhhvbtxxhnt";
    process.env.CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF = "bnafadfgrrriblppeubp";
    process.env.SUPABASE_URL = "https://hrmpzplffuhhvbtxxhnt.supabase.co";
    assert.equal(isSterlingTodayPreviewPublisherEnabled(), true);
    process.env.SUPABASE_URL = "https://bnafadfgrrriblppeubp.supabase.co";
    assert.equal(isSterlingTodayPreviewPublisherEnabled(), false);
  });

  it("projects one card per work unit and keeps Up Next founder-only", () => {
    const result = projectSterlingTodaySurface(legacy(), proposal());
    assert.deepEqual(result.docket.items.map((row) => row.id), ["r-founder"]);
    const allSectionItems = (result.docket.sections ?? []).flatMap((section) => section.items);
    assert.equal(allSectionItems.filter((row) => row.id === "r-morgan").length, 1);
    assert.equal(allSectionItems.some((row) => row.title === "Dylan"), false);
    assert.equal(allSectionItems.some((row) => row.title === "Duplicate"), false);
    assert.equal(result.readModelWatermark, "legacy-watermark");
  });

  it("reads only an active, bounded, validation-passed durable publication", async () => {
    const expected = proposal();
    const calls: Array<[string, unknown]> = [];
    const query = {
      select(value: string) { calls.push(["select", value]); return this; },
      eq(column: string, value: string) { calls.push([`eq:${column}`, value]); return this; },
      lte(column: string, value: string) { calls.push([`lte:${column}`, value]); return this; },
      gt(column: string, value: string) { calls.push([`gt:${column}`, value]); return this; },
      order(column: string) { calls.push(["order", column]); return this; },
      limit(value: number) { calls.push(["limit", value]); return this; },
      async maybeSingle() {
        return { data: {
          run_id: expected.runId,
          proposal: expected,
          source_watermark: "watermark-1",
          validation_summary: { verdict: "PASS", accepted: true, mutationsReviewable: true },
          published_at: "2026-10-30T12:00:00.000Z",
          expires_at: "2026-10-30T12:15:00.000Z",
        }, error: null };
      },
    };
    const client = { from: () => query } as unknown as SupabaseClient;
    const loaded = await loadFreshSterlingTodayPublication(client, new Date("2026-10-30T12:05:00.000Z"));
    assert.deepEqual(loaded, {
      proposal: expected,
      runId: expected.runId,
      sourceWatermark: "watermark-1",
      validationResult: "PASS",
      publishedAt: "2026-10-30T12:00:00.000Z",
      expiresAt: "2026-10-30T12:15:00.000Z",
    });
    assert.ok(calls.some(([name, value]) => name === "eq:status" && value === "active"));
    assert.ok(calls.some(([name]) => name === "gt:expires_at"));
  });

  it("fails closed for a durable row whose validation is not accepted", async () => {
    const expected = proposal();
    const query = {
      select() { return this; }, eq() { return this; }, lte() { return this; },
      gt() { return this; }, order() { return this; }, limit() { return this; },
      async maybeSingle() {
        return { data: {
          run_id: expected.runId,
          proposal: expected,
          validation_summary: { verdict: "PASS", accepted: false, mutationsReviewable: true },
        }, error: null };
      },
    };
    const client = { from: () => query } as unknown as SupabaseClient;
    assert.equal(await loadFreshSterlingTodayPublication(client), null);
  });
});
