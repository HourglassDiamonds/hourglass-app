/**
 * Validation anchor eligibility — client payload completeness gates.
 *
 * Uses representative field snapshots for each validation report. When PDFs
 * are present, optionally asserts live client extraction matches eligibility.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, it } from "node:test";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import { withTimeout } from "@/lib/calibration-library/runtime-guard";
import {
  CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
} from "@/lib/calibration-library/runtime-limits";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";
import { presentClientInterpretationScore } from "./client-score-present";
import { assessExtractionCompleteness } from "./extraction-completeness";
import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";

const VALIDATION_DIR = join(
  process.cwd(),
  "data/light-performance-calibration/validation-reports",
);

function emptyFields(): CalibrationReportFields {
  return Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, ""]),
  ) as CalibrationReportFields;
}

function interpretEligibility(fields: CalibrationReportFields) {
  const completeness = assessExtractionCompleteness({ fields });
  const score = presentClientInterpretationScore(fields, "deep");
  const ctx = buildDiamondInterpretationContext({
    fields,
    rawScore: score.eligible ? score.overall : null,
  });
  return { completeness, ctx, score };
}

describe("validation report eligibility (field snapshots)", () => {
  it("IGI LG636401995 — full extraction allows score", () => {
    const fields = emptyFields();
    Object.assign(fields, {
      shape: "Round",
      carat: "1.00",
      measurements: "6.50 - 6.53 x 4.01",
      tablePercent: "59",
      depthPercent: "61.7",
      crownAngle: "33.2",
      pavilionAngle: "41.7",
      polish: "Excellent",
      symmetry: "Excellent",
      fluorescence: "None",
      cutGrade: "Excellent",
      girdle: "Medium to Slightly Thick (Faceted)",
      culet: "Pointed",
    });
    const { completeness, ctx } = interpretEligibility(fields);
    assert.equal(completeness.extractionState, "FULL_EXTRACTION");
    assert.equal(completeness.scoreEligible, true);
    assert.equal(ctx.canShowScore, true);
    assert.notEqual(ctx.displayScore, null);
    assert.notEqual(ctx.graphMode, "limited");
  });

  it("GIA 2496027047 — missing core proportions → no consumer score", () => {
    const fields = emptyFields();
    Object.assign(fields, {
      shape: "Round",
      carat: "1.52",
      measurements: "7.40 - 7.44 x 4.62",
      polish: "Excellent",
      symmetry: "Excellent",
      fluorescence: "None",
      girdle: "Medium to Slightly Thick (Faceted)",
      culet: "None",
    });
    const { completeness, ctx } = interpretEligibility(fields);
    assert.notEqual(completeness.extractionState, "FULL_EXTRACTION");
    assert.equal(completeness.scoreEligible, false);
    assert.equal(ctx.canShowScore, false);
    assert.equal(ctx.displayScore, null);
    assert.notEqual(ctx.displayLabel, "Balanced");
    assert.ok(
      ctx.graphMode === "limited" || !ctx.canShowGraph,
      "graph must not imply full calculated read",
    );
  });

  it("GCAL LG360796192 — metadata only → no Balanced score", () => {
    const fields = emptyFields();
    Object.assign(fields, {
      shape: "Round",
      carat: "1.01",
      measurements: "6.40 - 6.44 x 3.95",
      girdle: "Thin, Faceted",
      culet: "None",
      polish: "Excellent",
    });
    const { completeness, ctx } = interpretEligibility(fields);
    assert.equal(completeness.scoreEligible, false);
    assert.equal(ctx.canShowScore, false);
    assert.equal(ctx.displayScore, null);
    assert.doesNotMatch(ctx.displayLabel, /Balanced|Strong|Distinctive/);
  });

  it("GIA 6233708773 — all four core fields → score allowed", () => {
    const fields = emptyFields();
    Object.assign(fields, {
      shape: "Round",
      carat: "1.00",
      measurements: "6.50 - 6.53 x 4.01",
      tablePercent: "64",
      depthPercent: "58.4",
      crownAngle: "36.0",
      pavilionAngle: "40.6",
      polish: "Good",
      symmetry: "Very Good",
      fluorescence: "Faint",
    });
    const { completeness, ctx } = interpretEligibility(fields);
    assert.equal(completeness.extractionState, "FULL_EXTRACTION");
    assert.equal(completeness.scoreEligible, true);
    assert.equal(ctx.canShowScore, true);
  });

  it("GIA 6233708773 — client-incomplete snapshot → no score", () => {
    const fields = emptyFields();
    Object.assign(fields, {
      shape: "Round",
      carat: "1.00",
      measurements: "6.50 - 6.53 x 4.01",
      depthPercent: "58.4",
      polish: "Good",
      symmetry: "Very Good",
    });
    const { completeness, ctx } = interpretEligibility(fields);
    assert.equal(completeness.scoreEligible, false);
    assert.equal(ctx.canShowScore, false);
    assert.equal(ctx.displayScore, null);
  });
});

const LIVE_PDFS: Array<{
  file: string;
  label: string;
  expectScoreEligible: boolean | "depends";
}> = [
  { file: "IGI-LG636401995.pdf", label: "IGI", expectScoreEligible: true },
  { file: "GIA-2496027047.pdf", label: "GIA-LGDR", expectScoreEligible: true },
  { file: "GCAL-LG360796192.pdf", label: "GCAL", expectScoreEligible: false },
  {
    file: "GIA-6233708773.pdf",
    label: "GIA-facsimile",
    expectScoreEligible: "depends",
  },
];

describe("validation report eligibility (live client extract)", () => {
  for (const spec of LIVE_PDFS) {
    const path = join(VALIDATION_DIR, spec.file);
    if (!existsSync(path)) continue;

    it(`${spec.label} ${spec.file} client extract eligibility`, async () => {
      const bytes = readFileSync(path);
      const finalized = await withTimeout(
        runCalibrationUploadExtraction({
          bytes,
          mime: "application/pdf",
          mode: "client",
          pipelineTimeoutMs: CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
        }),
        CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
        "validation-eligibility",
      );

      const { completeness, ctx } = interpretEligibility(finalized.fields);

      if (spec.expectScoreEligible === true) {
        assert.equal(completeness.scoreEligible, true, completeness.reason);
        assert.equal(ctx.canShowScore, true);
      } else if (spec.expectScoreEligible === false) {
        assert.equal(completeness.scoreEligible, false, completeness.reason);
        assert.equal(ctx.canShowScore, false);
        assert.equal(ctx.displayScore, null);
      } else {
        assert.equal(
          ctx.canShowScore,
          completeness.scoreEligible,
          `display must match payload: ${completeness.reason}`,
        );
      }
    });
  }
});
