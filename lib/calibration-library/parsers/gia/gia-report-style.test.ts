import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectGiaReportStyle,
  layoutForStyle,
  bandsForStyle,
  styleExpectsFullAngles,
} from "./gia-report-style";

describe("detectGiaReportStyle", () => {
  it("classifies LGDR dossier", () => {
    const t =
      "Laboratory-Grown Diamond Report - Dossier\nLGDR\nIdentification Laboratory-Grown";
    const d = detectGiaReportStyle(t);
    assert.equal(d.style, "GIA_LGDR_DOSSIER");
    assert.equal(d.layout, "lgdr-dossier");
    assert.ok(d.signals.length > 0);
  });

  it("classifies natural facsimile", () => {
    const t =
      "GIA Natural Diamond Grading Report\nFacsimile\nPROPORTIONS\nGrading Scales";
    const d = detectGiaReportStyle(t);
    assert.equal(d.style, "GIA_NATURAL_FACSIMILE");
    assert.equal(d.layout, "facsimile");
  });

  it("classifies natural colored simplified", () => {
    const t =
      "GIA Natural Colored Diamond Report\nAdditional Information\nPROPORTIONS";
    const d = detectGiaReportStyle(t);
    assert.equal(d.style, "GIA_NATURAL_COLORED_SIMPLIFIED");
    assert.equal(d.layout, "colored-simplified");
    assert.equal(styleExpectsFullAngles(d.style), false);
  });

  it("returns unknown for weak signals", () => {
    const d = detectGiaReportStyle("Round Brilliant 1.00 ct");
    assert.equal(d.style, "GIA_UNKNOWN");
  });
});

describe("style-specific diagram bands", () => {
  it("LGDR and facsimile use different band sets", () => {
    const lgdr = bandsForStyle("GIA_LGDR_DOSSIER");
    const fac = bandsForStyle("GIA_NATURAL_FACSIMILE");
    const colored = bandsForStyle("GIA_NATURAL_COLORED_SIMPLIFIED");
    assert.ok(lgdr.some((b) => b.id === "stack"));
    assert.ok(fac.some((b) => b.id === "table"));
    assert.ok(colored.some((b) => b.id === "proportions-header"));
    assert.notDeepEqual(lgdr, fac);
  });

  it("maps style to layout", () => {
    assert.equal(layoutForStyle("GIA_LGDR_DOSSIER"), "lgdr-dossier");
    assert.equal(
      layoutForStyle("GIA_NATURAL_COLORED_SIMPLIFIED"),
      "colored-simplified",
    );
  });
});
