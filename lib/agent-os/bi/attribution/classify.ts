/**
 * Origin class prefers explicit captured fields over inference.
 * Landing /diamond-studio does not become originating_tool.
 * GA4 channel mix is never used to classify a named inquiry.
 */

import type { NormalizedConciergeSubmission } from "../client-attention/adapters/types";
import { ctaSurfaceKey, sanitizeAttributionKey } from "./sanitize";
import type { AttributionOriginClass } from "./types";

export type SanitizedInquiryOrigin = {
  originatingTool?: string;
  ctaSurface?: string;
  landingPath?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrerHost?: string;
  originClass: AttributionOriginClass;
};

export function classifyInquiryOrigin(
  submission: NormalizedConciergeSubmission,
): SanitizedInquiryOrigin {
  const originatingTool = sanitizeAttributionKey(
    submission.originatingTool,
    "tool",
  );
  const lastCta = sanitizeAttributionKey(submission.lastCtaLocation, "cta");
  const ctaSurface = lastCta ? ctaSurfaceKey(lastCta) : undefined;
  const landingPath = sanitizeAttributionKey(submission.landingPath, "path");
  const utmSource = sanitizeAttributionKey(submission.utmSource, "utm");
  const utmMedium = sanitizeAttributionKey(submission.utmMedium, "utm");
  const utmCampaign = sanitizeAttributionKey(submission.utmCampaign, "utm");
  const referrerHost = sanitizeAttributionKey(submission.referrerHost, "host");

  let originClass: AttributionOriginClass = "unknown";
  if (originatingTool) originClass = "explicit-tool-origin";
  else if (ctaSurface) originClass = "explicit-cta-surface";
  else if (landingPath || utmSource || utmMedium || utmCampaign) {
    originClass = "landing-campaign-context";
  }

  return {
    originatingTool,
    ctaSurface,
    landingPath,
    utmSource,
    utmMedium,
    utmCampaign,
    referrerHost,
    originClass,
  };
}

export function classifySampleStrength(acceptedInquiryCount: number):
  | "INSUFFICIENT_SAMPLE"
  | "DESCRIPTIVE_ONLY"
  | "MATERIAL_SIGNAL" {
  if (acceptedInquiryCount <= 3) return "INSUFFICIENT_SAMPLE";
  if (acceptedInquiryCount <= 7) return "DESCRIPTIVE_ONLY";
  return "MATERIAL_SIGNAL";
}
