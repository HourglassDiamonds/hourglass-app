import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ACAI_SERIES } from "./ai-capability-acceleration-data";
import { BUFFER_HEALTH_SNAPSHOT } from "./buffer-health-data";
import { GPM_SERIES } from "./global-pressure-monitor-data";
import { GWS_SERIES } from "./global-water-stress-data";
import { ISM_SERIES } from "./information-signal-map-data";
import { ISI_SERIES } from "./infrastructure-strain-data";
import type { LedgerMonitorSnapshot } from "./ledger-monitor-framework";
import { PMI_SERIES } from "./precious-materials-data";
import { getLedgerIndex } from "./ledger-data";

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

  it("publishes October 10 as the latest review for every updated public monitor", () => {
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
      assert.equal(latest?.reviewDate, "October 10, 2026", series.id);
      assert.equal(latest?.evidenceCutoff, "October 10, 2026", series.id);
      assert.equal(
        series.snapshots.at(-2)?.reviewDate,
        "October 1, 2026",
        `${series.id} must preserve and append after October 1 history`,
      );
      assert.equal(
        series.snapshots.at(-2)?.sources.some((source) =>
          /October (?:[2-9]|10), 2026/.test(source.date),
        ),
        false,
        `${series.id} October 1 evidence must not resolve to later sources`,
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

  it("keeps hub states and directions synchronized with current monitor snapshots", () => {
    const pairs = [
      ["global-pressure", GPM_SERIES],
      ["information-signal", ISM_SERIES],
      ["ai-capability", ACAI_SERIES],
      ["precious-materials", PMI_SERIES],
      ["infrastructure-strain", ISI_SERIES],
      ["global-water-stress", GWS_SERIES],
    ] as const;
    for (const [id, series] of pairs) {
      const current = series.snapshots.at(-1)!;
      const hub = getLedgerIndex(id);
      assert.equal(hub.status, current.currentState, `${id} state`);
      assert.equal(
        hub.methodPills.find((pill) => pill.label === "Current Direction")?.value,
        current.currentDirection,
        `${id} direction`,
      );
    }
  });

  it("routes every current monitor through the shared October 10 date line", () => {
    const componentRoot = path.resolve(process.cwd(), "app", "ledger", "components");
    for (const file of [
      "global-pressure-monitor.tsx",
      "information-signal-map-view.tsx",
      "ai-capability-acceleration-index-view.tsx",
      "precious-materials-index-view.tsx",
      "infrastructure-strain-index-view.tsx",
      "global-water-stress-view.tsx",
      "buffer-health-view.tsx",
    ]) {
      assert.match(
        readFileSync(path.join(componentRoot, file), "utf8"),
        /LedgerMonitorStatusLines/,
        file,
      );
    }
  });
});
