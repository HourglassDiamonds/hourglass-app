import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDiamondCadAsset } from "@/app/diamond-studio/components/diamond-cad-assets";
import {
  SHAPE_ASSET_BOUNDS,
  containedVisibleSilhouettePx,
  overlayImageLayoutStyle,
} from "./asset-bounds";
import { SHAPES, shapeAssetPath } from "./constants";
import {
  formatDimensionReadout,
  renderStoneHeightMm,
  renderStoneWidthMm,
} from "./dimensions";
import { overlaySizeFromCardPpm } from "./overlay-scale";

describe("shape-studio asset visible bounds (CAD v2)", () => {
  it("records measured fractions for every public shape from CAD registry", () => {
    for (const shape of SHAPES) {
      const b = SHAPE_ASSET_BOUNDS[shape];
      const cad = getDiamondCadAsset(shape);
      assert.equal(b.intrinsicWidth, 2560);
      assert.equal(b.intrinsicHeight, 2560);
      assert.equal(b.assetSrc, cad.src);
      assert.equal(shapeAssetPath(shape), cad.src);
      assert.match(b.assetSrc, /\/diamond-tech-suite\/diamonds-v2\/diamond-.+-v2\.png$/);
      assert.ok(b.visibleWidthFraction > 0 && b.visibleWidthFraction <= 1);
      assert.ok(b.visibleHeightFraction > 0 && b.visibleHeightFraction <= 1);
      assert.ok(b.paddingLeftFraction >= 0);
      assert.ok(b.paddingTopFraction >= 0);
      assert.ok(
        Math.abs(b.visibleWidthFraction - cad.visibleBounds.width / 2560) < 1e-12,
      );
      assert.ok(
        Math.abs(b.visibleHeightFraction - cad.visibleBounds.height / 2560) < 1e-12,
      );
    }
  });

  it("documents pear padding as the primary undersize source under contain", () => {
    const pear = SHAPE_ASSET_BOUNDS.pear;
    assert.ok(pear.visibleWidthFraction < 0.6);
    const wrapper = overlaySizeFromCardPpm("pear", 10, 10);
    const legacy = containedVisibleSilhouettePx(
      "pear",
      wrapper.widthPx,
      wrapper.heightPx,
    );
    const modelW = renderStoneWidthMm("pear", 10);
    const modelH = renderStoneHeightMm("pear", 10);
    const legacyWmm = legacy.widthPx / 10;
    const legacyHmm = legacy.heightPx / 10;
    assert.ok(legacyWmm < modelW * 0.7, `legacy visible width ${legacyWmm}`);
    assert.ok(legacyHmm < modelH * 0.75, `legacy visible height ${legacyHmm}`);
  });

  it("maps opaque bbox onto the wrapper via overlayImageLayoutStyle", () => {
    for (const shape of SHAPES) {
      const style = overlayImageLayoutStyle(shape);
      const b = SHAPE_ASSET_BOUNDS[shape];
      const widthPct = Number(String(style.width).replace("%", ""));
      const heightPct = Number(String(style.height).replace("%", ""));
      assert.ok(Math.abs(widthPct - 100 / b.visibleWidthFraction) < 1e-6);
      assert.ok(Math.abs(heightPct - 100 / b.visibleHeightFraction) < 1e-6);
      assert.ok(
        Math.abs(b.visibleWidthFraction * (widthPct / 100) - 1) < 1e-9,
      );
      assert.ok(
        Math.abs(b.visibleHeightFraction * (heightPct / 100) - 1) < 1e-9,
      );
    }
  });

  it("does not resolve legacy /shape-studio/assets paths", () => {
    for (const shape of SHAPES) {
      assert.ok(!shapeAssetPath(shape).includes("/shape-studio/assets/"));
    }
  });
});

describe("shape-studio dimension model matrix", () => {
  const carats = [1, 2, 3, 4, 5, 7, 10] as const;

  it("produces finite positive axes for every public shape/carat", () => {
    for (const shape of SHAPES) {
      let prevArea = 0;
      for (const carat of carats) {
        const r = formatDimensionReadout(shape, carat);
        assert.ok(r.widthMm > 0 && r.lengthMm > 0);
        assert.ok(r.lengthMm + 1e-9 >= r.widthMm);
        assert.equal(renderStoneWidthMm(shape, carat), r.widthMm);
        assert.equal(renderStoneHeightMm(shape, carat), r.lengthMm);
        const area = r.widthMm * r.lengthMm;
        assert.ok(
          area + 1e-6 >= prevArea,
          `${shape} ${carat}ct area shrank vs prior`,
        );
        prevArea = area;
      }
    }
  });

  it("keeps round 10ct at the explicit 14.0 mm anchor", () => {
    assert.equal(renderStoneWidthMm("round", 10), 14.0);
    assert.equal(renderStoneHeightMm("round", 10), 14.0);
  });

  it("keeps pear 10ct at round-derived 11.48 × 17.794 mm", () => {
    assert.ok(Math.abs(renderStoneWidthMm("pear", 10) - 14 * 0.82) < 1e-9);
    assert.ok(
      Math.abs(renderStoneHeightMm("pear", 10) - 14 * 0.82 * 1.55) < 1e-9,
    );
  });
});

describe("shape-studio calibrated overlay size (model A)", () => {
  it("sizes the wrapper to modeled mm × display ppm", () => {
    const ppm = 12.5;
    for (const shape of ["round", "pear", "oval", "emerald"] as const) {
      for (const carat of [1, 2, 5, 10] as const) {
        const size = overlaySizeFromCardPpm(shape, carat, ppm);
        assert.ok(
          Math.abs(size.widthPx - renderStoneWidthMm(shape, carat) * ppm) <
            1e-9,
        );
        assert.ok(
          Math.abs(size.heightPx - renderStoneHeightMm(shape, carat) * ppm) <
            1e-9,
        );
      }
    }
  });
});
