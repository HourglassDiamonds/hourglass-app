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
      "Very high external pressure / Cross-system transmission emerging",
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
      "Very high external pressure / Cross-system transmission emerging",
    );
    assert.equal(
      GPM_CURRENT_DIRECTION,
      "Worsening — energy disruption is beginning to transmit into broader financial conditions while systemic function remains intact.",
    );
    assert.match(GPM_LEAD, /credit|function/i);
    assert.match(GPM_LEAD, /130/);
    assert.doesNotMatch(GPM_LEAD, /\d+°/);
    assert.doesNotMatch(GPM_INTRO, /System Temperature/i);
    assert.doesNotMatch(GPM_INTRO, /interim|methodology revision/i);
    assert.match(GPM_METHODOLOGY_NOTICE, /Composite numerical scoring is paused/);
    assert.match(GPM_WHAT_CHANGED, /August 12 review/i);
    assert.equal(GPM_SNAPSHOT.evidenceCutoff, LEDGER_EVIDENCE_CUTOFF);
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
});
