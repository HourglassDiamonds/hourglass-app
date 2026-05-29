import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import { buildClientInterpretationConfidence } from "./client-interpretation-confidence";
import {
  presentConfidenceAdjustedRead,
  presentTraitReadLabel,
} from "./client-percentile-present";

function fields(
  overrides: Partial<Record<ReportFieldKey, string>>,
): CalibrationReportFields {
  const base = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, ""]),
  ) as CalibrationReportFields;
  return { ...base, ...overrides };
}

const FULL = fields({
  shape: "Round",
  carat: "1.00",
  measurements: "6.50 - 6.53 x 4.01",
  tablePercent: "57",
  depthPercent: "61.5",
  crownAngle: "34.5",
  pavilionAngle: "40.8",
  polish: "Excellent",
  symmetry: "Excellent",
  fluorescence: "None",
});

const GIA_PARTIAL = fields({
  shape: "Round",
  carat: "1.20",
  measurements: "6.80 - 6.84 x 4.20",
  polish: "Excellent",
  symmetry: "Very Good",
  fluorescence: "Faint",
});

const GCAL_PARTIAL = fields({
  shape: "Round",
  carat: "1.00",
  measurements: "6.40 - 6.44 x 3.95",
  tablePercent: "56",
  depthPercent: "62.1",
});

describe("buildClientInterpretationConfidence", () => {
  it("returns HIGH for full proportions + finish", () => {
    const c = buildClientInterpretationConfidence(FULL);
    assert.equal(c.level, "high");
    assert.equal(c.scoreDisplayCap, 100);
    assert.equal(c.graphStrengthMultiplier, 1);
    assert.equal(c.canShowRareLanguage, true);
    assert.equal(c.canShowExceptionalLanguage, true);
    assert.equal(c.hasCoreProportions, true);
    assert.deepEqual(c.missingCriticalFields, []);
  });

  it("returns LOW for measurements + finish but no core proportions (GIA partial)", () => {
    const c = buildClientInterpretationConfidence(GIA_PARTIAL);
    assert.equal(c.level, "low");
    assert.ok(c.scoreDisplayCap <= 85);
    assert.equal(c.canShowRareLanguage, false);
    assert.equal(c.canShowExceptionalLanguage, false);
    assert.ok(c.missingCriticalFields.includes("table"));
    assert.ok(c.missingCriticalFields.includes("crown angle"));
  });

  it("returns MEDIUM for measurements + 2 core proportions (GCAL partial)", () => {
    const c = buildClientInterpretationConfidence(GCAL_PARTIAL);
    assert.equal(c.level, "medium");
    assert.equal(c.scoreDisplayCap, 92);
    assert.equal(c.canShowExceptionalLanguage, false);
    assert.ok(c.missingCriticalFields.includes("crown angle"));
    assert.ok(c.missingCriticalFields.includes("pavilion angle"));
  });

  it("reason text never sounds like a penalty", () => {
    for (const f of [FULL, GIA_PARTIAL, GCAL_PARTIAL]) {
      const c = buildClientInterpretationConfidence(f);
      assert.doesNotMatch(c.reason, /penal|downgrad|punish/i);
    }
  });
});

describe("presentConfidenceAdjustedRead caps display by confidence", () => {
  const low = buildClientInterpretationConfidence(GIA_PARTIAL);
  const medium = buildClientInterpretationConfidence(GCAL_PARTIAL);
  const high = buildClientInterpretationConfidence(FULL);

  it("raw 97 + low confidence → capped <= 85, no rare pill", () => {
    const r = presentConfidenceAdjustedRead(97, low);
    assert.ok(r.displayScore !== null && r.displayScore <= 85);
    assert.equal(r.presentation.showRarePill, false);
    assert.equal(r.presentation.pillText, null);
    assert.doesNotMatch(r.presentation.label, /Top/);
    assert.equal(r.capped, true);
  });

  it("raw 97 + medium confidence → capped <= 92, no Top/rare", () => {
    const r = presentConfidenceAdjustedRead(97, medium);
    assert.ok(r.displayScore !== null && r.displayScore <= 92);
    assert.equal(r.presentation.showRarePill, false);
    assert.doesNotMatch(r.presentation.label, /Top/);
    assert.equal(r.capped, true);
  });

  it("raw 97 + high confidence → Top 1% allowed", () => {
    const r = presentConfidenceAdjustedRead(97, high);
    assert.equal(r.displayScore, 97);
    assert.equal(r.presentation.showRarePill, true);
    assert.equal(r.presentation.pillText, "Top 1%");
    assert.equal(r.capped, false);
  });

  it("null raw score stays Needs review", () => {
    const r = presentConfidenceAdjustedRead(null, high);
    assert.equal(r.displayScore, null);
    assert.equal(r.presentation.label, "Needs review");
  });
});

describe("trait labels suppress rare claims below high confidence", () => {
  const strongTrait = { label: "Brightness", level: "Strong" as const, fillPercent: 99 };

  it("suppressRareLabels caps trait to Strong (no Top %)", () => {
    const label = presentTraitReadLabel(strongTrait, 97, {
      suppressRareLabels: true,
    });
    assert.equal(label, "Strong");
    assert.doesNotMatch(label, /Top|Exceptional|Rare|Elite/i);
  });

  it("without suppression, high coherence still allows rare label", () => {
    const label = presentTraitReadLabel(strongTrait, 99, {
      suppressRareLabels: false,
    });
    assert.match(label, /Rare|Top 0\.5%/);
  });

  it("missing-data trait shows calm copy, never poor-performance language", () => {
    const label = presentTraitReadLabel(
      { label: "Scintillation", level: "Needs review", fillPercent: 0 },
      85,
      { suppressRareLabels: true },
    );
    assert.doesNotMatch(label, /weak|poor|failed|bad/i);
  });
});
