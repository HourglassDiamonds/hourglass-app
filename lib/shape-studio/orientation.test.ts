import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  effectiveOrientation,
  shapeSupportsOrientation,
  type StoneOrientation,
} from "./orientation";
import {
  orientedStoneMm,
  overlaySizeFromCardPpm,
} from "./overlay-scale";
import { renderStoneHeightMm, renderStoneWidthMm } from "./dimensions";
import { formatFaceUpSizeCopy } from "./dimensions";

describe("shape-studio orientation helpers", () => {
  it("marks only elongated shapes as orientable", () => {
    for (const shape of [
      "oval",
      "radiant",
      "emerald",
      "pear",
      "marquise",
    ] as const) {
      assert.equal(shapeSupportsOrientation(shape), true);
    }
    for (const shape of [
      "round",
      "cushion",
      "princess",
      "asscher",
    ] as const) {
      assert.equal(shapeSupportsOrientation(shape), false);
      assert.equal(effectiveOrientation(shape, "ew"), "ns");
    }
  });

  it("swaps display axes for E/W without changing canonical mm", () => {
    const ppm = 4;
    const w = renderStoneWidthMm("oval", 2);
    const l = renderStoneHeightMm("oval", 2);
    assert.equal(w, 7);
    assert.equal(l, 10);

    const ns = orientedStoneMm("oval", 2, "ns");
    const ew = orientedStoneMm("oval", 2, "ew");
    assert.deepEqual(ns, { horizontalMm: w, verticalMm: l });
    assert.deepEqual(ew, { horizontalMm: l, verticalMm: w });

    const nsPx = overlaySizeFromCardPpm("oval", 2, ppm, "ns");
    const ewPx = overlaySizeFromCardPpm("oval", 2, ppm, "ew");
    assert.equal(nsPx.widthPx, w * ppm);
    assert.equal(nsPx.heightPx, l * ppm);
    assert.equal(ewPx.widthPx, l * ppm);
    assert.equal(ewPx.heightPx, w * ppm);
    assert.equal(nsPx.widthPx * nsPx.heightPx, ewPx.widthPx * ewPx.heightPx);
  });

  it("does not rotate non-orientable shapes even when preference is E/W", () => {
    const ppm = 3;
    const pref: StoneOrientation = "ew";
    const size = overlaySizeFromCardPpm("round", 2, ppm, pref);
    const d = renderStoneWidthMm("round", 2);
    assert.equal(size.widthPx, d * ppm);
    assert.equal(size.heightPx, d * ppm);
  });

  it("keeps face-up readout canonical regardless of orientation", () => {
    assert.equal(
      formatFaceUpSizeCopy("round", 2),
      "Approx. face-up diameter: 8.1 mm",
    );
    assert.equal(
      formatFaceUpSizeCopy("oval", 2),
      "Approx. face-up size: 7.0 × 10.0 mm",
    );
  });
});
