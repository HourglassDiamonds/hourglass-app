import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { needsGiaDiagramProportionOcrWait } from "./gia-diagram-proportion-wait";
import { GIA2527039693_FACSIMILE_PDF_TEXT } from "./fixtures/gia2527039693";
import { extractFieldsFromReportText } from "./extract-from-text";
import { deprioritizeNaturalFacsimileGradingScaleScatter } from "./parsers/gia/gia-facsimile-image-ocr";

const GIA7543453672_OCR = readFileSync(
  "data/diamond-intelligence/debug/7543453672-fullpage-ocr.txt",
  "utf8",
);

describe("needsGiaDiagramProportionOcrWait", () => {
  it("returns true for GIA facsimile text layer with grades but no core proportions", () => {
    assert.equal(
      needsGiaDiagramProportionOcrWait({
        fields: {
          shape: "Round Brilliant",
          carat: "2.03",
          cutGrade: "Excellent",
          polish: "Excellent",
          symmetry: "Excellent",
          tablePercent: "",
          depthPercent: "",
          crownAngle: "",
          pavilionAngle: "",
        },
        combinedText: GIA2527039693_FACSIMILE_PDF_TEXT,
        parserType: "gia-modern",
        lab: "GIA",
      }),
      true,
    );
  });

  it("returns false when core proportions already present", () => {
    assert.equal(
      needsGiaDiagramProportionOcrWait({
        fields: {
          shape: "Round Brilliant",
          carat: "2.03",
          tablePercent: "57",
          depthPercent: "62.3",
          crownAngle: "36",
          pavilionAngle: "40.8",
        },
        combinedText: GIA2527039693_FACSIMILE_PDF_TEXT,
        parserType: "gia-modern",
        lab: "GIA",
      }),
      false,
    );
  });

  it("returns false for non-GIA reports", () => {
    assert.equal(
      needsGiaDiagramProportionOcrWait({
        fields: { shape: "Round", carat: "1.0" },
        combinedText: "GCAL report text",
        parserType: "gcal-sarine-4cs",
        lab: "GCAL",
      }),
      false,
    );
  });

  it("7543453672 — waits for diagram OCR with shape-only identity", () => {
    const parsed = extractFieldsFromReportText(GIA7543453672_OCR, {
      lab: "GIA",
      reportNumber: "7543453672",
      textMethod: "ocr",
    });
    deprioritizeNaturalFacsimileGradingScaleScatter(
      parsed.fields,
      GIA7543453672_OCR,
    );
    assert.equal(
      needsGiaDiagramProportionOcrWait({
        fields: parsed.fields,
        combinedText: GIA7543453672_OCR,
        parserType: parsed.parserType,
        lab: "GIA",
      }),
      true,
    );
  });
});
