import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GPI_CATEGORIES,
  GPI_COMPUTED_READING,
  GPI_WEIGHTED_TOTAL,
  computeGpiReading,
  computeGpiWeightedTotal,
} from "./global-pressure-index-data";
import { getLedgerIndex } from "./ledger-data";

describe("Global Pressure Index weighted reading", () => {
  it("weights sum to 100%", () => {
    const weightSum = GPI_CATEGORIES.reduce((sum, c) => sum + c.weight, 0);
    assert.equal(Number(weightSum.toFixed(6)), 1);
  });

  it("computes ~84.1 from calibrated category scores", () => {
    const expected =
      96 * 0.2 + 94 * 0.2 + 58 * 0.2 + 87 * 0.15 + 88 * 0.15 + 82 * 0.1;
    assert.equal(computeGpiWeightedTotal(), expected);
    assert.ok(Math.abs(GPI_WEIGHTED_TOTAL - 84.05) < 0.001);
    assert.equal(computeGpiReading(), 84);
    assert.equal(GPI_COMPUTED_READING, 84);
  });

  it("ledger reading matches derived category total", () => {
    const gpi = getLedgerIndex("global-pressure");
    assert.equal(gpi.reading, GPI_COMPUTED_READING);
    assert.equal(gpi.status, "High and unstable");
    assert.equal(gpi.summaryEmphasis, "High Heat, Concentrated Pressure");
    assert.equal(
      gpi.weeklyDeltaLabel,
      "Methodology reset — no comparable weekly delta",
    );
    assert.match(
      gpi.weeklyDeltaExplanation ?? "",
      /should not be interpreted as a nine-degree cooling/,
    );
    assert.equal(gpi.recentReadings[0]?.degrees, 84);
    assert.equal(gpi.recentReadings[0]?.annotation, "Methodology recalibrated");
    assert.equal(gpi.recentReadings[1]?.degrees, 93);
    assert.match(gpi.calibrationNote?.title ?? "", /Methodology recalibration/);
  });
});
