import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import type { TodaySnapshotRecord } from "./today-snapshot";
import { classifyProductionStagingToday } from "./production-staging-today";

function snapshot(input: { watermark?: string; validUntil?: string | null } = {}): TodaySnapshotRecord {
  return {
    snapshotKey: "founder_today_v1",
    readModelVersion: "continuum-today-read-model-v11",
    sourceWatermark: input.watermark ?? "live",
    composedAt: "2026-11-11T18:00:00.000Z",
    updatedAt: "2026-11-11T18:00:00.000Z",
    payload: {
      readModelVersion: "continuum-today-read-model-v11",
      validUntil: input.validUntil ?? null,
      docket: {
        todayDocketVersion: "cos-today-docket-v7",
        title: "Today",
        items: [],
        queuedCount: 0,
        watchingCount: 0,
        watching: [],
        showCaughtUp: true,
        showDisconnected: false,
        caughtUpHeading: "Caught up",
        caughtUpDetail: null,
        disconnectedHeading: null,
        disconnectedDetail: null,
      },
    },
  };
}

describe("Production staging persisted Today read", () => {
  it("classifies current, changed, expired, absent, and unverifiable snapshots", () => {
    const nowIso = "2026-11-11T19:00:00.000Z";
    assert.equal(classifyProductionStagingToday({ snapshot: snapshot(), liveWatermark: "live", nowIso }), "ready");
    assert.equal(classifyProductionStagingToday({ snapshot: snapshot(), liveWatermark: "changed", nowIso }), "stale");
    assert.equal(classifyProductionStagingToday({ snapshot: snapshot({ validUntil: nowIso }), liveWatermark: "live", nowIso }), "stale");
    assert.equal(classifyProductionStagingToday({ snapshot: null, liveWatermark: "live", nowIso }), "absent");
    assert.equal(classifyProductionStagingToday({ snapshot: snapshot(), liveWatermark: null, nowIso }), "unavailable");
  });

  it("cannot enter rebuild, reconciliation, Gmail, publisher, or mutation paths", () => {
    const loader = readFileSync(resolve(process.cwd(), "lib/continuum/production-staging-today.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "app/executive-dashboard/concierge/staging-read-only/page.tsx"), "utf8");
    assert.doesNotMatch(loader, /loadTodaySurface|rebuildTodayLoop|reconcileConditionalHolds|loadLiveTodayOperationalFacts|publishPersistedTodaySnapshot|\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
    assert.doesNotMatch(page, /completeTop5OpenJobAction|disposeTodayDocketItemAction|reviewProposedActionFromForm|askConcierge|loadTodayUpcoming|loadActiveClientWebsiteIntakes/);
    assert.match(page, /readOnly/);
    const today = readFileSync(resolve(process.cwd(), "app/executive-dashboard/concierge/components/chief-of-staff-today.tsx"), "utf8");
    const sections = readFileSync(resolve(process.cwd(), "app/executive-dashboard/concierge/components/today-operating-sections.tsx"), "utf8");
    assert.match(today, /allowMutations=\{!readOnly\}/);
    assert.match(today, /const showCheck = allowMutations &&/);
    assert.match(sections, /readOnly \? null : <form/);
    assert.match(sections, /readOnly \? null : <WebsiteIntakeControls/);
  });
});
