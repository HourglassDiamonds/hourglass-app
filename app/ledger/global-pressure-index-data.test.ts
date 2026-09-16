import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GPI_CATEGORIES,
  GPI_COMPUTED_READING,
  GPI_WEIGHTED_TOTAL,
  computeGpiReading,
  computeGpiWeightedTotal,
} from "./global-pressure-index-data";
import {
  GPM_CURRENT_DIRECTION,
  GPM_CURRENT_STATE,
  GPM_DISPLAY_TITLE,
  GPM_INTRO,
  GPM_LEAD,
  GPM_METHODOLOGY_NOTICE,
  GPM_SNAPSHOT,
  GPM_WHAT_CHANGED,
} from "./global-pressure-monitor-data";
import { LEDGER_EVIDENCE_CUTOFF } from "./ledger-monitor-framework";
import { getLedgerIndex } from "./ledger-data";

describe("Global Pressure Index weighted reading (archived numerical series)", () => {
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

  it("preserves archived numerical fields without publishing them as the public title", () => {
    const gpi = getLedgerIndex("global-pressure");
    assert.equal(gpi.reading, GPI_COMPUTED_READING);
    assert.equal(gpi.displayTitle, GPM_DISPLAY_TITLE);
    assert.equal(
      gpi.status,
      "Very high external pressure / Broader energy transmission",
    );
    assert.equal(gpi.updatedLabel, "");
    assert.doesNotMatch(gpi.updatedLabel, /updated weekly/i);
    assert.doesNotMatch(gpi.seoDescription, /84°/);
    assert.equal(gpi.recentReadings[0]?.degrees, 84);
    assert.equal(gpi.recentReadings[1]?.degrees, 93);
  });
});

describe("Global Pressure Monitor interim copy", () => {
  it("states qualitative status without a published temperature", () => {
    assert.equal(
      GPM_CURRENT_STATE,
      "Very high external pressure / Broader energy transmission",
    );
    assert.equal(
      GPM_CURRENT_DIRECTION,
      "Energy disruption broadening / Adaptation still limiting systemic failure",
    );
    assert.match(GPM_LEAD, /credit|function/i);
    assert.match(GPM_LEAD, /130/);
    assert.doesNotMatch(GPM_LEAD, /\d+°/);
    assert.doesNotMatch(GPM_INTRO, /System Temperature/i);
    assert.doesNotMatch(GPM_INTRO, /interim|methodology revision/i);
    assert.match(GPM_METHODOLOGY_NOTICE, /System Temperature/);
    assert.match(GPM_WHAT_CHANGED, /August 24 review/i);
    assert.equal(GPM_SNAPSHOT.evidenceCutoff, LEDGER_EVIDENCE_CUTOFF);
    assert.equal(GPM_SNAPSHOT.reviewDate, "September 16, 2026");
    assert.ok(
      GPM_SNAPSHOT.sources.some((source) =>
        source.institution.includes("Reuters") || source.institution === "The National",
      ),
    );
    assert.ok(
      GPM_SNAPSHOT.sources.some((source) =>
        source.institution.includes("Energy Information Administration"),
      ),
    );
  });

  it("appends September 16 after preserved August snapshots", async () => {
    const { GPM_SERIES } = await import("./global-pressure-monitor-data");
    assert.equal(GPM_SERIES.snapshots.length, 5);
    assert.equal(GPM_SERIES.snapshots[0]?.reviewDate, "August 3, 2026");
    assert.equal(GPM_SERIES.snapshots[1]?.reviewDate, "August 12, 2026");
    assert.equal(GPM_SERIES.snapshots[2]?.reviewDate, "August 18, 2026");
    assert.equal(GPM_SERIES.snapshots[3]?.reviewDate, "August 24, 2026");
    assert.equal(GPM_SERIES.snapshots[4]?.reviewDate, "September 16, 2026");
    assert.equal(GPM_SERIES.snapshots[3]?.evidenceCutoff, "August 24, 2026");
  });

  it("requires authoritative source cards on the current snapshot", () => {
    assert.ok(GPM_SNAPSHOT.sources.length >= 3);
    for (const source of GPM_SNAPSHOT.sources) {
      assert.ok(source.institution.trim());
      assert.ok(source.title.trim());
      assert.ok(source.date.trim());
      assert.ok(source.supports.trim());
    }
    assert.ok(GPM_SNAPSHOT.sources.every((source) => source.url));
  });
});
