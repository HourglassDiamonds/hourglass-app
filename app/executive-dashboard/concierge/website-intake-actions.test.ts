import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const directory = dirname(fileURLToPath(import.meta.url));
const action = readFileSync(join(directory, "website-intake-actions.ts"), "utf8");
const transition = readFileSync(join(directory, "../../../lib/continuum/client-memory/website-intake-transition.ts"), "utf8");
const controls = readFileSync(join(directory, "components/website-intake-controls.tsx"), "utf8");
const today = readFileSync(join(directory, "components/today-operating-sections.tsx"), "utf8");
const loader = readFileSync(join(directory, "../../../lib/continuum/client-memory/read/website-intake-load.ts"), "utf8");

test("intake lifecycle preserves history and uses authenticated, audited CRM writers", () => {
  assert.match(action, /getAuthenticatedClientWebsiteIntakeReader/);
  assert.match(action, /getAuthenticatedProjectJobWriter/);
  assert.match(action, /getAuthenticatedFounderProjectWriter/);
  assert.match(transition, /projectId:\s*null/);
  assert.match(action, /transitionWebsiteIntakeWithWriters/);
  assert.match(transition, /websiteIntakeOperationId/);
  assert.match(transition, /createProject/);
  assert.match(transition, /waitingOnActor:\s*"client"/);
  assert.match(transition, /action:\s*disposition === "contacted" \? "resolve" : "cancel"/);
  assert.doesNotMatch(action, /delete\(|continuum_website_intakes[^]*delete/);
  assert.doesNotMatch(`${action}\n${transition}`, /insertProject/i);
  assert.match(controls, /Mark contacted/);
  assert.match(controls, /Mark test/);
  assert.match(controls, /Mark solicitation/);
  assert.match(controls, /Restore to New Concierge/);
  assert.match(today, /Choose Test submission or Solicitation/);
  assert.match(today, /move === "remove" && intakeTarget/);
});

test("correspondence association is exact-email evidence, founder-approved, and never name-only", () => {
  assert.match(action, /hashEmail\(intake\.email\)/);
  assert.match(action, /payload\.emailHash !== expectedHash/);
  assert.match(action, /confirmGmailPersonAssociation/);
  assert.match(loader, /payload->>emailHash/);
  assert.doesNotMatch(today, /fullName\.split/);
  assert.match(controls, /Confirm correspondence/);
  assert.match(controls, /does not fabricate an email or a sale/);
  assert.match(action, /Confirm the exact-address correspondence first/);
});
