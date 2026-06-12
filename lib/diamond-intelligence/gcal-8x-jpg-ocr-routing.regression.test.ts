process.env.CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS ??= "15000";

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { needsPartialGradeReview } from "@/app/diamond-intelligence/components/v3-presentation";
import { parseReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";
import {
  GCAL360196486_OCR_MULTILINE,
  GCAL360196486_REPORT_NUMBER,
} from "@/lib/calibration-library/fixtures/gcal360196486";
import { extractFieldsFromReportText } from "@/lib/calibration-library/extract-from-text";

const DESKTOP_8X_JPGS = [
  {
    id: "LG360196394",
    path: "C:/Users/justi/OneDrive/Desktop/GCAL360196394.jpg",
    expectedColor: "D",
    expectedClarity: "FL",
  },
  {
    id: "LG360196486",
    path: "C:/Users/justi/OneDrive/Desktop/GCAL360196486.jpg",
    expectedColor: "D",
  },
] as const;

describe("GCAL 8X JPG region OCR routing", () => {
  it("parses repaired collapsed DFL header from grading panel OCR text", () => {
    const hints = parseReportGradeHints(
      "GCAL 360196394 RB 3.28 D FL\nOptical Brilliance",
    );
    assert.equal(hints.color, "D");
    assert.equal(hints.clarity, "FL");
  });

  it("LG360196486 fixture remains full-capable after routing changes", () => {
    const extracted = extractFieldsFromReportText(GCAL360196486_OCR_MULTILINE, {
      lab: "GCAL",
      textMethod: "ocr",
      reportNumber: GCAL360196486_REPORT_NUMBER,
    });
    const hints = parseReportGradeHints(GCAL360196486_OCR_MULTILINE);
    assert.equal(hints.color, "D");
    assert.equal(hints.clarity, "FL");
    assert.equal(extracted.parserType, "gcal-8x");
    assert.equal(
      needsPartialGradeReview({ gradeHints: hints, canShowScore: true }),
      false,
    );
  });

  for (const spec of DESKTOP_8X_JPGS) {
    if (!existsSync(spec.path)) continue;

    it(`${spec.id} live JPG uses region OCR for color and clarity`, async () => {
      const { runCalibrationUploadExtraction } = await import(
        "@/lib/calibration-library/extract-upload-pipeline"
      );
      const bytes = readFileSync(spec.path);
      const result = await runCalibrationUploadExtraction({
        bytes,
        mime: "image/jpeg",
        lab: "GCAL",
        mode: "client",
      });

      assert.equal(result.parserType, "gcal-8x", spec.id);
      const hints = parseReportGradeHints(result.reportGradeHintText ?? "");
      assert.equal(hints.color, spec.expectedColor, `${spec.id} color`);
      if (spec.expectedClarity) {
        assert.equal(hints.clarity, spec.expectedClarity, `${spec.id} clarity`);
      }
      assert.equal(
        needsPartialGradeReview({ gradeHints: hints, canShowScore: false }),
        false,
        `${spec.id} partial grade gate`,
      );
    });
  }
});
