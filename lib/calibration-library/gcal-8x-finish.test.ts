import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "./fields";
import {
  applyGcal8xFinishGrades,
  extractGcal8xFinishGrades,
  extractGcal8xFinishGradesWithAudit,
} from "./parsers/gcal/gcal-finish";
import { extractGcal8xProportionGirdle } from "./gcal-8x";

describe("GCAL 8X finish region grades", () => {
  const finishOcr = `
1. Polish P F G VG EX Excellent
2. External Symmetry P F G VG EX Excellent
3. Proportions P F G VG EX Excellent
`;

  it("maps polish, external symmetry, and proportions rows", () => {
    const grades = extractGcal8xFinishGrades(finishOcr);
    assert.equal(grades.polish, "Excellent");
    assert.equal(grades.symmetry, "Excellent");
    assert.equal(grades.cutGrade, "Excellent");
  });

  it("does not overwrite populated finish fields", () => {
    const fields = emptyReportFields();
    fields.polish = "Very Good";
    const grades = extractGcal8xFinishGrades(finishOcr);
    applyGcal8xFinishGrades(grades, fields, (key, value) => {
      fields[key] = value;
    });
    assert.equal(fields.polish, "Very Good");
    assert.equal(fields.symmetry, "Excellent");
    assert.equal(fields.cutGrade, "Excellent");
  });

  it("whitelists grades only", () => {
    const grades = extractGcal8xFinishGrades(
      "1. Polish ZZZ 2. External Symmetry EX",
    );
    assert.equal(grades.polish, undefined);
    assert.equal(grades.symmetry, "Excellent");
  });

  it("rejects generic grading-scale Fair for proportions row", () => {
    const audit = extractGcal8xFinishGradesWithAudit(`
GRADING SCALE
1. Poor 2. Fair 3. Good 4. Very Good 5. Excellent
Proportions Fair
`);
    assert.equal(audit.cutGrade, undefined);
    assert.ok(
      audit.rejected.some((r) => r.field === "cutGrade"),
      "expected cutGrade rejection",
    );
  });

  it("reconciles scale-misread Fair when finish crop has Excellent", () => {
    const fields = emptyReportFields();
    fields.cutGrade = "Fair";
    const grades = extractGcal8xFinishGrades(finishOcr);
    applyGcal8xFinishGrades(grades, fields, (key, value) => {
      fields[key] = value;
    });
    assert.equal(fields.cutGrade, "Excellent");
  });
});

describe("GCAL proportion girdle after diagram crop", () => {
  it("infers Medium, Faceted from girdle thickness percent in diagram OCR", () => {
    const text = "Proportion Diagram 0.28mm 3.5% 7.99mm 61.1% 40.8°";
    const girdle = extractGcal8xProportionGirdle(text, text);
    assert.equal(girdle.girdleThicknessPercent, "3.5");
    assert.equal(girdle.girdlePhrase, "Medium, Faceted");
  });
});
