import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { detectReportFamily } from "@/lib/calibration-library/parsers/router";
import { extractFieldsFromReportText } from "@/lib/calibration-library/extract-from-text";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import {
  hasExplicitGcalSarineReportHeader,
  hasExplicitIgiReportHeader,
} from "@/lib/calibration-library/lab-parsers";
import {
  GCAL_SARINE_LG340946327_EXPECTED,
  GCAL_SARINE_LG340946327_OCR_TEXT,
  GCAL_SARINE_LG340946327_REPORT_NUMBER,
} from "@/lib/calibration-library/fixtures/gcal-sarine-lg340946327";
import {
  GCAL_SARINE_LG340946323_EXPECTED,
  GCAL_SARINE_LG340946323_OCR_TEXT,
} from "@/lib/calibration-library/fixtures/gcal-sarine-lg340946323";
import {
  GCAL_SARINE_LG353456516_EXPECTED,
  GCAL_SARINE_LG353456516_OCR_GARBLED_CLARITY,
  GCAL_SARINE_LG353456516_OCR_TEXT,
} from "@/lib/calibration-library/fixtures/gcal-sarine-lg353456516";
import {
  needsPartialGradeReview,
} from "@/app/diamond-intelligence/components/v3-presentation";
import { parseReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";

const DESKTOP_JPGS = [
  {
    id: "LG340946327",
    path: "C:/Users/justi/OneDrive/Desktop/GCAL340946327.jpg",
    requireClarity: true,
  },
  {
    id: "LG340946323",
    path: "C:/Users/justi/OneDrive/Desktop/GCAL340946323.jpg",
    requireClarity: true,
  },
  {
    id: "LG353456516",
    path: "C:/Users/justi/OneDrive/Desktop/GCAL353456516.jpg",
    requireClarity: true,
  },
] as const;

describe("GCAL Sarine JPG QA regression (LG340946327/323/516)", () => {
  it("LG340946327 OCR fixture is not misclassified as IGI", () => {
    assert.equal(
      hasExplicitIgiReportHeader(GCAL_SARINE_LG340946327_OCR_TEXT),
      false,
    );
    assert.equal(
      hasExplicitGcalSarineReportHeader(GCAL_SARINE_LG340946327_OCR_TEXT),
      true,
    );
  });

  it("LG340946327 OCR fixture routes to gcal-sarine-4cs", () => {
    const family = detectReportFamily(GCAL_SARINE_LG340946327_OCR_TEXT, {
      lab: "GCAL",
    });
    assert.equal(family.lab, "GCAL");
    assert.equal(family.parserType, "gcal-sarine-4cs");
  });

  it("LG340946327 OCR fixture extracts color, clarity, cut, and proportions", () => {
    const hints = parseReportGradeHints(GCAL_SARINE_LG340946327_OCR_TEXT);
    assert.equal(hints.color, GCAL_SARINE_LG340946327_EXPECTED.color);
    assert.equal(hints.clarity, GCAL_SARINE_LG340946327_EXPECTED.clarity);

    assert.equal(
      needsPartialGradeReview({ gradeHints: hints, canShowScore: false }),
      false,
    );

    const extracted = extractFieldsFromReportText(
      GCAL_SARINE_LG340946327_OCR_TEXT,
      {
        lab: "GCAL",
        textMethod: "ocr",
        reportNumber: GCAL_SARINE_LG340946327_REPORT_NUMBER,
      },
    );
    assert.equal(extracted.parserType, "gcal-sarine-4cs");
    assert.equal(extracted.fields.shape, GCAL_SARINE_LG340946327_EXPECTED.shape);
    assert.equal(extracted.fields.carat, GCAL_SARINE_LG340946327_EXPECTED.carat);
    assert.equal(
      extracted.fields.tablePercent,
      GCAL_SARINE_LG340946327_EXPECTED.tablePercent,
    );
    assert.equal(
      extracted.fields.depthPercent,
      GCAL_SARINE_LG340946327_EXPECTED.depthPercent,
    );
    assert.equal(
      extracted.fields.cutGrade,
      GCAL_SARINE_LG340946327_EXPECTED.cutGrade,
    );
  });

  for (const fixture of [
    {
      id: "LG340946323",
      text: GCAL_SARINE_LG340946323_OCR_TEXT,
      expected: GCAL_SARINE_LG340946323_EXPECTED,
    },
    {
      id: "LG353456516",
      text: GCAL_SARINE_LG353456516_OCR_TEXT,
      expected: GCAL_SARINE_LG353456516_EXPECTED,
    },
    {
      id: "LG353456516-garbled",
      text: GCAL_SARINE_LG353456516_OCR_GARBLED_CLARITY,
      expected: GCAL_SARINE_LG353456516_EXPECTED,
    },
  ] as const) {
    it(`${fixture.id} OCR fixture extracts color and clarity without partial gate`, () => {
      const hints = parseReportGradeHints(fixture.text);
      assert.equal(hints.color, fixture.expected.color, fixture.id);
      assert.equal(hints.clarity, fixture.expected.clarity, fixture.id);
      assert.equal(
        needsPartialGradeReview({ gradeHints: hints, canShowScore: false }),
        false,
        fixture.id,
      );
    });
  }

  for (const spec of DESKTOP_JPGS) {
    if (!existsSync(spec.path)) continue;

    it(`${spec.id} live JPG upload routes GCAL Sarine and skips partial grade review`, async () => {
      const bytes = readFileSync(spec.path);
      const result = await runCalibrationUploadExtraction({
        bytes,
        mime: "image/jpeg",
        lab: "GCAL",
        mode: "client",
      });

      assert.notEqual(
        result.parserType,
        "igi-standard",
        `${spec.id} must not route to IGI`,
      );
      assert.equal(result.metadata?.lab, "GCAL", spec.id);
      assert.equal(result.parserType, "gcal-sarine-4cs", spec.id);

      const hintText = result.reportGradeHintText ?? "";
      const hints = parseReportGradeHints(hintText);
      assert.ok(hints.color, `${spec.id} color`);
      if (spec.requireClarity) {
        assert.ok(hints.clarity, `${spec.id} clarity`);
        assert.equal(
          needsPartialGradeReview({ gradeHints: hints, canShowScore: false }),
          false,
          `${spec.id} partial grade gate`,
        );
      }
    });
  }
});
