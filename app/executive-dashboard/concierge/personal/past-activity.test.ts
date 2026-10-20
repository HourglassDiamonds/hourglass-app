import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const directory = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(directory, "performance-app.tsx"), "utf8");
const ai = readFileSync(join(directory, "../../../../lib/continuum/personal/intake-ai.ts"), "utf8");
const persistence = readFileSync(join(directory, "../../../../lib/continuum/personal/persistence-core.ts"), "utf8");

test("past activity has explicit date-first review and never reschedules a planned workout", () => {
  assert.match(app, /Log Past Activity/);
  assert.match(app, /max=\{shiftDate\(today, -1\)\}/);
  assert.match(app, /does not reschedule a planned workout/);
  assert.match(app, /input\.file \? await prepareUpload\(input\.file, input\.sourceType === "activity_screenshot"/);
  assert.match(app, /setIntakeFile\(image \?\? null\)/);
  assert.match(app, /ActivityReview/);
  assert.match(app, /acceptLabel = "Accept activity"/);
});

test("screenshot provenance uses a byte digest for server-enforced dedupe without invented metrics", () => {
  assert.match(ai, /createHash\("sha256"\)/);
  assert.match(ai, /Null absent values/);
  assert.match(persistence, /performance-source-digest-invalid/);
  assert.match(persistence, /proposal\.normalizedSourceDigest !== actualDigest/);
  assert.match(persistence, /accept-activity-\$\{proposal\.sourceDigest\}/);
  assert.match(persistence, /upsert:\s*false/);
});

test("activity acceptance reports initial success and byte-identical duplicates", () => {
  assert.match(app, /duplicate\?: boolean/);
  assert.match(app, /saved\.duplicate \? "Activity already logged" : activities\.length === 1 \? "Activity logged successfully"/);
  assert.match(app, /aria-live="polite" className=\{styles\.warning\}/);
});

test("visible dates conflict visibly, multiple activities stay separate, and accepted dates are correctable", () => {
  assert.match(ai, /activityDate/);
  assert.match(ai, /additionalActivities/);
  assert.match(ai, /Daily WHOOP metrics belong only in dailySummary/);
  assert.match(app, /selected date conflicts with the visible screenshot date/);
  assert.match(app, /dateConflictConfirmed/);
  assert.match(app, /Correct activity date/);
  assert.match(app, /action:\s*"edit_activity"/);
  assert.match(app, /activities\.length === 1/);
});
