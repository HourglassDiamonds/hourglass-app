import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { shouldPollTodayFreshness, shouldSwapTodayAfterRecompute } from "./today-refresh";
import { deriveTodayFreshnessInvalidation } from "@/lib/continuum/gmail/freshness-cycle";
import {
  TODAY_READ_MODEL_TTL_MS,
  beginTodayRecompute,
  chooseTodayNavigation,
  readCachedTodayLoop,
  readLastKnownTodayLoop,
  resetTodayReadModelCache,
  shouldScheduleTodayRecompute,
  storeCachedTodayLoop,
  todayRecomputeInFlight,
  waitForTodayRecompute,
} from "./today-read-model";
import type { CosOperatingLoopView } from "./types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

function loop(heading: string): CosOperatingLoopView {
  return {
    contractVersion: "cos-operating-loop-v1",
    status: "active",
    heading,
    quietDetail: null,
    top5: [],
    remainingCount: 0,
    brief: [],
    watching: [],
    needsYourDecision: [],
    worthKnowing: [],
    recap: [],
    anomalies: [],
    proposedActions: [],
    masterSprint: [],
  } as CosOperatingLoopView;
}

describe("Today navigation read model", () => {
  it("reuses a composed loop when the source watermark is unchanged", () => {
    resetTodayReadModelCache();
    const first = loop("first");
    storeCachedTodayLoop("v1", 1_000, first);
    assert.equal(readCachedTodayLoop("v1", 1_000 + 1_000), first);
    assert.equal(readCachedTodayLoop("v2", 1_000 + 1_000), null);
  });

  it("recomputes after the read-model window even if the watermark is unchanged", () => {
    resetTodayReadModelCache();
    storeCachedTodayLoop("v1", 1_000, loop("stale"));
    assert.equal(
      readCachedTodayLoop("v1", 1_000 + TODAY_READ_MODEL_TTL_MS + 1),
      null,
    );
  });

  it("does not await Gmail incremental sync while rendering Today", () => {
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/page.tsx"),
      "utf8",
    );
    const load = readFileSync(
      join(ROOT, "lib/continuum/chief-of-staff/operating-loop/load.ts"),
      "utf8",
    );
    assert.match(page, /loadTodaySurface/);
    assert.doesNotMatch(page, /runGmailIncrementalChunk|runGmailFreshnessCycle|executeLiveGmailFreshnessCycle/);
    assert.doesNotMatch(load, /runGmailIncrementalChunk|runGmailFreshnessCycle|executeLiveGmailFreshnessCycle/);
    assert.match(load, /readCachedTodayLoop/);
    assert.match(load, /Promise\.all/);
  });

  it("shows the last composed loop immediately when the watermark changes", () => {
    resetTodayReadModelCache();
    const first = loop("last known");
    storeCachedTodayLoop("v1", 1_000, first);
    assert.equal(readCachedTodayLoop("v2", 1_000), null);
    assert.equal(readLastKnownTodayLoop()?.loop, first);
    assert.equal(
      chooseTodayNavigation({ exactHit: false, hasLastKnown: true }),
      "refreshing",
    );
    assert.equal(
      chooseTodayNavigation({ exactHit: true, hasLastKnown: true }),
      "current",
    );
    assert.equal(
      chooseTodayNavigation({ exactHit: false, hasLastKnown: false }),
      "cold",
    );
  });

  it("keeps the last composed loop when background recomposition fails", async () => {
    resetTodayReadModelCache();
    storeCachedTodayLoop("v1", 1_000, loop("last known"));
    const started = beginTodayRecompute("v2", async () => {
      throw new Error("recompute failed");
    });
    assert.equal(started, true);
    assert.equal(beginTodayRecompute("v3", async () => {}), false);
    assert.equal(todayRecomputeInFlight(), true);
    await waitForTodayRecompute();
    assert.equal(todayRecomputeInFlight(), false);
    assert.equal(readLastKnownTodayLoop()?.loop.heading, "last known");
    assert.equal(shouldScheduleTodayRecompute("v2", Date.now()), false);
    assert.equal(shouldScheduleTodayRecompute("v3", Date.now()), true);
  });

  it("swaps Today only after a newer composed watermark is stored", () => {
    assert.equal(
      shouldSwapTodayAfterRecompute({
        baselineWatermark: "v1",
        cacheWatermark: "v1",
        pending: true,
        elapsedMs: 1_000,
        observedPending: true,
      }),
      "wait",
    );
    assert.equal(
      shouldSwapTodayAfterRecompute({
        baselineWatermark: "v1",
        cacheWatermark: "v2",
        pending: false,
        elapsedMs: 1_000,
        observedPending: true,
      }),
      "swap",
    );
    assert.equal(
      shouldSwapTodayAfterRecompute({
        baselineWatermark: "v1",
        cacheWatermark: "v1",
        pending: false,
        elapsedMs: 100,
        observedPending: true,
      }),
      "keep",
    );
  });

  it("returns the last known docket before the synchronous rebuild", () => {
    const load = readFileSync(
      join(ROOT, "lib/continuum/chief-of-staff/operating-loop/load.ts"),
      "utf8",
    );
    const fn = load.slice(load.indexOf("export async function loadTodaySurface"));
    const refreshing = fn.indexOf('choice === "refreshing"');
    const snapshot = fn.indexOf("decideSnapshotUse");
    const rebuild = fn.indexOf("await rebuildTodayLoop");
    assert.ok(refreshing > 0);
    assert.ok(snapshot > refreshing);
    assert.ok(rebuild > snapshot);
    assert.match(fn, /scheduleTodayRebuild/);
    assert.match(load, /from "next\/server"/);
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-operating-freshness.tsx"),
      "utf8",
    );
    assert.match(ui, /Checking for updates/);
    assert.match(ui, /probeTodayRecompute/);
    assert.match(ui, /shouldSwapTodayAfterRecompute/);
    assert.doesNotMatch(ui, /location\.reload/);
  });

  it("keeps hidden-tab polling off and still invalidates a source-event-only change", () => {
    assert.equal(shouldPollTodayFreshness({ documentHidden: true, inFlight: false }), false);
    assert.equal(shouldPollTodayFreshness({ documentHidden: false, inFlight: false }), true);
    const flags = deriveTodayFreshnessInvalidation({
      indexedThisCycle: 1,
      inboundMessageIdBefore: "before",
      outboundMessageIdBefore: null,
      inboundMessageIdAfter: "after",
      outboundMessageIdAfter: null,
      insertedCount: 0,
    });
    assert.equal(flags.sourceEventsChanged, true);
    assert.equal(flags.candidatesChanged, false);
    assert.equal(flags.docketMayHaveChanged, true);
  });
});
