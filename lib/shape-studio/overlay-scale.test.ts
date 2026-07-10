import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  overlaySizeFromCardPpm,
  overlaySizePx,
} from "./overlay-scale";

describe("shape-studio card-calibrated overlay scale", () => {
  it("sizes from stone mm × display ppm with no ring size", () => {
    const ppm = 3.5;
    const size = overlaySizeFromCardPpm("round", 2, ppm);
    assert.equal(size.widthPx, 8.1 * ppm);
    assert.equal(size.heightPx, 8.1 * ppm);
  });

  it("matches overlaySizePx card branch without depending on ringSize", () => {
    const ppm = 2.75;
    const viaHelper = overlaySizeFromCardPpm("oval", 2, ppm);
    const viaLegacyA = overlaySizePx("oval", 2, 4, 999, "card-reference", ppm);
    const viaLegacyB = overlaySizePx("oval", 2, 10, 1, "card-reference", ppm);
    assert.deepEqual(viaHelper, viaLegacyA);
    assert.deepEqual(viaHelper, viaLegacyB);
    assert.equal(viaHelper.widthPx, 7.0 * ppm);
    assert.equal(viaHelper.heightPx, 10.0 * ppm);
  });

  it("rejects non-positive ppm without inventing a ring-size fallback size", () => {
    const zero = overlaySizeFromCardPpm("round", 2, 0);
    assert.equal(zero.widthPx, 0);
    assert.equal(zero.heightPx, 0);
  });

  it("swaps axes for E/W while preserving product of physical spans", () => {
    const ppm = 5;
    const ns = overlaySizeFromCardPpm("pear", 5, ppm, "ns");
    const ew = overlaySizeFromCardPpm("pear", 5, ppm, "ew");
    assert.equal(ew.widthPx, ns.heightPx);
    assert.equal(ew.heightPx, ns.widthPx);
  });
});
