import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const directory = dirname(fileURLToPath(import.meta.url));
const action = readFileSync(join(directory, "website-intake-actions.ts"), "utf8");
const controls = readFileSync(join(directory, "components/website-intake-controls.tsx"), "utf8");
const today = readFileSync(join(directory, "components/today-operating-sections.tsx"), "utf8");
const loader = readFileSync(join(directory, "../../../lib/continuum/client-memory/read/website-intake-load.ts"), "utf8");

test("intake disposition preserves submission history and uses the authenticated projectless Job boundary", () => {
  assert.match(action, /getAuthenticatedClientWebsiteIntakeReader/);
  assert.match(action, /getAuthenticatedProjectJobWriter/);
  assert.match(action, /projectId:\s*null/);
  assert.match(action, /action:\s*disposition === "dismiss" \? "cancel" : "resolve"/);
  assert.doesNotMatch(action, /delete\(|continuum_website_intakes[^]*delete/);
  assert.doesNotMatch(action, /createProject|insertProject/i);
  assert.match(controls, /Review dismissal/);
  assert.match(controls, /Approve dismissal/);
  assert.match(today, /I found the selected intake\. Review dismissal/);
  assert.match(today, /move === "remove" && intakeTarget/);
});

test("correspondence association is exact-email evidence, founder-approved, and never name-only", () => {
  assert.match(action, /hashEmail\(intake\.email\)/);
  assert.match(action, /payload\.emailHash !== expectedHash/);
  assert.match(action, /confirmGmailPersonAssociation/);
  assert.match(loader, /payload->>emailHash/);
  assert.doesNotMatch(today, /fullName\.split/);
  assert.match(controls, /Confirm correspondence/);
  assert.match(controls, /does not confirm a sale or create a Project/);
});
