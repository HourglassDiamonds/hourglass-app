import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { connectorSegmentGeometry } from "./calibration-connector";

describe("calibration connector segment geometry", () => {
  it("insets from each handle center by the ring radius on a horizontal edge", () => {
    const geom = connectorSegmentGeometry({ x: 100, y: 200 }, { x: 300, y: 200 }, 12);
    assert.equal(geom.left, 112);
    assert.equal(geom.top, 200);
    assert.equal(geom.width, 176);
    assert.equal(geom.angleDeg, 0);
  });

  it("never yields a negative width when handles are closer than two radii", () => {
    const geom = connectorSegmentGeometry({ x: 10, y: 0 }, { x: 20, y: 0 }, 12);
    assert.equal(geom.width, 0);
    assert.equal(geom.left, 15);
    assert.equal(geom.top, 0);
  });

  it("preserves reversed A/B order (right-to-left segment)", () => {
    const geom = connectorSegmentGeometry({ x: 300, y: 100 }, { x: 100, y: 100 }, 10.5);
    assert.equal(geom.left, 289.5);
    assert.equal(geom.top, 100);
    assert.equal(geom.width, 179);
    assert.equal(geom.angleDeg, 180);
  });

  it("keeps the line clear of both centers for a diagonal segment", () => {
    const radius = 12;
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 80, y: 60 }; // length 100
    const geom = connectorSegmentGeometry(p1, p2, radius);
    assert.equal(geom.width, 76);
    // Start is radius along the unit vector (0.8, 0.6)
    assert.ok(Math.abs(geom.left - 9.6) < 1e-9);
    assert.ok(Math.abs(geom.top - 7.2) < 1e-9);
    const endX = geom.left + Math.cos((geom.angleDeg * Math.PI) / 180) * geom.width;
    const endY = geom.top + Math.sin((geom.angleDeg * Math.PI) / 180) * geom.width;
    assert.ok(Math.abs(endX - (80 - 9.6)) < 1e-9);
    assert.ok(Math.abs(endY - (60 - 7.2)) < 1e-9);
  });
});
