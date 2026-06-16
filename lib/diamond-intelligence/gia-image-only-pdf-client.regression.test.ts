import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { extractTextFromDocument } from "@/lib/calibration-library/document-extract";
import { interpretUploadedReport } from "@/lib/diamond-intelligence/interpret-uploaded-report";

const PDF_PATH = "data/diamond-intelligence/debug/7543453672-prod.pdf";

if (existsSync(PDF_PATH)) {
  describe("GIA image-only facsimile PDF client extract (7543453672)", () => {
    it("runs full-page OCR when PDF text layer is empty", async () => {
      const bytes = readFileSync(PDF_PATH);
      const doc = await extractTextFromDocument(bytes, "application/pdf", {
        mode: "client",
      });

      assert.equal(doc.pdfTextLayerLength, 0);
      assert.equal(doc.ocrAttempted, true);
      assert.ok(doc.text.length > 0, "expected OCR text");
      assert.match(doc.text, /facsimile/i);
      assert.match(doc.text, /GIA/i);
      assert.equal(doc.gcalImageOnlyPdf, false);
    });

    it("does not hard-fail interpret — at least partial with extracted fields", async () => {
      const bytes = readFileSync(PDF_PATH);
      const result = await interpretUploadedReport({
        bytes,
        mime: "application/pdf",
        sourceFilename: "7543453672.pdf",
      });

      assert.equal(result.ok, true, result.ok ? "" : result.error);
      assert.notEqual(result.decision.tier, "failure");
      assert.equal(result.decision.useful, true);
      assert.ok(
        ["partial", "full"].includes(result.decision.tier),
        `tier=${result.decision.tier}`,
      );
      assert.ok(
        (result.finalized.extractedCharCount ?? 0) > 0 ||
          result.finalized.rawTextSnippet.trim().length > 0,
      );
      assert.notEqual(result.finalized.metadata.lab, "OTHER");
    });
  });
}
