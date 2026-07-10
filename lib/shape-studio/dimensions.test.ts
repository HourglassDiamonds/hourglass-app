import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  faceAxesForSizing as sizeStudioAxes,
  getRepresentativeFaceUpDimensions,
  getRoundDiamondMm as sizeStudioRound,
  REJECTED_DIMENSIONS,
} from "@/lib/diamond-tech-suite/face-dimensions";
import {
  formatDimensionReadout,
  getRoundDiamondMm,
  renderStoneHeightMm,
  renderStoneWidthMm,
} from "./dimensions";

function ovalAxes(carat: number): [number, number] {
  return [
    renderStoneWidthMm("oval", carat),
    renderStoneHeightMm("oval", carat),
  ];
}

describe("shape-studio oval dimensions (no rejected linear 10ct)", () => {
  it("preserves explicit oval anchors through 5 ct", () => {
    assert.deepEqual(ovalAxes(1), [5.5, 8.0]);
    assert.deepEqual(ovalAxes(2), [7.0, 10.0]);
    assert.deepEqual(ovalAxes(3), [8.0, 11.5]);
    assert.deepEqual(ovalAxes(4), [9.0, 12.5]);
    assert.deepEqual(ovalAxes(5), [10.0, 14.0]);
  });

  it("rejects linear 15.0 × 21.5 at 10 ct", () => {
    const [w, l] = ovalAxes(10);
    assert.notEqual(w, REJECTED_DIMENSIONS.oval10Linear.widthMm);
    assert.notEqual(l, REJECTED_DIMENSIONS.oval10Linear.lengthMm);
    const expectedScale = Math.cbrt(10 / 5);
    assert.ok(Math.abs(w - 10 * expectedScale) < 1e-9);
    assert.ok(Math.abs(l - 14 * expectedScale) < 1e-9);
  });

  it("formats 10 ct oval with provisional cbrt seed readout", () => {
    const readout = formatDimensionReadout("oval", 10);
    assert.equal(readout.label, "12.6 × 17.6 mm");
  });
});

describe("shape-studio ↔ Size Studio dimension parity", () => {
  const shapes = [
    "round",
    "oval",
    "cushion",
    "radiant",
    "emerald",
    "pear",
    "marquise",
    "princess",
    "asscher",
  ] as const;
  const carats = [1, 1.5, 2, 3, 4, 5, 7, 10];

  it("matches shared getRepresentativeFaceUpDimensions everywhere", () => {
    for (const shape of shapes) {
      for (const carat of carats) {
        const d = getRepresentativeFaceUpDimensions(shape, carat);
        const [sw, sl] = sizeStudioAxes(shape, carat);
        assert.equal(renderStoneWidthMm(shape, carat), d.widthMm);
        assert.equal(renderStoneHeightMm(shape, carat), d.lengthMm);
        assert.equal(sw, d.widthMm);
        assert.equal(sl, d.lengthMm);
        if (shape === "round") {
          assert.equal(getRoundDiamondMm(carat), sizeStudioRound(carat));
        }
      }
    }
  });
});

describe("shape-studio non-oval dimensions", () => {
  it("keeps round diameters at key carats", () => {
    assert.equal(getRoundDiamondMm(1), 6.5);
    assert.equal(getRoundDiamondMm(2), 8.1);
    assert.equal(getRoundDiamondMm(5), 11.0);
    assert.equal(getRoundDiamondMm(10), 14.0);
    assert.equal(renderStoneWidthMm("round", 10), 14.0);
    assert.equal(renderStoneHeightMm("round", 10), 14.0);
  });

  it("keeps radiant and marquise provisional seeded axes at 1 and 10 ct", () => {
    assert.ok(
      Math.abs(renderStoneWidthMm("radiant", 1) - 6.5 * 0.95) < 1e-9,
    );
    assert.ok(
      Math.abs(renderStoneHeightMm("radiant", 1) - 6.5 * 0.95 * 1.3) < 1e-9,
    );
    assert.ok(
      Math.abs(renderStoneWidthMm("radiant", 10) - 14.0 * 0.95) < 1e-9,
    );
    assert.ok(
      Math.abs(renderStoneHeightMm("radiant", 10) - 14.0 * 0.95 * 1.3) < 1e-9,
    );

    assert.ok(
      Math.abs(renderStoneWidthMm("marquise", 1) - 6.5 * 0.75) < 1e-9,
    );
    assert.ok(
      Math.abs(renderStoneHeightMm("marquise", 1) - 6.5 * 0.75 * 2.0) < 1e-9,
    );
    assert.ok(
      Math.abs(renderStoneWidthMm("marquise", 10) - 14.0 * 0.75) < 1e-9,
    );
    assert.ok(
      Math.abs(renderStoneHeightMm("marquise", 10) - 14.0 * 0.75 * 2.0) < 1e-9,
    );
  });
});
