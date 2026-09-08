import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { requireInternalClientMemorySession } from "../read/access";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../../..");

function walk(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Founder Project writer security", () => {
  it("does not log or use a browser Supabase client", () => {
    for (const file of walk(DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /createBrowserClient/);
      assert.doesNotMatch(source, /gmail\.googleapis|users\.messages\.send/);
    }
  });

  it("does not attach founder Project writes to public API or Gmail adapters", () => {
    for (const file of walk(join(ROOT, "app/api"), ".ts")) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /createFounderProject|createSupabaseFounderProjectWriter/);
      assert.doesNotMatch(source, /founder-project/);
    }
    const gmailCandidates = join(ROOT, "lib/continuum/gmail/candidates");
    for (const file of walk(gmailCandidates, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /createFounderProject|createProjectJob/);
    }
  });

  it("fails closed without an internal founder session", () => {
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
    const load = readFileSync(join(DIR, "load-writer.ts"), "utf8");
    assert.match(load, /requireInternalClientMemorySession/);
    assert.match(load, /unauthorized/);
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/founder-project-actions.ts"),
      "utf8",
    );
    assert.match(actions, /getAuthenticatedFounderProjectWriter/);
    assert.match(actions, /saveFounderIntake/);
    assert.doesNotMatch(actions, /gmail\.googleapis|users\.messages\.send/);
    const intakePage = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail/intake/page.tsx"),
      "utf8",
    );
    assert.match(intakePage, /robots: \{ index: false/);
    assert.doesNotMatch(intakePage, /putCheckpoint|indexMessage|users\.messages\.send/);
    const intakeUi = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-new-project-intake.tsx"),
      "utf8",
    );
    assert.match(intakeUi, /approveGmailNewProject/);
    assert.match(intakeUi, /gmailIntakeRefreshButtonLabel|Refresh mail index/);
    assert.match(intakeUi, /gmailIntakeFreshnessHeadline|Gmail index last updated/);
    assert.doesNotMatch(intakeUi, /need attention/);
    assert.doesNotMatch(intakeUi, /createProjectJob\(/);
  });

  it("does not export non-async values from founder-project or Gmail intake server actions", () => {
    const founderActions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/founder-project-actions.ts"),
      "utf8",
    );
    const intakeActions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-intake-actions.ts"),
      "utf8",
    );
    for (const source of [founderActions, intakeActions]) {
      assert.match(source, /"use server"/);
      assert.doesNotMatch(source, /^export \{/m);
      assert.doesNotMatch(source, /^export const \w+ =/m);
      assert.doesNotMatch(source, /^export function /m);
      assert.doesNotMatch(source, /NEW_PROJECT_CONTEXT_TOPIC/);
    }
    assert.match(founderActions, /export async function saveFounderIntake/);
    assert.match(intakeActions, /export async function scanGmailNewProjectIntake/);
    assert.match(intakeActions, /loadGmailPersonWorldFromAdmin/);
    assert.doesNotMatch(intakeActions, /Continuum people could not be loaded/);
  });

  it("loads Gmail intake People from the canonical history table and does not fork search", () => {
    const world = readFileSync(join(DIR, "gmail-world.ts"), "utf8");
    const intakeUi = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-new-project-intake.tsx"),
      "utf8",
    );
    const createAction = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/create-action-form.tsx"),
      "utf8",
    );
    const intakePage = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail/intake/page.tsx"),
      "utf8",
    );
    assert.match(world, /continuum_project_history/);
    assert.doesNotMatch(world, /continuum_project_histories/);
    assert.match(intakeUi, /searchConciergeClients/);
    assert.match(intakeUi, /Retry identity/);
    assert.match(intakeUi, /Possible client identity is not currently available/);
    assert.match(createAction, /searchConciergeClients/);
    assert.match(intakePage, /loadGmailPersonWorldFromAdmin/);
    assert.match(intakePage, /readGmailCurrentState/);
    assert.match(intakePage, /GMAIL_INCREMENTAL_JOB_KEY/);
    const intakeActions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-intake-actions.ts"),
      "utf8",
    );
    assert.doesNotMatch(intakeActions, /createPersonAtomic/);
    assert.doesNotMatch(intakeActions, /createFounderProject/);
  });
});
