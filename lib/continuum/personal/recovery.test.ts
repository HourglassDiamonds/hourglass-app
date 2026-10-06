import assert from "node:assert/strict";
import test from "node:test";
import { proposeRecoveryFromNarrative } from "./recovery";

test("natural language recovery records only values the founder supplied", () => {
  const entry = proposeRecoveryFromNarrative("I slept about four hours last night, feel wrecked, no pain, just exhausted.", "2026-10-05");
  assert.deepEqual(entry.sleepHours, { value: 4, source: "manual" });
  assert.deepEqual(entry.fatigue, { value: "high", source: "subjective" });
  assert.deepEqual(entry.pain, { value: "none", source: "subjective" });
  assert.equal(entry.hrvMs, undefined);
  assert.equal(entry.recoveryScore, undefined);
  assert.equal(entry.strain, undefined);
});
