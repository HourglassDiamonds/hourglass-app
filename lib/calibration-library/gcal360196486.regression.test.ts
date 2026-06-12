import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { extractFieldsFromReportText } from "./extract-from-text";
import { detectReportFamily } from "./parsers/router";
import { runCalibrationUploadExtraction } from "./extract-upload-pipeline";
import { parseReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";
import { assessReportCapability } from "@/lib/diamond-intelligence/report-capability";
import { presentClientInterpretationScore } from "@/lib/diamond-intelligence/client-score-present";
import { buildClientDiamondDecisionProfile } from "@/lib/diamond-intelligence/client-decision-profile";
import {
  isGcal8xReport,
  resolveGcal8xVisualTier,
} from "@/app/diamond-intelligence/components/v3-presentation";
import {
  GCAL360196486_EXPECTED,
  GCAL360196486_LIVE_OCR_SOUP,
  GCAL360196486_OCR_MULTILINE,
  GCAL360196486_REPORT_NUMBER,
} from "./fixtures/gcal360196486";

const DESKTOP_JPG = "C:/Users/justi/OneDrive/Desktop/GCAL360196486.jpg";

function assertGcal360196486Extraction(
  result: ReturnType<typeof extractFieldsFromReportText>,
) {
  const e = GCAL360196486_EXPECTED;
  assert.equal(result.metadata.lab, "GCAL");
  assert.equal(result.parserType, e.parserType);
  assert.equal(result.fields.shape, e.shape);
  assert.equal(result.fields.carat, e.carat);
  assert.match(result.fields.measurements ?? "", /7\.22.*7\.24.*4\.45.*mm/i);
  assert.equal(result.fields.fluorescence, e.fluorescence);
  assert.equal(result.fields.culet, e.culet);
  assert.equal(result.fields.pavilionAngle, e.pavilionAngle);
  assert.equal(result.fields.starLengthPercent, e.starLengthPercent);
  assert.equal(result.fields.lowerHalfPercent, e.lowerHalfPercent);
}

describe("GCAL 8X LG360196486 protection fixture", () => {
  it("routes to gcal-8x for multiline and live OCR layouts", () => {
    for (const text of [GCAL360196486_OCR_MULTILINE, GCAL360196486_LIVE_OCR_SOUP]) {
      const family = detectReportFamily(text, { lab: "GCAL" });
      assert.equal(family.parserType, "gcal-8x");
    }
  });

  it("parses structured multiline OCR with D / FL grades", () => {
    const hints = parseReportGradeHints(GCAL360196486_OCR_MULTILINE);
    assert.equal(hints.color, GCAL360196486_EXPECTED.color);
    assert.equal(hints.clarity, GCAL360196486_EXPECTED.clarity);

    assertGcal360196486Extraction(
      extractFieldsFromReportText(GCAL360196486_OCR_MULTILINE, {
        lab: "GCAL",
        textMethod: "ocr",
        reportNumber: GCAL360196486_REPORT_NUMBER,
      }),
    );
  });

  it("parses live OCR soup without marketing bleed", () => {
    const hints = parseReportGradeHints(GCAL360196486_LIVE_OCR_SOUP);
    assert.equal(hints.color, "D");
    assert.equal(hints.clarity, "FL");

    assertGcal360196486Extraction(
      extractFieldsFromReportText(GCAL360196486_LIVE_OCR_SOUP, {
        lab: "GCAL",
        textMethod: "ocr",
        reportNumber: GCAL360196486_REPORT_NUMBER,
      }),
    );
  });

  it("detects GCAL 8X display framework and Exceptional visual tier", () => {
    const extracted = extractFieldsFromReportText(GCAL360196486_OCR_MULTILINE, {
      lab: "GCAL",
      textMethod: "ocr",
      reportNumber: GCAL360196486_REPORT_NUMBER,
    });
    const hints = parseReportGradeHints(GCAL360196486_OCR_MULTILINE);
    const cap = assessReportCapability({ fields: extracted.fields });
    const cs = presentClientInterpretationScore(
      extracted.fields,
      cap.interpretationLevel,
    );
    const displayScore =
      cs.eligible && cs.overall != null ? cs.overall : null;

    assert.equal(
      isGcal8xReport(
        {
          lab: "GCAL",
          reportFormat: "gcal-8x",
          parserFamily: "gcal-8x",
          reportTextHint: GCAL360196486_OCR_MULTILINE,
        },
        extracted.fields,
      ),
      true,
    );

    const gcal8xTier = resolveGcal8xVisualTier(displayScore, hints.clarity);
    assert.ok(
      gcal8xTier === "Rare" || gcal8xTier === "Exceptional",
      `expected 8X tier, got ${gcal8xTier}`,
    );
    assert.equal(gcal8xTier, GCAL360196486_EXPECTED.gcal8xTier);

    const profile = buildClientDiamondDecisionProfile({
      fields: extracted.fields,
      metadata: {
        lab: "GCAL",
        reportNumber: GCAL360196486_REPORT_NUMBER,
        stoneType: "lab-grown",
      },
      capability: {
        interpretationLevel: cap.interpretationLevel,
        canRunClientInterpretation: cap.canRunClientInterpretation,
        canShowOpticalProfile: cap.canShowOpticalProfile,
        canShowPerformanceScore: cap.canShowPerformanceScore,
        canShowDeepOptical: cap.canShowDeepOptical,
      },
      rawScore: displayScore,
      gradeHints: hints,
    });

    assert.notEqual(profile.overallRecommendation.band, "Not Recommended");
    assert.notEqual(
      profile.purchasePersonality.label,
      "Outside Hourglass Standards",
    );
    assert.ok(gcal8xTier);
  });

  if (existsSync(DESKTOP_JPG)) {
    it("live Desktop JPG routes gcal-8x with D color and clarity", async () => {
      const bytes = readFileSync(DESKTOP_JPG);
      const result = await runCalibrationUploadExtraction({
        bytes,
        mime: "image/jpeg",
        lab: "GCAL",
        mode: "calibration",
        pipelineTimeoutMs: 120_000,
      });

      assert.equal(result.parserType, "gcal-8x");
      assert.equal(result.metadata?.lab, "GCAL");
      assert.equal(result.metadata?.reportNumber, GCAL360196486_REPORT_NUMBER);

      const hints = parseReportGradeHints(result.reportGradeHintText ?? "");
      assert.equal(hints.color, "D");
      assert.ok(hints.clarity);

      assert.equal(result.fields.shape, "Round Brilliant");
      assert.equal(result.fields.carat, "1.43");
    });
  }
});
