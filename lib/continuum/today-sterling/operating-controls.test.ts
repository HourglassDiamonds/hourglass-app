import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
} from "@/lib/continuum/runtime-env";
import {
  isFounderManualTodayRecomputeEnabled,
  isSterlingTodayPreviewPublisherEnabled,
} from "./server-config";
import {
  isCorrespondenceReadyForCanonicalRecompute,
  type SterlingReadinessReport,
} from "./readiness";

const keys = [
  "VERCEL",
  "VERCEL_ENV",
  "CONTINUUM_ENV",
  "SUPABASE_URL",
  "CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF",
  "CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF",
  "CONTINUUM_TODAY_MANUAL_RECOMPUTE_ENABLED",
  "CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED",
] as const;
const prior = new Map<string, string | undefined>();

function isolatedPreview(): void {
  const values: Record<string, string> = {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    CONTINUUM_ENV: "preview",
    SUPABASE_URL: `https://${CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF}.supabase.co`,
    CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
    CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  };
  for (const key of keys) {
    if (!prior.has(key)) prior.set(key, process.env[key]);
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
}

function report(overrides: Partial<SterlingReadinessReport["gmail"]> = {}): SterlingReadinessReport {
  return {
    generatedAt: new Date(0).toISOString(),
    gmail: {
      connectionStatus: "connected",
      authorizationStatus: "verified-by-fresh-ingestion",
      authorizationReason: null,
      oauthConfigured: true,
      tokenCustodyConfigured: true,
      lastSuccessfulIngestionAt: new Date(0).toISOString(),
      checkpointAt: new Date(0).toISOString(),
      checkpointAgeHours: 0,
      checkpointStatus: "completed",
      successfulIngestionAfterAuthorization: true,
      indexedMessageCount: 1,
      indexedThreadCount: 1,
      candidateReferencedThreadCount: 1,
      indexedCandidateThreadCount: 1,
      missingCandidateThreadCount: 0,
      fixtureCandidateThreadCount: 0,
      currentCandidateThreadCount: 1,
      realClientThreadCount: 1,
      trustedRealClientThreadCount: 1,
      unresolvedRealClientThreadCount: 0,
      associationPersistence: "available",
      ...overrides,
    },
    watermarks: {
      canonicalProjectJob: "a",
      founderCorrectionCandidateReview: "b",
      todaySource: "c",
    },
    today: {
      status: "stale",
      readModelVersion: null,
      lastSuccessfulRebuildAt: null,
      correspondenceStatus: null,
    },
    sterling: {
      validationReady: false,
      publisherEnabled: false,
      publicationState: "none",
      publishedAt: null,
      expiresAt: null,
      expired: null,
    },
    publishingBlockedReasons: [],
  };
}

afterEach(() => {
  for (const [key, value] of prior) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  prior.clear();
});

describe("manual Today operating control", { concurrency: false }, () => {
  it("is default off and independent from the publisher flag", () => {
    isolatedPreview();
    assert.equal(isFounderManualTodayRecomputeEnabled(), false);
    assert.equal(isSterlingTodayPreviewPublisherEnabled(), false);

    process.env.CONTINUUM_TODAY_MANUAL_RECOMPUTE_ENABLED = "true";
    assert.equal(isFounderManualTodayRecomputeEnabled(), true);
    assert.equal(isSterlingTodayPreviewPublisherEnabled(), false);

    process.env.CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED = "true";
    assert.equal(isSterlingTodayPreviewPublisherEnabled(), true);
  });

  it("requires completed, current correspondence authorization and trusted coverage", () => {
    assert.equal(isCorrespondenceReadyForCanonicalRecompute(report()), true);
    assert.equal(
      isCorrespondenceReadyForCanonicalRecompute(
        report({ checkpointStatus: "running" }),
      ),
      false,
    );
    assert.equal(
      isCorrespondenceReadyForCanonicalRecompute(
        report({ unresolvedRealClientThreadCount: 1 }),
      ),
      false,
    );
    assert.equal(
      isCorrespondenceReadyForCanonicalRecompute(
        report({ authorizationStatus: "configured-unverified" }),
      ),
      false,
    );
  });
});
