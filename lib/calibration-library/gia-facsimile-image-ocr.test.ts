import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "./fields";
import { GIA2527039693_FACSIMILE_PDF_TEXT } from "./fixtures/gia2527039693";
import {
  shouldRunGiaFacsimileDiagramImageOcr,
  shouldRunGiaGradingPanelImageOcr,
} from "./parsers/gia/gia-facsimile-image-ocr";

describe("GIA facsimile diagram OCR gate", () => {
  it("triggers for facsimile text when pavilion and girdle missing", () => {
    const fields = emptyReportFields();
    fields.crownAngle = "36.5";
    fields.tablePercent = "56";
    const gate = shouldRunGiaFacsimileDiagramImageOcr(
      fields,
      GIA2527039693_FACSIMILE_PDF_TEXT,
      { parserType: "gia-modern", lab: "GIA" },
    );
    assert.equal(gate.run, true);
    assert.match(gate.reason, /pavilion|girdle|facsimile/i);
  });

  it("does not trigger for non-GIA", () => {
    const fields = emptyReportFields();
    const gate = shouldRunGiaFacsimileDiagramImageOcr(fields, "IGI LG123", {
      parserType: "igi-standard",
      lab: "IGI",
    });
    assert.equal(gate.run, false);
  });

  it("does not trigger when all core diagram fields populated", () => {
    const fields = emptyReportFields();
    fields.tablePercent = "56";
    fields.depthPercent = "63.1";
    fields.crownAngle = "36.5";
    fields.pavilionAngle = "40.8";
    fields.lowerHalfPercent = "75";
    fields.starLengthPercent = "50";
    fields.girdle = "Medium - Slightly Thick (Faceted) 3.5%";
    fields.culet = "None";
    const gate = shouldRunGiaFacsimileDiagramImageOcr(
      fields,
      GIA2527039693_FACSIMILE_PDF_TEXT,
      { parserType: "gia-modern", lab: "GIA" },
    );
    assert.equal(gate.run, false);
  });

  it("triggers when pavilion and girdle populated but other diagram fields missing", () => {
    const fields = emptyReportFields();
    fields.pavilionAngle = "40.8";
    fields.girdle = "Medium - Slightly Thick (Faceted) 3.5%";
    const gate = shouldRunGiaFacsimileDiagramImageOcr(
      fields,
      GIA2527039693_FACSIMILE_PDF_TEXT,
      { parserType: "gia-modern", lab: "GIA" },
    );
    assert.equal(gate.run, true);
  });
});

describe("GIA image grading panel OCR gate", () => {
  it("runs for LGDR image upload when grades are missing", () => {
    const gate = shouldRunGiaGradingPanelImageOcr({
      combinedText:
        "LABORATORY-GROWN DIAMOND REPORT\nLABORATORY-GROWN DIAMOND SPECIFICATIONS*\nCarat Weight 2.42",
      gradeHintText: "LABORATORY-GROWN DIAMOND SPECIFICATIONS*\nCarat Weight 2.42",
      opts: { lab: "GIA", parserType: "gia-modern" },
    });
    assert.equal(gate.run, true);
  });
});
