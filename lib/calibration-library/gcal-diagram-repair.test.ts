import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFieldsFromReportText } from "./extract-from-text";
import {
  GCAL353466126_COLLAPSED_DIAGRAM_OCR,
  GCAL353466126_EXPECTED,
  GCAL353466126_REPORT_NUMBER,
} from "./fixtures/gcal353466126";
import {
  collectGcal8xProportionNumericCandidates,
  extractGcal8xProportionIslands,
  prepareGcal8xProportionDiagramText,
  repairGcalDiagramNumericSoup,
} from "./gcal-8x";

describe("GCAL diagram numeric repair", () => {
  it("repairs collapsed degree and percent OCR soup", () => {
    const repaired = repairGcalDiagramNumericSoup(
      "345° 408° 611% 145mm 430mm 35mm 147mm 928mm",
    );
    assert.match(repaired, /34\.5°/);
    assert.match(repaired, /40\.8°/);
    assert.match(repaired, /61\.1%/);
    assert.match(repaired, /14\.5%/);
    assert.match(repaired, /43\.0%/);
    assert.match(repaired, /3\.5%/);
  });

  it("preserves stone measurements while repairing split decimals", () => {
    const repaired = prepareGcal8xProportionDiagramText(
      "Measurements 7.98-8.01 x 4 88mm 0.02mm 7.99mm 345° 35mm",
    );
    assert.match(repaired, /7\.98-8\.01 x 4\.88mm/);
    assert.match(repaired, /0\.02mm/);
    assert.match(repaired, /7\.99mm/);
    assert.match(repaired, /34\.5°/);
    assert.match(repaired, /3\.5%/);
  });

  it("populates proportionNumericCandidates.degrees after repair", () => {
    const candidates = collectGcal8xProportionNumericCandidates(
      GCAL353466126_COLLAPSED_DIAGRAM_OCR,
    );
    assert.ok(candidates.degrees.includes(34.5));
    assert.ok(candidates.degrees.includes(40.8));
    assert.ok(candidates.percents.includes(61.1));
    assert.ok(candidates.percents.includes(14.5));
    assert.ok(candidates.percents.includes(43));
    assert.ok(candidates.percents.includes(3.5));
  });

  it("extracts depth and angles from collapsed diagram fixture", () => {
    const islands = extractGcal8xProportionIslands(
      GCAL353466126_COLLAPSED_DIAGRAM_OCR,
    );
    const e = GCAL353466126_EXPECTED;
    assert.equal(islands.depthPercent, e.depthPercent);
    assert.equal(islands.crownAngle, e.crownAngle);
    assert.equal(islands.pavilionAngle, e.pavilionAngle);
    assert.equal(islands.girdleThicknessPercent, e.girdleThicknessPercent);
    assert.equal(islands.pavilionDepthPercent, e.pavilionDepthPercent);
  });

  it("parses full report with collapsed diagram OCR via gcal-8x", () => {
    const text = `
GCAL 8X
GCAL LG353466126 RB 1.91
Shape and Cutting Style Round Brilliant
Measurements 7.98-8.01 x 4.88mm
Fluorescence None
Girdle Medium Faceted
Culet None
${GCAL353466126_COLLAPSED_DIAGRAM_OCR}
Cut Grade Excellent
Polish Excellent
Symmetry Excellent
`;
    const result = extractFieldsFromReportText(text, {
      lab: "GCAL",
      textMethod: "ocr",
      reportNumber: GCAL353466126_REPORT_NUMBER,
    });
    const e = GCAL353466126_EXPECTED;
    assert.equal(result.fields.depthPercent, e.depthPercent);
    assert.equal(result.fields.crownAngle, e.crownAngle);
    assert.equal(result.fields.pavilionAngle, e.pavilionAngle);
    assert.equal(result.gcalInternal?.girdleThicknessPercent, e.girdleThicknessPercent);
    assert.equal(result.gcalInternal?.pavilionDepthPercent, e.pavilionDepthPercent);
  });
});
