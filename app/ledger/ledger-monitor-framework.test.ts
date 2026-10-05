import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACAI_SERIES } from "./ai-capability-acceleration-data";
import {
  BUFFER_HEALTH_FORMAL_SNAPSHOTS,
  BUFFER_HEALTH_SNAPSHOT,
} from "./buffer-health-data";
import { GPM_SERIES } from "./global-pressure-monitor-data";
import { GWS_SERIES } from "./global-water-stress-data";
import { ISM_SERIES } from "./information-signal-map-data";
import { ISI_SERIES } from "./infrastructure-strain-data";
import type { LedgerMonitorSnapshot } from "./ledger-monitor-framework";
import { PMI_SERIES } from "./precious-materials-data";
import { SYSTEM_TEMPERATURE_SNAPSHOTS } from "./system-temperature";

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

  it("keeps every public history chronological, unique, and current-last", () => {
    const histories = [
      { id: "system-temperature", snapshots: SYSTEM_TEMPERATURE_SNAPSHOTS },
      { id: GPM_SERIES.id, snapshots: GPM_SERIES.snapshots },
      { id: ISM_SERIES.id, snapshots: ISM_SERIES.snapshots },
      { id: ACAI_SERIES.id, snapshots: ACAI_SERIES.snapshots },
      { id: PMI_SERIES.id, snapshots: PMI_SERIES.snapshots },
      { id: ISI_SERIES.id, snapshots: ISI_SERIES.snapshots },
      { id: GWS_SERIES.id, snapshots: GWS_SERIES.snapshots },
      { id: "buffer-health", snapshots: BUFFER_HEALTH_FORMAL_SNAPSHOTS },
    ];

    for (const history of histories) {
      const dates = history.snapshots.map((snapshot) => snapshot.reviewDate);
      const timestamps = dates.map((date) => Date.parse(`${date} UTC`));
      assert.equal(new Set(dates).size, dates.length, `${history.id} has duplicate dates`);
      assert.deepEqual(
        timestamps,
        [...timestamps].sort((a, b) => a - b),
        `${history.id} is not chronological`,
      );
      assert.equal(dates.at(-1), "October 1, 2026", `${history.id} is not current-last`);
    }
  });
});
