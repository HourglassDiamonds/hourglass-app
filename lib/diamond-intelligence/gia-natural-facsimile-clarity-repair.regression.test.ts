import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { interpretUploadedReport } from "@/lib/diamond-intelligence/interpret-uploaded-report";
import { resolveHourglassClarityPolicy } from "@/lib/diamond-intelligence/hourglass-clarity-policy";

const PDF_1232835133 =
  process.env.GIA_1232835133_PDF ??
  "C:/Users/justi/OneDrive/Desktop/1232835133.pdf";

const PDF_2504983895 =
  process.env.GIA_2504983895_PDF ??
  "C:/Users/justi/OneDrive/Desktop/2504983895.pdf";

if (existsSync(PDF_1232835133)) {
  describe("GIA natural facsimile 1232835133 clarity repair", () => {
    it("parses SI1 and S–T color range without I2 misclassification", async () => {
      process.env.CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS ??= "60000";
      const bytes = readFileSync(PDF_1232835133);
      const result = await interpretUploadedReport({
        bytes,
        mime: "application/pdf",
        sourceFilename: "1232835133.pdf",
      });

      assert.equal(result.ok, true, result.error);
      assert.equal(result.interpretation.gradeHints?.clarity, "SI1");
      assert.match(
        result.interpretation.gradeHints?.color ?? "",
        /S to T Range, Light Brown/i,
      );
      assert.equal(
        resolveHourglassClarityPolicy(result.interpretation.gradeHints?.clarity)
          .isExcluded,
        false,
      );
    });
  });
}

if (existsSync(PDF_2504983895)) {
  describe("GIA natural facsimile 2504983895 I1 regression", () => {
    it("still parses I1 clarity from natural facsimile OCR", async () => {
      process.env.CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS ??= "60000";
      const bytes = readFileSync(PDF_2504983895);
      const result = await interpretUploadedReport({
        bytes,
        mime: "application/pdf",
        sourceFilename: "2504983895.pdf",
      });

      assert.equal(result.ok, true, result.error);
      assert.equal(result.interpretation.gradeHints?.clarity, "I1");
    });
  });
}
