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
});
