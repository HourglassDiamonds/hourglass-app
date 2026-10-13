import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const directory = dirname(fileURLToPath(import.meta.url));
const route = readFileSync(join(directory, "route.ts"), "utf8");
const ai = readFileSync(join(directory, "../../../../../lib/continuum/personal/adjustment-ai.ts"), "utf8");
const app = readFileSync(join(directory, "../performance-app.tsx"), "utf8");

test("adjustment interpretation is founder-authenticated, strict, read-only, and bounded", () => {
  assert.match(route, /requireInternalClientMemorySession/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /buildSterlingScheduleAdjustment/);
  assert.match(ai, /store:\s*false/);
  assert.match(ai, /json_schema/);
  assert.match(ai, /strict:\s*true/);
  assert.match(ai, /\.slice\(0, 21\)/);
  assert.doesNotMatch(ai, /gmail|client-memory|project/i);
});

test("adjustment UI renders actionable errors, editable proposal, and explicit persistence", () => {
  assert.match(app, /role="alert"/);
  assert.match(app, /Move selected workout to/);
  assert.match(app, /accept_adjustment/);
  assert.match(app, /Confirm changes/);
  assert.match(app, /The adjustment was not saved/);
});
