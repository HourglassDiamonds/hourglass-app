import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { connectorSegmentGeometry } from "./calibration-connector";

describe("calibration connector segment geometry", () => {
  it("runs tick-to-tick with zero inset on a horizontal edge", () => {
    const geom = connectorSegmentGeometry({ x: 100, y: 200 }, { x: 300, y: 200 }, 0);
    assert.equal(geom.left, 100);
    assert.equal(geom.top, 200);
    assert.equal(geom.width, 200);
    assert.equal(geom.angleDeg, 0);
  });

  it("applies a tiny end inset without going negative", () => {
    const geom = connectorSegmentGeometry({ x: 100, y: 200 }, { x: 300, y: 200 }, 1);
    assert.equal(geom.left, 101);
    assert.equal(geom.top, 200);
    assert.equal(geom.width, 198);
  });

  it("never yields a negative width when endpoints are closer than two insets", () => {
    const geom = connectorSegmentGeometry({ x: 10, y: 0 }, { x: 20, y: 0 }, 12);
    assert.equal(geom.width, 0);
    assert.equal(geom.left, 15);
    assert.equal(geom.top, 0);
  });

  it("preserves reversed A/B order (right-to-left segment)", () => {
    const geom = connectorSegmentGeometry({ x: 300, y: 100 }, { x: 100, y: 100 }, 0);
    assert.equal(geom.left, 300);
    assert.equal(geom.top, 100);
    assert.equal(geom.width, 200);
    assert.equal(geom.angleDeg, 180);
  });

  it("keeps diagonal tick-to-tick geometry stable", () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 80, y: 60 }; // length 100
    const geom = connectorSegmentGeometry(p1, p2, 0);
    assert.equal(geom.width, 100);
    assert.equal(geom.left, 0);
    assert.equal(geom.top, 0);
  });
});
