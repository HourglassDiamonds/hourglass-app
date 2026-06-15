import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { toClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import { needsPartialGradeReview } from "@/app/diamond-intelligence/components/v3-presentation";
import {
  buildReportGradeHintSource,
  parseReportGradeHints,
} from "@/lib/diamond-intelligence/report-grade-hints";

const GARBLED_OCR_PATH = "data/diamond-intelligence/debug/7496507350-jpg-ocr.txt";

function giaImageFinalizedFixture(input: {
  reportGradeHintText?: string;
  rawTextSnippet?: string;
}) {
  const garbled = existsSync(GARBLED_OCR_PATH)
    ? readFileSync(GARBLED_OCR_PATH, "utf8")
    : "";
  return {
    parserType: "gia-modern" as const,
    metadata: {
      lab: "GIA" as const,
      reportNumber: "7696507350",
      stoneType: "lab-grown" as const,
    },
    fields: {
      shape: "Round Brilliant",
      carat: ".",
      measurements: "8.92 - 8.53 x 5.33 mm",
      tablePercent: "57",
      depthPercent: "62.5",
      crownAngle: "36",
      pavilionAngle: "40.6",
      polish: "",
      symmetry: "",
      fluorescence: "",
      cutGrade: "",
      girdle: "",
      culet: "",
      lowerHalfPercent: "80",
      starLengthPercent: "50",
    },
    confidence: {},
    warnings: [],
    reportGradeHintText: input.reportGradeHintText,
    rawTextSnippet: input.rawTextSnippet ?? garbled.slice(0, 1200),
    fieldsNormalized: {},
    valueProvenance: {},
    calibrationSafety: {
      calibrationEligible: false,
      excludedFromCalibrationStats: true,
      flags: [],
    },
    calibrationEligible: false,
    excludedFromCalibrationStats: true,
  };
}

describe("buildReportGradeHintSource image handoff", () => {
  it("prefers longest OCR fragment over stale short reportGradeHintText", () => {
    if (!existsSync(GARBLED_OCR_PATH)) return;
    const garbled = readFileSync(GARBLED_OCR_PATH, "utf8");
    const source = buildReportGradeHintSource({
      reportGradeHintText: ".",
      rawTextSnippet: garbled.slice(0, 1200),
    });
    assert.ok(source.length > 500);
    assert.equal(parseReportGradeHints(source).color, "H");
    assert.equal(parseReportGradeHints(source).clarity, "VVS1");
  });
});

describe("toClientSafeInterpretationPayload image grade handoff", () => {
  it("emits interpretation.gradeHints when OCR hint text is recoverable but parsed fields omit color/clarity", () => {
    if (!existsSync(GARBLED_OCR_PATH)) return;
    const garbled = readFileSync(GARBLED_OCR_PATH, "utf8");
    const payload = toClientSafeInterpretationPayload(
      giaImageFinalizedFixture({
        reportGradeHintText: ".",
        rawTextSnippet: garbled.slice(0, 1200),
      }),
      undefined,
      { partial: true },
    );

    assert.equal(payload.gradeHints?.color, "H");
    assert.equal(payload.gradeHints?.clarity, "VVS1");
    assert.equal(
      needsPartialGradeReview({ gradeHints: payload.gradeHints }),
      false,
    );
    assert.ok((payload.metadata.reportTextHint?.length ?? 0) > 500);
  });

  it("replays production-style payload when only combined hint text is on finalized output", () => {
    if (!existsSync(GARBLED_OCR_PATH)) return;
    const garbled = readFileSync(GARBLED_OCR_PATH, "utf8").slice(0, 2297);
    const payload = toClientSafeInterpretationPayload(
      giaImageFinalizedFixture({
        reportGradeHintText: garbled,
        rawTextSnippet: garbled.slice(0, 1200),
      }),
      undefined,
      { partial: true },
    );

    assert.equal(payload.gradeHints?.color, "H");
    assert.equal(payload.gradeHints?.clarity, "VVS1");
    assert.equal(
      needsPartialGradeReview({ gradeHints: payload.gradeHints }),
      false,
    );
  });
});
