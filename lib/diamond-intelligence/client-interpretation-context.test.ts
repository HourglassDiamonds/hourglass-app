import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";

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

const MISSING_CROWN = fields({
  ...FULL,
  crownAngle: "",
});

const MISSING_PAVILION = fields({
  ...FULL,
  pavilionAngle: "",
});

const GIA_MEAS_FINISH = fields({
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

const IDENTITY_ONLY = fields({ shape: "Round", carat: "1.00" });

describe("buildDiamondInterpretationContext", () => {
  it("full IGI-like → high/full, raw score allowed, rare language allowed", () => {
    const ctx = buildDiamondInterpretationContext({ fields: FULL, rawScore: 97 });
    assert.equal(ctx.readState, "full");
    assert.equal(ctx.confidenceLevel, "high");
    assert.equal(ctx.displayScore, 97);
    assert.equal(ctx.displayLabel, "Top 1%");
    assert.equal(ctx.displayBand, "Top 1%");
    assert.equal(ctx.canShowRareLanguage, true);
    assert.equal(ctx.graphMode, "full");
    assert.equal(ctx.copyTone, "confident");
  });

  it("missing crown → not full, no rare/top, capped score", () => {
    const ctx = buildDiamondInterpretationContext({
      fields: MISSING_CROWN,
      rawScore: 97,
    });
    assert.notEqual(ctx.readState, "full");
    assert.equal(ctx.canShowRareLanguage, false);
    assert.equal(ctx.displayBand, null);
    assert.ok(ctx.displayScore !== null && ctx.displayScore <= 92);
    assert.doesNotMatch(ctx.displayLabel, /Top/);
  });

  it("missing pavilion → not full, no rare/top, capped score", () => {
    const ctx = buildDiamondInterpretationContext({
      fields: MISSING_PAVILION,
      rawScore: 97,
    });
    assert.notEqual(ctx.readState, "full");
    assert.equal(ctx.canShowRareLanguage, false);
    assert.equal(ctx.displayBand, null);
    assert.doesNotMatch(ctx.displayLabel, /Top|Exceptional|Rare|Elite/);
  });

  it("GIA-style partial (meas + finish, no proportions) → no confident score", () => {
    const ctx = buildDiamondInterpretationContext({
      fields: GIA_MEAS_FINISH,
      rawScore: 90,
    });
    assert.ok(ctx.readState === "partial" || ctx.readState === "orientation");
    assert.equal(ctx.canShowRareLanguage, false);
    assert.notEqual(ctx.graphMode, "full");
    if (ctx.displayScore !== null) {
      assert.ok(ctx.displayScore <= 85);
    }
  });

  it("GCAL partial raw 97 (missing crown/pavilion) → capped, no Exceptional/Top/Rare", () => {
    const ctx = buildDiamondInterpretationContext({
      fields: GCAL_PARTIAL,
      rawScore: 97,
    });
    assert.equal(ctx.readState, "partial");
    assert.equal(ctx.canShowRareLanguage, false);
    assert.equal(ctx.displayBand, null);
    assert.ok(ctx.displayScore === null || ctx.displayScore <= 92);
    assert.doesNotMatch(ctx.displayLabel, /Top|Exceptional|Rare|Elite/);
  });

  it("orientation read → no numeric score, no full graph, orientation tone", () => {
    const ctx = buildDiamondInterpretationContext({
      fields: IDENTITY_ONLY,
      rawScore: 97,
    });
    assert.equal(ctx.readState, "orientation");
    assert.equal(ctx.canShowScore, false);
    assert.equal(ctx.displayScore, null);
    assert.equal(ctx.canShowGraph, false);
    assert.notEqual(ctx.graphMode, "full");
    assert.equal(ctx.copyTone, "orientation");
    assert.match(ctx.primaryExplanation, /starting point/i);
  });

  it("explanations answer good/sure/missing/next without poor-performance language", () => {
    for (const f of [FULL, MISSING_CROWN, GIA_MEAS_FINISH, IDENTITY_ONLY]) {
      const ctx = buildDiamondInterpretationContext({ fields: f, rawScore: 90 });
      assert.ok(ctx.primaryExplanation.length > 0);
      assert.ok(ctx.confidenceExplanation.length > 0);
      assert.ok(ctx.nextStep.length > 0);
      assert.doesNotMatch(
        `${ctx.primaryExplanation} ${ctx.confidenceExplanation} ${ctx.nextStep}`,
        /poor|weak|bad|parser|OCR|calibration|corpus/i,
      );
    }
  });

  it("display never exceeds the cap for partial/low even with raw 100", () => {
    const ctx = buildDiamondInterpretationContext({
      fields: GIA_MEAS_FINISH,
      rawScore: 100,
    });
    if (ctx.displayScore !== null) {
      assert.ok(ctx.displayScore <= 85);
    }
    assert.equal(ctx.canShowRareLanguage, false);
  });
});
