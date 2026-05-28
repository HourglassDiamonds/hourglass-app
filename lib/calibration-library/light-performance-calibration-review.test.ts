import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calibrationBandFromScale,
  CALIBRATION_BANDS,
  overallToCalibrationScale,
} from "./light-performance-calibration-review";

test("calibration bands cover 0-10 without perfect wording", () => {
  assert.equal(calibrationBandFromScale(9.5).label, "Exceptional / Rare");
  assert.equal(calibrationBandFromScale(8.7).label, "Superb");
  assert.equal(calibrationBandFromScale(7.8).label, "Strong");
  assert.equal(calibrationBandFromScale(6.8).label, "Balanced");
  assert.equal(calibrationBandFromScale(5.8).label, "Mixed");
  assert.equal(calibrationBandFromScale(4.2).label, "Significant Compromise");
  assert.ok(!CALIBRATION_BANDS.some((b) => /perfect/i.test(b.label)));
});

test("overallToCalibrationScale maps 0-100 engine to 0-10 review scale", () => {
  assert.equal(overallToCalibrationScale(87), 8.7);
  assert.equal(overallToCalibrationScale(100), 10);
});
