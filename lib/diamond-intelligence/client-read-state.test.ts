import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import { buildClientReadState } from "./client-read-state";

function fields(
  overrides: Partial<Record<ReportFieldKey, string>>,
): CalibrationReportFields {
  const base = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, ""]),
  ) as CalibrationReportFields;
  return { ...base, ...overrides };
}

const IGI_FULL = fields({
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

const IGI_MISSING_CROWN_PAVILION = fields({
  shape: "Round",
  carat: "1.00",
  measurements: "6.50 - 6.53 x 4.01",
  tablePercent: "57",
  depthPercent: "61.5",
  polish: "Excellent",
  symmetry: "Excellent",
  fluorescence: "None",
});

const GCAL_PARTIAL = fields({
  shape: "Round",
  carat: "1.00",
  measurements: "6.40 - 6.44 x 3.95",
  tablePercent: "56",
  depthPercent: "62.1",
});

const GIA_MEAS_FINISH = fields({
  shape: "Round",
  carat: "1.20",
  measurements: "6.80 - 6.84 x 4.20",
  polish: "Excellent",
  symmetry: "Very Good",
  fluorescence: "Faint",
});

const IDENTITY_ONLY = fields({
  shape: "Round",
  carat: "1.00",
});

describe("buildClientReadState", () => {
  it("full IGI-like report → full / high, score + graph + traits", () => {
    const r = buildClientReadState(IGI_FULL);
    assert.equal(r.state, "full");
    assert.equal(r.confidence, "high");
    assert.equal(r.canShowScore, true);
    assert.equal(r.canShowGraph, true);
    assert.equal(r.canShowTraitBreakdown, true);
    assert.equal(r.canShowRareLanguage, true);
    assert.equal(r.displayScoreCap, 100);
    assert.equal(r.summaryTone, "confident");
  });

  it("missing crown/pavilion → cannot be full, no rare/top language", () => {
    const r = buildClientReadState(IGI_MISSING_CROWN_PAVILION);
    assert.notEqual(r.state, "full");
    assert.equal(r.canShowRareLanguage, false);
    assert.ok(r.displayScoreCap !== null && r.displayScoreCap <= 92);
    assert.ok(r.missingCriticalFields.includes("crown angle"));
    assert.ok(r.missingCriticalFields.includes("pavilion angle"));
  });

  it("GCAL partial (table/depth only) → partial, capped, restrained graph", () => {
    const r = buildClientReadState(GCAL_PARTIAL);
    assert.equal(r.state, "partial");
    assert.equal(r.canShowScore, true);
    assert.equal(r.canShowGraph, true);
    assert.equal(r.canShowRareLanguage, false);
    assert.ok(r.displayScoreCap !== null && r.displayScoreCap <= 92);
    assert.ok(r.graphStrengthMultiplier < 1);
    assert.equal(r.summaryTone, "careful");
  });

  it("GIA measurements + finish, no proportions → partial, no confident score", () => {
    const r = buildClientReadState(GIA_MEAS_FINISH);
    assert.ok(r.state === "partial" || r.state === "orientation");
    assert.equal(r.canShowRareLanguage, false);
    if (r.displayScoreCap !== null) {
      assert.ok(r.displayScoreCap <= 85);
    }
  });

  it("identity only → orientation: no score, no graph polygon, no traits", () => {
    const r = buildClientReadState(IDENTITY_ONLY);
    assert.equal(r.state, "orientation");
    assert.equal(r.canShowScore, false);
    assert.equal(r.canShowGraph, false);
    assert.equal(r.canShowTraitBreakdown, false);
    assert.equal(r.canShowRareLanguage, false);
    assert.equal(r.displayScoreCap, null);
    assert.equal(r.graphStrengthMultiplier, 0);
    assert.equal(r.summaryTone, "orientation");
  });

  it("reason never implies poor performance", () => {
    for (const f of [
      IGI_FULL,
      IGI_MISSING_CROWN_PAVILION,
      GCAL_PARTIAL,
      GIA_MEAS_FINISH,
      IDENTITY_ONLY,
    ]) {
      const r = buildClientReadState(f);
      assert.doesNotMatch(r.reason, /poor|weak|bad|fail/i);
    }
  });
});
