import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  shouldRunGiaGradingPanelImageOcr,
} from "@/lib/calibration-library/parsers/gia/gia-facsimile-image-ocr";
import { interpretUploadedReport } from "@/lib/diamond-intelligence/interpret-uploaded-report";
import { needsPartialGradeReview } from "@/app/diamond-intelligence/components/v3-presentation";

const GIA7496507350_GARBLED_FULL_PAGE = readFileSync(
  "data/diamond-intelligence/debug/7496507350-jpg-ocr.txt",
  "utf8",
);

describe("shouldRunGiaGradingPanelImageOcr", () => {
  it("skips when garbled image text already repairs to usable grades", () => {
    const gate = shouldRunGiaGradingPanelImageOcr({
      combinedText: GIA7496507350_GARBLED_FULL_PAGE,
      gradeHintText: GIA7496507350_GARBLED_FULL_PAGE,
      opts: { lab: "GIA", parserType: "gia-modern" },
    });
    assert.equal(gate.run, false);
    assert.match(gate.reason, /already-parsed/i);
  });

  it("runs for LGDR image context when grades are still missing", () => {
    const gate = shouldRunGiaGradingPanelImageOcr({
      combinedText:
        "LABORATORY-GROWN DIAMOND REPORT\nLABORATORY-GROWN DIAMOND SPECIFICATIONS*\nCarat Weight 2.42 carat",
      gradeHintText:
        "LABORATORY-GROWN DIAMOND SPECIFICATIONS*\nCarat Weight 2.42 carat",
      opts: { lab: "GIA", parserType: "gia-modern" },
    });
    assert.equal(gate.run, true);
    assert.match(gate.reason, /missing-grade-hints/i);
  });

  it("skips when color and clarity already parse", () => {
    const gate = shouldRunGiaGradingPanelImageOcr({
      combinedText: `LGDR
LABORATORY-GROWN DIAMOND SPECIFICATIONS*
Color ................................ H
Clarity ........................... VVS1`,
      gradeHintText: `LGDR
Color ................................ H
Clarity ........................... VVS1`,
      opts: { lab: "GIA", parserType: "gia-modern" },
    });
    assert.equal(gate.run, false);
  });
});

const pngPath = "data/diamond-intelligence/debug/7496507350-page1.png";
if (existsSync(pngPath)) {
  describe("GIA 7496507350 image upload regression", () => {
    it("recovers H / VVS1 and skips partial grade review", async () => {
      const bytes = readFileSync(pngPath);
      const result = await interpretUploadedReport({
        bytes,
        mime: "image/png",
        sourceFilename: "7496507350-facsimile.png",
      });

      assert.equal(result.ok, true, result.ok ? "" : result.error);
      assert.equal(result.interpretation.gradeHints?.color, "H");
      assert.equal(result.interpretation.gradeHints?.clarity, "VVS1");
      assert.equal(
        needsPartialGradeReview({
          gradeHints: result.interpretation.gradeHints,
        }),
        false,
      );
    });
  });
}

const naturalFacsimileJpgPath =
  "data/diamond-intelligence/debug/F20F1F75-8839-4184-AAF4-8F58B97B292B.jpg";
if (existsSync(naturalFacsimileJpgPath)) {
  describe("Natural GIA facsimile JPG 4Cs (F20F1F75...)", () => {
    it("recovers H / VS2 without partial grade review", async () => {
      const bytes = readFileSync(naturalFacsimileJpgPath);
      const result = await interpretUploadedReport({
        bytes,
        mime: "image/jpeg",
        sourceFilename: "F20F1F75-facsimile.jpg",
      });

      assert.equal(result.ok, true, result.ok ? "" : result.error);
      assert.equal(result.interpretation.gradeHints?.color, "H");
      assert.equal(result.interpretation.gradeHints?.clarity, "VS2");
      assert.equal(
        needsPartialGradeReview({
          gradeHints: result.interpretation.gradeHints,
        }),
        false,
      );
    });
  });
}
