import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGiaDiagramFieldsFromBands } from "@/lib/calibration-library/parsers/gia/gia-diagram-extraction";
import { LGDR2536297567_DIAGRAM_BANDS } from "@/lib/calibration-library/fixtures/lgdr2536297567-diagram-bands";

function fieldMap(bands: typeof LGDR2536297567_DIAGRAM_BANDS) {
  const rows = parseGiaDiagramFieldsFromBands(bands, "GIA_LGDR_DOSSIER");
  return Object.fromEntries(rows.map((r) => [r.field, r.parsedValue]));
}

describe("GIA LGDR diagram field parsing — 2536297567 band OCR", () => {
  it("recovers depth, girdle, and culet when caption bands only capture profile label", () => {
    const f = fieldMap(LGDR2536297567_DIAGRAM_BANDS);

    assert.equal(f.tablePercent, "59%");
    assert.equal(f.depthPercent, "61.5%");
    assert.equal(f.crownAngle, "35.5°");
    assert.equal(f.pavilionAngle, "41°");
    assert.equal(f.culet, "None");
    assert.ok(f.girdle, "expected girdle width descriptor");
  });
});
