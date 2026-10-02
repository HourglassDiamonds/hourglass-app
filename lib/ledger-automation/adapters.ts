import type { LedgerSourceAdapter, LedgerSourceCheck, LedgerSourceDefinition } from "./types";

function freshness(source: LedgerSourceDefinition, checkedAt: string): LedgerSourceCheck["freshness"] {
  const observed = Date.parse(source.lastChecked);
  const checked = Date.parse(checkedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(checked)) return "UNKNOWN";
  const ageDays = Math.max(0, (checked - observed) / 86_400_000);
  return ageDays <= source.maxAgeDays ? "CURRENT" : "STALE";
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
      sourceLocation: source.sourceLocation,
      sourceType: source.sourceType,
      checkedAt: context.checkedAt,
      observationTimestamp: source.baselineObservationTimestamp,
      rawObservation: source.baselineRawObservation,
      normalizedObservation: source.baselineNormalizedObservation,
      reliability: source.reliability,
      required: source.required,
      freshness: freshness(source, context.checkedAt),
      failure: null,
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
