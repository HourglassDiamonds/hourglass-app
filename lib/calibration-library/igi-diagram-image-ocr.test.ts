import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "./fields";
import { LG773657228_PDF_TEXT_ORDER } from "./fixtures/lg773657228";
import {
  detectIgiDiagramLowerGirdleCandidate,
  shouldRunIgiDiagramImageOcr,
} from "./parsers/igi/igi-diagram-image-ocr";

describe("IGI diagram OCR gate", () => {
  it("triggers when star and girdle missing on IGI text", () => {
    const fields = emptyReportFields();
    fields.tablePercent = "59";
    fields.crownAngle = "34.1";
    fields.pavilionAngle = "40.8";
    const gate = shouldRunIgiDiagramImageOcr(fields, LG773657228_PDF_TEXT_ORDER, {
      parserType: "igi-standard",
      lab: "IGI",
    });
    assert.equal(gate.run, true);
  });

  it("stores lower-girdle candidate without mapping to lowerHalfPercent", () => {
    const candidate = detectIgiDiagramLowerGirdleCandidate(
      "59% 34.1° 40.8° 43% 14%",
      "59",
    );
    assert.equal(candidate, "43");
  });
});
