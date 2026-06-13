// Live JPG OCR can exceed the default 8s doc-extract budget on cold worker startup.
process.env.CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS ??= "15000";

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { detectReportFamily } from "@/lib/calibration-library/parsers/router";
import { extractFieldsFromReportText } from "@/lib/calibration-library/extract-from-text";
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
  GCAL360796191_DIAGRAM_OCR,
} from "@/lib/calibration-library/fixtures/gcal360796191";
import { extractGcalSarineProportionIslands } from "@/lib/calibration-library/gcal-sarine-4cs";
import { shouldRunGcalSarine4CsGradingPanelOcr } from "@/lib/calibration-library/parsers/gcal/gcal-sarine-image-ocr";
import {
  needsPartialGradeReview,
} from "@/app/diamond-intelligence/components/v3-presentation";
import { parseReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";

const DESKTOP_JPGS = [
  {
    id: "LG341066155",
    path: "C:/Users/justi/OneDrive/Desktop/GCAL341066155.jpg",
    requireClarity: true,
    requireProportions: true,
    requireCrownAngle: true,
    requirePavilionAngle: true,
  },
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
  it("skips redundant grading panel OCR when uploaded image already has 4Cs", () => {
    assert.equal(
      shouldRunGcalSarine4CsGradingPanelOcr({
        parserType: "gcal-sarine-4cs",
        imageUpload: true,
        combinedText: "Color G\nClarity VS1",
        gradeHintText: "Color G\nClarity VS1",
      }),
      false,
    );
    assert.equal(
      shouldRunGcalSarine4CsGradingPanelOcr({
        parserType: "gcal-sarine-4cs",
        imageUpload: true,
        combinedText: "marketing only",
        gradeHintText: "",
      }),
      true,
    );
  });

  it("diagram OCR fixture assigns crown and pavilion from collapsed degree tokens", () => {
    const islands = extractGcalSarineProportionIslands(GCAL360796191_DIAGRAM_OCR);
    assert.equal(islands.crownAngle, "34");
    assert.equal(islands.pavilionAngle, "40.8");
  });

  it("repairs stacked 0/3 crown digits when pavilion 41.0 is present", () => {
    const islands = extractGcalSarineProportionIslands("41.0°\n0\n3\n");
    assert.equal(islands.crownAngle, "34");
    assert.equal(islands.pavilionAngle, "41");
  });

  it("repairs bare 340/410 diagram tokens without degree symbols", () => {
    const islands = extractGcalSarineProportionIslands(
      "Table 59% Depth 60.8% Crown 340 Pavilion 410",
    );
    assert.equal(islands.crownAngle, "34");
    assert.equal(islands.pavilionAngle, "41");
  });

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

      if (spec.requireProportions) {
        assert.ok(result.fields.tablePercent.trim(), `${spec.id} table`);
        assert.ok(result.fields.depthPercent.trim(), `${spec.id} depth`);
        if ("requirePavilionAngle" in spec && spec.requirePavilionAngle) {
          assert.ok(result.fields.pavilionAngle.trim(), `${spec.id} pavilion`);
        }
        if ("requireCrownAngle" in spec && spec.requireCrownAngle) {
          assert.ok(result.fields.crownAngle.trim(), `${spec.id} crown`);
        }
      }
    });
  }
});
