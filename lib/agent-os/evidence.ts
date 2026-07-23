import type {
  Evidence,
  FreshnessStatus,
  ReliabilityStatus,
  SourceType,
} from "./types";

const STALE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const FRESH_MS = 8 * 24 * 60 * 60 * 1000; // ~1 week + buffer

export function classifyFreshness(
  collectedAt: string,
  now: Date = new Date(),
): FreshnessStatus {
  const t = Date.parse(collectedAt);
  if (Number.isNaN(t)) return "unknown";
  const age = now.getTime() - t;
  if (age < 0) return "unknown";
  if (age <= FRESH_MS) return "fresh";
  if (age <= STALE_MS) return "stale";
  return "stale";
}

export function createEvidence(input: {
  source: string;
  sourceType: SourceType;
  collectedAt: string;
  reportingPeriod: { start: string; end: string };
  metricOrObservation: string;
  priorComparison?: string | null;
  reliability?: ReliabilityStatus;
  supportingReference?: string | null;
  redactionStatus?: Evidence["redactionStatus"];
  now?: Date;
}): Evidence {
  const freshness = classifyFreshness(input.collectedAt, input.now);
  return {
    source: input.source,
    sourceType: input.sourceType,
    collectedAt: input.collectedAt,
    reportingPeriod: input.reportingPeriod,
    metricOrObservation: input.metricOrObservation,
    priorComparison: input.priorComparison ?? null,
    freshness,
    reliability: input.reliability ?? "reliable",
    supportingReference: input.supportingReference ?? null,
    redactionStatus: input.redactionStatus ?? "clean",
  };
}

export function evidenceDataQuality(evidence: Evidence[]): number {
  if (!evidence.length) return 0;
  let sum = 0;
  for (const e of evidence) {
    let score = 1;
    if (e.freshness === "stale") score *= 0.45;
    if (e.freshness === "unavailable" || e.freshness === "unknown") score *= 0.35;
    if (e.reliability === "degraded") score *= 0.65;
    if (e.reliability === "unverified") score *= 0.5;
    if (e.reliability === "unavailable") score *= 0.2;
    if (e.redactionStatus === "blocked") score *= 0.1;
    sum += score;
  }
  return Math.max(0, Math.min(1, sum / evidence.length));
}

export function hasUsableEvidence(evidence: Evidence[]): boolean {
  return (
    evidence.length > 0 &&
    evidence.some(
      (e) =>
        e.reliability !== "unavailable" &&
        e.freshness !== "unavailable" &&
        e.redactionStatus !== "blocked",
    )
  );
}

export function labelStaleEvidence(evidence: Evidence[]): string[] {
  return evidence
    .filter((e) => e.freshness === "stale")
    .map(
      (e) =>
        `Stale evidence from ${e.source}: ${e.metricOrObservation} (collected ${e.collectedAt})`,
    );
}
