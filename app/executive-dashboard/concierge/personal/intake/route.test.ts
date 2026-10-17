import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const directory = dirname(fileURLToPath(import.meta.url));
const route = readFileSync(join(directory, "route.ts"), "utf8");
const ai = readFileSync(join(directory, "../../../../../lib/continuum/personal/intake-ai.ts"), "utf8");

test("unified intake authenticates and sends only submitted Performance context with store false", () => {
  assert.match(route, /requireInternalClientMemorySession/); assert.match(route, /status:\s*401/);
  for (const source of ["text", "meal_photo", "nutrition_label", "activity_screenshot"]) assert.match(route, new RegExp(source));
  assert.match(ai, /store:\s*false/); assert.match(ai, /knownMeals.*slice\(0, 12\)/);
  assert.doesNotMatch(ai, /gmail|client-memory|project|concierge.*context/i);
});

test("activity contract distinguishes observed fields and leaves missing metrics nullable", () => {
  for (const field of ["durationMinutes", "distanceMiles", "pace", "averageHeartRate", "maxHeartRate", "elevationFeet", "reportedCalories", "whoopStrain", "steps", "ruckWeightLb", "observedFields"]) assert.match(ai, new RegExp(field));
  assert.match(ai, /Null absent values/); assert.match(ai, /evidenceFor/);
  assert.match(ai, /upcoming_tonal_session/); assert.match(ai, /tonalMovements/); assert.match(ai, /never reconstruct a workout from memory/i);
});
