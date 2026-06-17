import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import {
  buildFancyShapeReportDetailItems,
  buildFancyShapeTraitLine,
  resolveFancyCutShape,
  shouldPresentFancyShapeResult,
} from "./fancy-shape-presentation";

/** Synthetic fields aligned with IGI LG732517637 — Princess, E/VS1, 1.80 ct. */
const LG732517637_FIELDS = emptyReportFields({
  shape: "Princess Cut",
  carat: "1.80",
  measurements: "6.42 x 6.38 x 4.12",
  polish: "Excellent",
  symmetry: "Excellent",
  fluorescence: "None",
});

const LG732517637_GRADE_HINTS = {
  color: "E",
  clarity: "VS1",
};

describe("resolveFancyCutShape", () => {
  it("returns null for round brilliant shape field", () => {
    assert.equal(resolveFancyCutShape("Round Brilliant"), null);
    assert.equal(resolveFancyCutShape("Round"), null);
  });

  it("returns princess from shape field", () => {
    assert.equal(resolveFancyCutShape("Princess Cut"), "Princess Cut");
  });

  it("uses reportTextHint only when shape field is empty", () => {
    assert.equal(
      resolveFancyCutShape("", "Shape and Cutting Style Princess Cut"),
      "Princess Cut",
    );
    assert.equal(
      resolveFancyCutShape("Princess Cut", "Round Brilliant"),
      "Princess Cut",
    );
  });
});

describe("shouldPresentFancyShapeResult", () => {
  it("activates for LG732517637 princess anchor fields", () => {
    assert.equal(
      shouldPresentFancyShapeResult({
        fields: LG732517637_FIELDS,
        gradeHints: LG732517637_GRADE_HINTS,
      }),
      true,
    );
  });

  it("does not activate for round brilliant partial proportion read", () => {
    assert.equal(
      shouldPresentFancyShapeResult({
        fields: emptyReportFields({
          shape: "Round Brilliant",
          carat: "1.00",
          polish: "Excellent",
          symmetry: "Excellent",
        }),
        gradeHints: { color: "G", clarity: "VS2" },
      }),
      false,
    );
  });

  it("does not activate when shape is missing and hint is round", () => {
    assert.equal(
      shouldPresentFancyShapeResult({
        fields: emptyReportFields({ carat: "1.00" }),
        reportTextHint: "Round Brilliant Cut",
      }),
      false,
    );
  });
});

describe("buildFancyShapeReportDetailItems", () => {
  it("includes extracted identity and finish for princess anchor", () => {
    const items = buildFancyShapeReportDetailItems({
      fields: LG732517637_FIELDS,
      gradeHints: LG732517637_GRADE_HINTS,
      displayShape: "Princess Cut",
      formatCarat: (c) => `${c} ct`,
    });
    const labels = items.map((i) => i.label);
    assert.ok(labels.includes("Shape"));
    assert.ok(labels.includes("Carat"));
    assert.ok(labels.includes("Color"));
    assert.ok(labels.includes("Clarity"));
    assert.ok(labels.includes("Polish"));
    assert.ok(!labels.includes("Table %"));
  });
});

describe("buildFancyShapeTraitLine", () => {
  it("does not use round-brilliant trait language", () => {
    const line = buildFancyShapeTraitLine("Princess Cut");
    assert.match(line, /Princess Cut/i);
    assert.match(line, /Manual Review/i);
    assert.doesNotMatch(line, /Balanced · Steady/i);
  });
});
