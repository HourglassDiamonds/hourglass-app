import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalizeExtractionFields } from "./fields";

describe("finalizeExtractionFields hard guards", () => {
  it("extracts Very Strong Blue from corrupted fluorescence OCR", () => {
    const fields = finalizeExtractionFields({
      fluorescence:
        "Cvceeeceeevesscsccsesieeeeneeenn Very Strong Blue /7 - [1 !",
    });
    assert.equal(fields.fluorescence, "Very Strong Blue");
  });

  it("rejects educational scale fragments for finish grades", () => {
    const fields = finalizeExtractionFields({
      polish: "Poor Fair Good Very Good",
      symmetry: "Excellent",
      cutGrade: "Good",
    });
    assert.equal(fields.polish, "");
    assert.equal(fields.symmetry, "Excellent");
    assert.equal(fields.cutGrade, "Good");
  });

  it("accepts canonical finish grades only", () => {
    const fields = finalizeExtractionFields({
      polish: "Excellent",
      symmetry: "Very Good",
      cutGrade: "Ideal",
    });
    assert.equal(fields.polish, "Excellent");
    assert.equal(fields.symmetry, "Very Good");
    assert.equal(fields.cutGrade, "Ideal");
  });
});
