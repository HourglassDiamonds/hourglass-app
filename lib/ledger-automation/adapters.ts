import type { LedgerSourceAdapter, LedgerSourceCheck, LedgerSourceDefinition } from "./types";

function freshness(source: LedgerSourceDefinition, checkedAt: string): LedgerSourceCheck["freshness"] {
  const observed = Date.parse(source.lastChecked);
  const checked = Date.parse(checkedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(checked)) return "UNKNOWN";
  const ageDays = Math.max(0, (checked - observed) / 86_400_000);
  // The V1 replay contract used a uniform 45-day window. Provider-specific
  // SLAs apply only to fetched V1.1 observations.
  return ageDays <= Math.max(45, source.maxAgeDays) ? "CURRENT" : "STALE";
}

/** Replays approved observations; it never claims that a network fetch occurred. */
export const approvedSnapshotAdapter: LedgerSourceAdapter = {
  adapterId: "approved-october-snapshot-v1",
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
      observationTimestamp: source.baselineObservationTimestamp,
      rawObservation: source.baselineRawObservation,
      rawValue: source.baselineRawObservation,
      rawPayload: null,
      normalizedObservation: source.baselineNormalizedObservation,
      normalizedValue: source.baselineNormalizedObservation,
      unit: null,
      reliability: source.reliability,
      confidence: source.reliability,
      required: source.required,
      freshness: freshness(source, context.checkedAt),
      sourceFreshness: freshness(source, context.checkedAt),
      status: source.sourceMode === "LIVE" ? "OK" : "MANUAL_REVIEW_REQUIRED",
      failure: null,
      failureReason: null,
      metadata: { adapterId: "approved-october-snapshot-v1", networkFetch: false },
      contradictorySourceIds: [],
    } satisfies LedgerSourceCheck;
  },
};

export function createFixtureAdapter(
  overrides: Readonly<Record<string, Partial<LedgerSourceCheck>>>,
): LedgerSourceAdapter {
  return {
    adapterId: "ledger-test-fixture-v1",
    async check(source, context) {
      const baseline = await approvedSnapshotAdapter.check(source, context);
      return { ...baseline, ...overrides[source.sourceId] };
    },
  };
}
