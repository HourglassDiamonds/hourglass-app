/**
 * Founder-brief fingerprinting for delivery idempotency and cooldown suppression.
 * Prefers stable canonical fields over free-form ROI wording.
 */

import { createHash } from "node:crypto";
import type { FounderBrief, Recommendation, Urgency } from "../types";
import {
  normalizeFingerprintTokens,
} from "../persistence/fingerprint";

export type BriefPriorityMaterial = {
  recommendationId: string;
  /** Normalized action token from proposedAction (not free-form prose). */
  actionToken: string;
  urgency: Urgency | "unknown";
  /** Coarse impact bucket 0–10 → low|med|high */
  impactBucket: string;
  evidenceTokens: string[];
  sourceGapTokens: string[];
};

export type BriefFingerprintInput = {
  priorities: BriefPriorityMaterial[];
  /** Gap labels as stable tokens — gaps alone are not deterioration. */
  sourceGapStatusTokens?: string[];
};

function impactBucket(score: number): string {
  if (score >= 7) return "high";
  if (score >= 4) return "med";
  return "low";
}

function actionTokenFromText(text: string): string {
  const normalized = normalizeFingerprintTokens([text]).join(" ");
  // Drop filler words; keep verb-ish tokens
  return normalized
    .split(" ")
    .filter((t) => t.length > 2)
    .slice(0, 6)
    .join(":");
}

/**
 * Build a stable SHA-256 fingerprint over canonical priority material.
 */
export function buildFounderBriefFingerprint(
  input: BriefFingerprintInput,
): string {
  const priorities = [...input.priorities]
    .map((p) => ({
      recommendationId: p.recommendationId,
      actionToken: p.actionToken,
      urgency: p.urgency,
      impactBucket: p.impactBucket,
      evidenceTokens: normalizeFingerprintTokens(p.evidenceTokens).slice(0, 8),
      sourceGapTokens: normalizeFingerprintTokens(p.sourceGapTokens).slice(
        0,
        6,
      ),
    }))
    .sort((a, b) => a.recommendationId.localeCompare(b.recommendationId));
  const gaps = normalizeFingerprintTokens(
    input.sourceGapStatusTokens ?? [],
  ).slice(0, 8);
  return createHash("sha256")
    .update(JSON.stringify({ priorities, gaps }), "utf8")
    .digest("hex");
}

/** @deprecated Prefer priorities material — kept for simple title-only tests. */
export function buildFounderBriefFingerprintFromTitles(input: {
  surfacedPriorityTitles: string[];
  surfacedRecommendationIds?: string[];
  highestRoiAction?: string;
  missingOrUnreliableData?: string[];
}): string {
  const ids = input.surfacedRecommendationIds ?? [];
  const titles = input.surfacedPriorityTitles;
  const priorities: BriefPriorityMaterial[] = titles.map((title, i) => ({
    recommendationId: ids[i] ?? `title:${normalizeFingerprintTokens([title])[0] ?? i}`,
    actionToken: actionTokenFromText(input.highestRoiAction || title),
    urgency: "unknown",
    impactBucket: "med",
    evidenceTokens: normalizeFingerprintTokens([title]).slice(0, 4),
    sourceGapTokens: [],
  }));
  return buildFounderBriefFingerprint({
    priorities,
    sourceGapStatusTokens: (input.missingOrUnreliableData ?? []).map(
      (g) => `gap:${g}`,
    ),
  });
}

export function briefFingerprintFromFounderBrief(
  brief: FounderBrief,
  surfacedRecommendations?: Recommendation[],
): string {
  const recs = (surfacedRecommendations ?? []).slice(0, 5);
  if (recs.length > 0) {
    const priorities: BriefPriorityMaterial[] = recs.map((r) => ({
      recommendationId: r.recommendationId,
      actionToken: actionTokenFromText(r.proposedAction || r.title),
      urgency: r.urgency,
      impactBucket: impactBucket(r.rankingFactors.expectedBusinessImpact),
      evidenceTokens: normalizeFingerprintTokens(
        r.evidence.map((e) => e.metricOrObservation).filter(Boolean),
      ).slice(0, 8),
      sourceGapTokens: normalizeFingerprintTokens(
        (r.blockedReasons ?? []).map((b) => `block:${b}`),
      ),
    }));
    return buildFounderBriefFingerprint({
      priorities,
      sourceGapStatusTokens: brief.missingOrUnreliableData.map(
        (g) => `gap:${g}`,
      ),
    });
  }
  return buildFounderBriefFingerprintFromTitles({
    surfacedPriorityTitles: brief.surfacedPriorityTitles,
    highestRoiAction: brief.highestRoiAction,
    missingOrUnreliableData: brief.missingOrUnreliableData,
  });
}

/** Non-reversible recipient configuration fingerprint — never raw email. */
export function buildRecipientConfigFingerprint(input: {
  recipientAlias: string;
  fromConfigured: boolean;
  toConfigured: boolean;
  configSource?: string;
}): string {
  const payload = {
    alias: input.recipientAlias.trim().toLowerCase() || "founder",
    source: input.configSource ?? "unknown",
    from: input.fromConfigured ? "set" : "missing",
    to: input.toConfigured ? "set" : "missing",
  };
  return createHash("sha256")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
}

/**
 * Idempotency key — kind is always included so founder-brief and failure-alert
 * never share a reservation slot for the same cadence window.
 */
export function buildDeliveryIdempotencyKey(input: {
  kind: "founder-brief" | "failure-alert";
  cadenceId: string;
  cadenceWindow: string;
  recipientConfigFingerprint: string;
}): string {
  const payload = {
    kind: input.kind,
    cadenceId: input.cadenceId,
    cadenceWindow: input.cadenceWindow,
    recipientConfigFingerprint: input.recipientConfigFingerprint,
  };
  return createHash("sha256")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
}

export function buildCooldownSuppressionKey(input: {
  kind: "founder-brief" | "failure-alert";
  cadenceId: string;
  briefFingerprint: string;
  recipientConfigFingerprint: string;
}): string {
  const payload = {
    kind: input.kind,
    cadenceId: input.cadenceId,
    briefFingerprint: input.briefFingerprint,
    recipientConfigFingerprint: input.recipientConfigFingerprint,
  };
  return createHash("sha256")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
}

export { actionTokenFromText, impactBucket };
