import assert from "node:assert/strict";
import { test } from "node:test";
import { overallToCalibrationScale } from "./light-performance-calibration-review";
import { scoreRoundBrilliant } from "./scoring/round-brilliant";
import {
  buildSyntheticCalibrationFixtures,
  fixtureToFields,
} from "./synthetic-calibration-fixtures";

test("synthetic calibration fixtures produce spread across bands", () => {
  const fixtures = buildSyntheticCalibrationFixtures();
  assert.ok(fixtures.length >= 30, "expected at least 30 synthetic fixtures");

  const scores = fixtures.map((f) => {
    const result = scoreRoundBrilliant(fixtureToFields(f));
    assert.equal(result.eligible, true, `${f.id} should be score-eligible`);
    return overallToCalibrationScale(result.overall);
  });

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  assert.ok(min < 7, `expected some tradeoff/compromise scores, min=${min}`);
  assert.ok(max >= 9, `expected elite scores, max=${max}`);
  assert.ok(avg < 9.2, `synthetic set should not be top-heavy, avg=${avg}`);

  const below65 = scores.filter((s) => s < 6.5).length;
  const balanced = scores.filter((s) => s >= 6.5 && s <= 7.49).length;
  const mixed = scores.filter((s) => s >= 5.5 && s <= 6.49).length;
  assert.ok(below65 >= 3, "expected compromise examples below 6.5");
  assert.ok(balanced + mixed >= 4, "expected balanced/mixed coverage");
});

test("compromise fixture uses user example proportions", () => {
  const comp = buildSyntheticCalibrationFixtures().find(
    (f) => f.id === "synth-comp-001",
  );
  assert.ok(comp);
  assert.equal(comp!.fields.tablePercent, "64");
  assert.equal(comp!.fields.depthPercent, "63.5");
  assert.equal(comp!.fields.crownAngle, "37");
  assert.equal(comp!.fields.pavilionAngle, "41.8");
});
