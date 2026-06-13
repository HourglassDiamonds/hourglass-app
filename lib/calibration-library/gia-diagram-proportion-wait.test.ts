import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { needsGiaDiagramProportionOcrWait } from "./gia-diagram-proportion-wait";
import { GIA2527039693_FACSIMILE_PDF_TEXT } from "./fixtures/gia2527039693";

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
});
