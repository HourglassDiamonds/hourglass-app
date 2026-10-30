import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { TodayPageModel } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { TODAY_DOCKET_VERSION } from "@/lib/continuum/chief-of-staff/operating-loop/types";
import { projectSterlingTodaySurface } from "./publisher-projection";
import { isSterlingTodayPreviewPublisherEnabled } from "./server-config";
import type { SterlingTodayProposal } from "./types";

const originalEnvironment = process.env.CONTINUUM_ENV;
const originalFlag = process.env.CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.CONTINUUM_ENV;
  else process.env.CONTINUUM_ENV = originalEnvironment;
  if (originalFlag === undefined) delete process.env.CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED;
  else process.env.CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED = originalFlag;
});

function legacy(): TodayPageModel {
  return {
    freshness: "current",
    readModelWatermark: "legacy-watermark",
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
    assert.equal(isSterlingTodayPreviewPublisherEnabled(), true);
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
});
