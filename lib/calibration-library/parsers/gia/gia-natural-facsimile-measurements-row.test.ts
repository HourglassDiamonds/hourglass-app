import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  applyNaturalFacsimileMeasurementsRowFromText,
  extractNaturalFacsimileMeasurementsRowWindow,
  isNaturalFacsimileScaleBleedCrownAngle,
  parseNaturalFacsimileCrownAngleFromMeasurementsRow,
  parseNaturalFacsimileGirdleFromMeasurementsRow,
} from "./gia-natural-facsimile-measurements-row";
import { isNaturalGiaFacsimileContext } from "./gia-facsimile-image-ocr";
import { emptyReportFields } from "../../fields";

const GIA7543453672_OCR = readFileSync(
  "data/diamond-intelligence/debug/7543453672-fullpage-ocr.txt",
  "utf8",
);

describe("natural GIA facsimile measurements-row supplement", () => {
  it("7543453672 — recovers crown 36.0 from 14.5% / 36.0 g stack", () => {
    const crown = parseNaturalFacsimileCrownAngleFromMeasurementsRow(
      GIA7543453672_OCR,
    );
    assert.equal(crown, "36.0");
  });

  it("7543453672 — recovers girdle from slightly / faceted context", () => {
    const girdle = parseNaturalFacsimileGirdleFromMeasurementsRow(
      GIA7543453672_OCR,
    );
    assert.ok(girdle, "expected girdle from measurements row");
    assert.match(girdle!, /slightly thick/i);
    assert.match(girdle!, /faceted/i);
  });

  it("7543453672 — replaces false diagram crown 26 with measurements crown", () => {
    const fields = emptyReportFields();
    fields.crownAngle = "26";
    const applied: string[] = [];
    applyNaturalFacsimileMeasurementsRowFromText(
      GIA7543453672_OCR,
      fields,
      (key, value) => {
        applied.push(`${key}=${value}`);
      },
    );
    assert.equal(fields.crownAngle, "36.0");
    assert.ok(applied.some((a) => a.startsWith("crownAngle=36")));
  });

  it("rejects scale-adjacent crown 26 from FLAWLESS / 26-0 band OCR", () => {
    assert.equal(
      isNaturalFacsimileScaleBleedCrownAngle(
        "26-0 FLAWLESS COLOR SCALE",
        26,
      ),
      true,
    );
    assert.equal(
      isNaturalFacsimileScaleBleedCrownAngle("36.0° crown diagram", 36),
      false,
    );
  });

  it("extracts measurements row window ending before GRADING RESULTS", () => {
    const window = extractNaturalFacsimileMeasurementsRowWindow(
      GIA7543453672_OCR,
    );
    assert.match(window, /measurements/i);
    assert.match(window, /14\.5%/);
    assert.match(window, /36\.0/);
    assert.doesNotMatch(window, /grading\s+results/i);
  });

  it("LGDR context — production pipeline skips measurements-row supplement", () => {
    const lgdrText =
      "GIA LABORATORY-GROWN DIAMOND REPORT LGDR\nMeasurements 7.00 mm\nslightly 14.5% 36.0";
    assert.equal(isNaturalGiaFacsimileContext(lgdrText), false);
    const fields = emptyReportFields();
    fields.crownAngle = "26";
    if (isNaturalGiaFacsimileContext(lgdrText)) {
      applyNaturalFacsimileMeasurementsRowFromText(lgdrText, fields, () => {});
    }
    assert.equal(
      fields.crownAngle,
      "26",
      "LGDR must not enter natural facsimile measurements-row path",
    );
  });
});
