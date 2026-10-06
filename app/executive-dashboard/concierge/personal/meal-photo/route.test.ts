import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const directory = dirname(fileURLToPath(import.meta.url));
const route = readFileSync(join(directory, "route.ts"), "utf8");
const analyzer = readFileSync(join(directory, "../../../../../lib/continuum/personal/meal-ai.ts"), "utf8");

test("meal-photo route remains authenticated and only returns a reviewable estimate", () => {
  assert.match(route, /requireInternalClientMemorySession/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /request\.formData\(\)/);
  assert.match(route, /estimateMealPhoto\(image\)/);
  assert.doesNotMatch(route, /localStorage|meals:|insert\(|upsert\(/);
});

test("photo analysis requests structured food, portion, macro, confidence, and caveat fields without storage", () => {
  for (const field of ["name", "portion", "calories", "protein", "carbs", "fat", "confidence", "caveat"]) assert.match(analyzer, new RegExp(field));
  assert.match(analyzer, /store:\s*false/);
  assert.match(analyzer, /meal-analysis-unavailable/);
});
