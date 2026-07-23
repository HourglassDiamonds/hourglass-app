/**
 * Stable evidence fingerprinting for Agent OS persistence.
 * Excludes timestamps, run IDs, ordering noise, and volatile prose.
 * Never hashes raw third-party payloads.
 */

import { createHash } from "node:crypto";

export type FingerprintMaterial = {
  stableId: string;
  rootProblemId?: string | null;
  owningExecutive?: string;
  evidenceClass?: string;
  /** Normalized metric/observation tokens — no prose paragraphs. */
  evidenceDimensions?: readonly string[];
  severity?: string;
  confidenceBucket?: string;
  sourceHealth?: string;
  blockers?: readonly string[];
  dependencies?: readonly string[];
  actionToken?: string;
};

/** Map continuous confidence to a coarse bucket to avoid float noise. */
export function confidenceBucket(confidence: number): string {
  if (confidence >= 0.85) return "very-high";
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.5) return "medium";
  if (confidence >= 0.3) return "low";
  return "very-low";
}

/** Normalize tokens: lowercase, strip volatile punctuation, sort uniquely. */
export function normalizeFingerprintTokens(
  tokens: readonly string[],
): string[] {
  const set = new Set<string>();
  for (const raw of tokens) {
    const t = raw
      .toLowerCase()
      .replace(/\d{4}-\d{2}-\d{2}t[\d:.z+-]+/gi, "")
      .replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
        "",
      )
      .replace(/[^a-z0-9:._/-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (t) set.add(t);
  }
  return [...set].sort();
}

/**
 * Build a deterministic SHA-256 fingerprint over normalized material only.
 */
export function buildEvidenceFingerprint(material: FingerprintMaterial): string {
  const payload = {
    stableId: material.stableId,
    rootProblemId: material.rootProblemId ?? null,
    owningExecutive: material.owningExecutive ?? null,
    evidenceClass: material.evidenceClass ?? null,
    evidenceDimensions: normalizeFingerprintTokens(
      material.evidenceDimensions ?? [],
    ),
    severity: material.severity ?? null,
    confidenceBucket: material.confidenceBucket ?? null,
    sourceHealth: material.sourceHealth ?? null,
    blockers: normalizeFingerprintTokens(material.blockers ?? []),
    dependencies: normalizeFingerprintTokens(material.dependencies ?? []),
    actionToken: material.actionToken
      ? normalizeFingerprintTokens([material.actionToken])[0] ?? null
      : null,
  };
  const json = JSON.stringify(payload);
  return createHash("sha256").update(json, "utf8").digest("hex");
}

/** Extract coarse metric tokens from a short observation line (not full prose). */
export function extractMetricTokens(text: string, limit = 8): string[] {
  const tokens: string[] = [];
  const ratio = text.match(/\b\d+(?:\.\d+)?%\b/g) ?? [];
  const counts = text.match(/\b\d{1,7}\b/g) ?? [];
  for (const r of ratio.slice(0, 3)) tokens.push(`pct:${r}`);
  for (const c of counts.slice(0, 3)) tokens.push(`n:${c}`);
  const keywords = text
    .toLowerCase()
    .match(
      /\b(decline|increase|gap|missing|unknown|blocked|conversion|journey|gbp|gsc|ga4|concierge|studio)\b/g,
    );
  if (keywords) {
    for (const k of keywords.slice(0, limit)) tokens.push(`kw:${k}`);
  }
  return normalizeFingerprintTokens(tokens).slice(0, limit);
}
