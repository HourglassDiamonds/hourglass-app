import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const directory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(directory, "performance-app.tsx"), "utf8");
const css = readFileSync(join(directory, "performance.module.css"), "utf8");

test("Performance exposes explicit workout resolution controls and confirmation-gated Sterling changes", () => {
  for (const label of ["Start", "Modify today", "Defer", "Skip", "Confirm changes", "Reject"]) assert.match(source, new RegExp(label));
  assert.match(source, /nothing has changed yet/i);
  assert.match(source, /Other planned sessions that will move/);
  assert.match(source, /displacedWorkouts/);
  assert.match(source, /performance-mutation-action-unavailable/);
});

test("meal photo and recovery flows stay optional, editable, and mobile usable", () => {
  assert.match(source, /capture="environment"/);
  assert.match(source, /TAKE MEAL PHOTO/);
  assert.match(source, /UPLOAD MEAL PHOTO/);
  for (const label of ["Add missing food", "Remove", "Accept", "Reject"]) assert.match(source, new RegExp(label));
  for (const field of ["sleepHours", "sleepQuality", "recoveryScore", "strain", "restingHeartRate", "hrvMs", "bodyweightLb", "fatigue", "soreness", "pain"]) assert.match(source, new RegExp(field));
  assert.match(css, /@media\(max-width:390px\)/);
  assert.match(css, /min-height:44px/);
});

test("nutrition preserves the review gate and exposes frequent one-tap controls", () => {
  assert.match(source, /Nothing is saved until you accept/);
  assert.match(source, /proposal:\s*intakeProposal/);
  for (const label of ["Frequently Eaten", "Save as frequent", "Unpin", "Pin", "Edit default", "Hide", "Undo", "Edit this occurrence"]) assert.match(source, new RegExp(label));
  assert.match(css, /\.photoActions\{display:grid/);
  assert.match(css, /\.frequentLog[^}]*min-height:88px/);
  assert.match(source, /Delete source image/);
  assert.match(source, /performance-revision-conflict/);
});

test("route navigation and legacy browser data migration remain available", () => {
  for (const route of ["/personal/workouts", "/personal/food", "/personal/recovery", "/personal/progress"]) {
    assert.match(source, new RegExp(route));
  }
  assert.match(source, /continuum\.personal\.performance\.v3/);
  assert.match(source, /continuum\.personal\.performance\.v2/);
  assert.match(source, /continuum\.personal\.v1/);
  assert.match(source, /migrateLegacyPersonalState/);
  assert.match(css, /\.tabs a\[aria-current=page\]/);
});
