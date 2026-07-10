import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  FACE_UP_REVIEW_CARATS,
  REJECTED_DIMENSIONS,
  buildDimensionReviewArtifact,
  faceAxesForSizing,
  getRepresentativeFaceUpDimensions,
  getRoundDiamondMm,
  type DiamondFaceShapeId,
} from "./face-dimensions";

const SHAPES: DiamondFaceShapeId[] = [
  "round",
  "oval",
  "cushion",
  "radiant",
  "emerald",
  "pear",
  "marquise",
  "princess",
  "asscher",
];

describe("getRepresentativeFaceUpDimensions", () => {
  it("locks round 10 ct at 14.0 mm", () => {
    const d = getRepresentativeFaceUpDimensions("round", 10);
    assert.equal(d.widthMm, 14.0);
    assert.equal(d.lengthMm, 14.0);
    assert.equal(d.reviewStatus, "locked");
    assert.equal(getRoundDiamondMm(10), 14.0);
  });

  it("does not return the rejected oval 10 linear 15.0 × 21.5", () => {
    const d = getRepresentativeFaceUpDimensions("oval", 10);
    assert.notEqual(d.widthMm, REJECTED_DIMENSIONS.oval10Linear.widthMm);
    assert.notEqual(d.lengthMm, REJECTED_DIMENSIONS.oval10Linear.lengthMm);
    assert.ok(Math.abs(d.widthMm - 15.0) > 0.5);
    assert.ok(Math.abs(d.lengthMm - 21.5) > 0.5);
    assert.equal(d.reviewStatus, "needs-justin-review");
  });

  it("does not extrapolate above the highest explicit anchor", () => {
    const at10 = getRepresentativeFaceUpDimensions("round", 10);
    const above = getRepresentativeFaceUpDimensions("round", 12);
    assert.equal(above.widthMm, at10.widthMm);
  });

  it("is monotonic in width and length across review carats", () => {
    for (const shape of SHAPES) {
      let prevW = 0;
      let prevL = 0;
      for (const carat of FACE_UP_REVIEW_CARATS) {
        const d = getRepresentativeFaceUpDimensions(shape, carat);
        assert.ok(d.widthMm + 1e-9 >= prevW, `${shape} ${carat} width`);
        assert.ok(d.lengthMm + 1e-9 >= prevL, `${shape} ${carat} length`);
        prevW = d.widthMm;
        prevL = d.lengthMm;
      }
    }
  });

  it("matches faceAxesForSizing width/length", () => {
    for (const shape of SHAPES) {
      for (const carat of FACE_UP_REVIEW_CARATS) {
        const d = getRepresentativeFaceUpDimensions(shape, carat);
        const [w, l] = faceAxesForSizing(shape, carat);
        assert.equal(w, d.widthMm);
        assert.equal(l, d.lengthMm);
      }
    }
  });
});

describe("Size Studio presence consistency (canonical width)", () => {
  it("10 ct round / size 5 uses 14.0 / 15.7 → 89%", () => {
    const stone = getRepresentativeFaceUpDimensions("round", 10).widthMm;
    const finger = 15.7;
    assert.equal(stone, 14.0);
    assert.notEqual(stone, REJECTED_DIMENSIONS.round10CoverageShapeAnchors.widthMm);
    assert.equal(Math.round((stone / finger) * 100), 89);
  });
});

describe("dimension review artifact", () => {
  it("covers every shape × review carat with statuses", () => {
    const rows = buildDimensionReviewArtifact();
    assert.equal(rows.length, SHAPES.length * FACE_UP_REVIEW_CARATS.length);
    const locked = rows.filter((r) => r.reviewStatus === "locked");
    assert.ok(locked.length >= FACE_UP_REVIEW_CARATS.length);
    assert.ok(locked.every((r) => r.shape === "round"));
    const ovalHigh = rows.filter(
      (r) => r.shape === "oval" && (r.carat === 7 || r.carat === 10),
    );
    assert.equal(ovalHigh.length, 2);
    assert.ok(
      ovalHigh.every((r) => r.reviewStatus === "needs-justin-review"),
    );
    assert.ok(
      ovalHigh.every((r) => r.currentProvenance.includes("REJECTED")),
    );
  });

  it("Size Studio page source no longer defines a live SHAPE_ANCHORS table", () => {
    const src = fs.readFileSync(
      path.resolve("app/diamond-studio/page.tsx"),
      "utf8",
    );
    assert.equal(/const SHAPE_ANCHORS\s*:/.test(src), false);
    assert.equal(/function caratToWidthMm\s*\(/.test(src), false);
    assert.equal(/function shapeDimensionsMm\s*\(/.test(src), false);
  });
});
