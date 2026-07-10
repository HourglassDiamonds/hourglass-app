import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

describe("shape-studio oval dimensions", () => {
  it("preserves explicit oval anchors through 5 ct", () => {
    assert.deepEqual(ovalAxes(1), [5.5, 8.0]);
    assert.deepEqual(ovalAxes(2), [7.0, 10.0]);
    assert.deepEqual(ovalAxes(3), [8.0, 11.5]);
    assert.deepEqual(ovalAxes(4), [9.0, 12.5]);
    assert.deepEqual(ovalAxes(5), [10.0, 14.0]);
  });

  it("uses cube-root scaling from the 5 ct anchor above 5 ct", () => {
    const [w5, l5] = ovalAxes(5);
    for (const carat of [5.25, 6, 7.5, 10]) {
      const scale = Math.cbrt(carat / 5);
      const [w, l] = ovalAxes(carat);
      assert.ok(Math.abs(w - w5 * scale) < 1e-9, `${carat}ct width`);
      assert.ok(Math.abs(l - l5 * scale) < 1e-9, `${carat}ct length`);
    }
  });

  it("corrects 10 ct oval away from the old linear extrapolation", () => {
    const [w, l] = ovalAxes(10);
    const expectedScale = Math.cbrt(10 / 5);
    assert.ok(Math.abs(w - 10 * expectedScale) < 1e-9);
    assert.ok(Math.abs(l - 14 * expectedScale) < 1e-9);
    assert.ok(Math.abs(w - 12.599210) < 1e-4);
    assert.ok(Math.abs(l - 17.638894) < 1e-4);
    assert.notEqual(w, 15.0);
    assert.notEqual(l, 21.5);
    assert.ok(w < 14);
    assert.ok(l < 20);
  });

  it("is continuous and monotonic from 5 to 10 ct", () => {
    const [w5, l5] = ovalAxes(5);
    const [wJustAbove, lJustAbove] = ovalAxes(5.01);
    assert.ok(wJustAbove > w5);
    assert.ok(lJustAbove > l5);
    assert.ok(wJustAbove - w5 < 0.05);
    assert.ok(lJustAbove - l5 < 0.05);

    let prevW = w5;
    let prevL = l5;
    for (const carat of [5.5, 6, 7, 8, 9, 10]) {
      const [w, l] = ovalAxes(carat);
      assert.ok(w > prevW, `width increases at ${carat}`);
      assert.ok(l > prevL, `length increases at ${carat}`);
      prevW = w;
      prevL = l;
    }
  });

  it("formats 10 ct oval readout with one-decimal axes", () => {
    const readout = formatDimensionReadout("oval", 10);
    assert.equal(readout.label, "12.6 × 17.6 mm");
    assert.ok(Math.abs(readout.widthMm - 12.599210) < 1e-4);
    assert.ok(Math.abs(readout.lengthMm - 17.638894) < 1e-4);
  });
});

describe("shape-studio non-oval dimensions unchanged", () => {
  it("keeps round diameters at key carats", () => {
    assert.equal(getRoundDiamondMm(1), 6.5);
    assert.equal(getRoundDiamondMm(2), 8.1);
    assert.equal(getRoundDiamondMm(5), 11.0);
    assert.equal(getRoundDiamondMm(10), 14.0);
    assert.equal(renderStoneWidthMm("round", 10), 14.0);
    assert.equal(renderStoneHeightMm("round", 10), 14.0);
  });

  it("keeps radiant and marquise formula axes at 1 and 10 ct", () => {
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
