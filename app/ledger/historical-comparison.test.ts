import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BUFFER_HEALTH_FORMAL_SNAPSHOTS,
  type BufferHealthHistoricalSnapshot,
} from "./buffer-health-data";
import LedgerHistoryComparison from "./components/ledger-history-comparison";
import {
  buildLedgerHistoricalComparisons,
  LEDGER_COMPARISON_PERIODS,
} from "./historical-comparison";
import {
  SYSTEM_TEMPERATURE_SNAPSHOTS,
  SYSTEM_TEMPERATURE_SNAPSHOT_2026_10_01,
} from "./system-temperature";

describe("Ledger historical shadow comparison", () => {
  it("exposes the requested 1M, 3M, 6M, and 12M periods", () => {
    assert.deepEqual(LEDGER_COMPARISON_PERIODS, ["1M", "3M", "6M", "12M"]);
  });

  it("compares 1M System Temperature to the actual August 24 snapshot", () => {
    const comparison = buildLedgerHistoricalComparisons().find(
      (entry) => entry.period === "1M",
    );
    assert.ok(comparison);
    assert.equal(comparison.system.available, true);
    assert.equal(comparison.system.currentDate, "October 10, 2026");
    assert.equal(comparison.system.currentDegrees, 74);
    assert.equal(comparison.system.targetDate, "September 10, 2026");
    assert.equal(comparison.system.comparisonDate, "August 24, 2026");
    assert.equal(comparison.system.comparisonDegrees, 70);
    assert.equal(comparison.system.delta, 4);
  });

  it("never invents System Temperature snapshots for longer unavailable periods", () => {
    const comparisons = buildLedgerHistoricalComparisons();
    for (const period of ["3M", "6M", "12M"] as const) {
      const comparison = comparisons.find((entry) => entry.period === period);
      assert.ok(comparison);
      assert.equal(comparison.system.available, false);
      assert.equal(
        comparison.system.unavailableMessage,
        "No formal baseline is available for this period.",
      );
      assert.equal(comparison.system.comparisonDate, null);
    }
  });

  it("preserves October 1 as the first formal Buffer Health baseline", () => {
    assert.equal(BUFFER_HEALTH_FORMAL_SNAPSHOTS.length, 2);
    assert.equal(
      BUFFER_HEALTH_FORMAL_SNAPSHOTS[0]?.reviewDate,
      "October 1, 2026",
    );
    assert.equal(
      BUFFER_HEALTH_FORMAL_SNAPSHOTS[1]?.reviewDate,
      "October 10, 2026",
    );
    for (const comparison of buildLedgerHistoricalComparisons()) {
      assert.equal(comparison.buffer.available, false);
      assert.equal(comparison.buffer.comparisonDate, null);
      assert.deepEqual(comparison.buffer.comparisonDomains, []);
      assert.equal(
        comparison.buffer.unavailableMessage,
        "No formal baseline is available for this period.",
      );
    }
  });

  it("adds a Buffer Health ghost only when a prior formal snapshot exists", () => {
    const prior: BufferHealthHistoricalSnapshot = {
      reviewDate: "September 1, 2026",
      evidenceCutoff: "September 1, 2026",
      domains: BUFFER_HEALTH_FORMAL_SNAPSHOTS[0]!.domains,
    };
    const comparisons = buildLedgerHistoricalComparisons(
      SYSTEM_TEMPERATURE_SNAPSHOTS,
      [prior, ...BUFFER_HEALTH_FORMAL_SNAPSHOTS],
    );
    const html = renderToStaticMarkup(
      createElement(LedgerHistoryComparison, { comparisons }),
    );
    assert.match(html, /data-buffer-history-available="true"/);
    assert.match(html, /data-buffer-shadow-overlay="households"/);
    assert.match(html, /Ghost overlay: September 1, 2026/);
  });

  it("renders no Buffer Health ghost for the live first-baseline series", () => {
    const html = renderToStaticMarkup(
      createElement(LedgerHistoryComparison, {
        comparisons: buildLedgerHistoricalComparisons(),
      }),
    );
    assert.match(html, /data-system-history-available="true"/);
    assert.match(html, /70° on August 24, 2026/);
    assert.match(html, /data-buffer-history-available="false"/);
    assert.match(html, /No formal baseline is available for this period/);
    assert.doesNotMatch(html, /data-buffer-shadow-overlay/);
  });

  it("mounts the comparison on the public Ledger hub and Buffer Health route", () => {
    const ledgerRoot = path.resolve(process.cwd(), "app", "ledger");
    const hub = readFileSync(path.join(ledgerRoot, "page.tsx"), "utf8");
    const bufferRoute = readFileSync(
      path.join(ledgerRoot, "buffer-health", "page.tsx"),
      "utf8",
    );
    assert.match(hub, /<LedgerHistoryComparison comparisons=/);
    assert.match(bufferRoute, /<LedgerHistoryComparison comparisons=/);
    assert.equal(SYSTEM_TEMPERATURE_SNAPSHOT_2026_10_01.reviewDate, "October 1, 2026");
  });
});
