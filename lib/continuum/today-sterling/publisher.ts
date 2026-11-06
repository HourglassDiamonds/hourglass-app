import "server-only";

import { loadTodaySurface, type TodayPageModel } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { loadAuthenticatedSterlingTodayPublisherProposal } from "./action-runtime";
import { isSterlingTodayPreviewPublisherEnabled } from "./server-config";
import { projectSterlingTodaySurface } from "./publisher-projection";

export type TodayIntelligenceStatus =
  | {
      source: "canonical_fallback";
      sterlingStatus: "disabled" | "unavailable";
      runId: null;
      sourceWatermark: null;
      validationResult: null;
      publishedAt: null;
      expiresAt: null;
    }
  | {
      source: "sterling";
      sterlingStatus: "active";
      runId: string;
      sourceWatermark: string;
      validationResult: "PASS";
      publishedAt: string;
      expiresAt: string;
    };

export type IntegratedTodayPageModel = TodayPageModel & {
  intelligence: TodayIntelligenceStatus;
};

function canonicalFallback(
  legacy: TodayPageModel,
  sterlingStatus: "disabled" | "unavailable",
): IntegratedTodayPageModel {
  return {
    ...legacy,
    intelligence: {
      source: "canonical_fallback",
      sterlingStatus,
      runId: null,
      sourceWatermark: null,
      validationResult: null,
      publishedAt: null,
      expiresAt: null,
    },
  };
}

/** Default-off Preview bridge with a non-destructive legacy fallback. */
export async function loadPreviewIntegratedTodaySurface(now = new Date()): Promise<IntegratedTodayPageModel> {
  const legacy = await loadTodaySurface(now);
  if (!isSterlingTodayPreviewPublisherEnabled()) return canonicalFallback(legacy, "disabled");
  try {
    const publication = await loadAuthenticatedSterlingTodayPublisherProposal();
    if (!publication) return canonicalFallback(legacy, "unavailable");
    return {
      ...projectSterlingTodaySurface(legacy, publication.proposal),
      intelligence: {
        source: "sterling",
        sterlingStatus: "active",
        runId: publication.runId,
        sourceWatermark: publication.sourceWatermark,
        validationResult: publication.validationResult,
        publishedAt: publication.publishedAt,
        expiresAt: publication.expiresAt,
      },
    };
  } catch {
    return canonicalFallback(legacy, "unavailable");
  }
}
