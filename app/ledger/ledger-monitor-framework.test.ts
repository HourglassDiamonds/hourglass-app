import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACAI_SERIES } from "./ai-capability-acceleration-data";
import { BUFFER_HEALTH_SNAPSHOT } from "./buffer-health-data";
import { GPM_SERIES } from "./global-pressure-monitor-data";
import { GWS_SERIES } from "./global-water-stress-data";
import { ISM_SERIES } from "./information-signal-map-data";
import { ISI_SERIES } from "./infrastructure-strain-data";
import type { LedgerMonitorSnapshot } from "./ledger-monitor-framework";
import { PMI_SERIES } from "./precious-materials-data";

const publicSnapshots: readonly LedgerMonitorSnapshot[] = [
  ...GPM_SERIES.snapshots,
  ...ISM_SERIES.snapshots,
  ...ACAI_SERIES.snapshots,
  ...PMI_SERIES.snapshots,
  ...ISI_SERIES.snapshots,
  ...GWS_SERIES.snapshots,
  BUFFER_HEALTH_SNAPSHOT,
];

describe("public Ledger monitor snapshot contract", () => {
  it("requires definition, status, confidence, criteria, update date, and sources", () => {
    for (const snapshot of publicSnapshots) {
      assert.ok(snapshot.definition.trim());
      assert.ok(snapshot.status.trim());
      assert.ok(snapshot.confidence.trim());
      assert.ok(snapshot.escalationCriteria.trim());
      assert.ok(snapshot.easingCriteria.trim());
      assert.ok(snapshot.lastUpdated.trim());
      assert.ok(Array.isArray(snapshot.sources));
    }
  });

  it("publishes October 1 as the latest review for every updated public monitor", () => {
    const updatedSeries = [
      GPM_SERIES,
      ISM_SERIES,
      ACAI_SERIES,
      PMI_SERIES,
      ISI_SERIES,
      GWS_SERIES,
    ];
    for (const series of updatedSeries) {
      const latest = series.snapshots.at(-1);
      assert.equal(latest?.reviewDate, "October 1, 2026", series.id);
      assert.equal(latest?.evidenceCutoff, "October 1, 2026", series.id);
      assert.equal(
        series.snapshots.at(-2)?.reviewDate,
        "September 16, 2026",
        `${series.id} must append rather than replace September history`,
      );
    }
  });

  it("retains evidence posture labels on October sources where applicable", () => {
    const octoberSources = [
      ...GPM_SERIES.snapshots.at(-1)!.sources,
      ...ISM_SERIES.snapshots.at(-1)!.sources,
      ...ACAI_SERIES.snapshots.at(-1)!.sources,
      ...PMI_SERIES.snapshots.at(-1)!.sources,
      ...ISI_SERIES.snapshots.at(-1)!.sources,
      ...GWS_SERIES.snapshots.at(-1)!.sources,
    ];
    const labels = new Set(octoberSources.map((source) => source.evidenceLabel));
    for (const label of ["Observed", "Provisional", "Lagged", "Forecast"] as const) {
      assert.ok(labels.has(label), `missing ${label} evidence label`);
    }
  });
});
