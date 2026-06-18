import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { extractTextFromDocument } from "./document-extract";
import { runCalibrationUploadExtraction } from "./extract-upload-pipeline";
import { classifyFinalized } from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import { parseReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";

const PDF_CANDIDATES = [
  "C:/Users/justi/OneDrive/Desktop/353306143.pdf",
  "data/light-performance-calibration/anchor-pdfs/GCAL-LG353306143.pdf",
  "data/light-performance-calibration/validation-reports/GCAL-LG353306143.pdf",
];

function resolvePdfPath(): string | null {
  for (const path of PDF_CANDIDATES) {
    if (existsSync(path)) return path;
  }
  return null;
}

const pdfPath = resolvePdfPath();
if (!pdfPath) {
  describe("GCAL 8X LG353306143 image-only PDF regression", () => {
    it("skipped — anchor PDF not found", () => {
      assert.ok(true);
    });
  });
} else {
  describe("GCAL 8X LG353306143 image-only PDF regression", () => {
    const bytes = readFileSync(pdfPath);

    it("client document-extract uses certificate probe without full-page OCR", async () => {
      const doc = await extractTextFromDocument(bytes, "application/pdf", {
        mode: "client",
      });
      assert.equal(doc.pdfTextLayerLength, 0);
      assert.equal(doc.gcalImageOnlyPdf, true);
      assert.match(doc.text, /\bGCAL\s+LG353306143\b/i);
      assert.equal(doc.method, "scoped-ocr");
      assert.match(
        doc.notices.join(" "),
        /certificate probe matched/i,
      );
    });

    it("client pipeline no longer hard-fails image-only GCAL 8X PDF", async () => {
      const result = await runCalibrationUploadExtraction({
        bytes,
        mime: "application/pdf",
        mode: "client",
      });

      assert.equal(result.parserType, "gcal-8x");
      assert.equal(result.gcalImageOnlyPdf, true);
      assert.equal(result.pdfTextLayerLength, 0);

      const decision = classifyFinalized(result);
      assert.notEqual(decision.tier, "failure");
      assert.equal(decision.useful, true);

      assert.equal(result.fields.carat.trim(), "3.24");
      assert.ok(result.fields.tablePercent.trim(), "expected table from region OCR");
      assert.ok(result.fields.depthPercent.trim(), "expected depth from region OCR");

      const hints = parseReportGradeHints(result.reportGradeHintText ?? "");
      assert.equal(hints.color, "E");
      assert.equal(hints.clarity, "VVS2");
    });
  });
}
