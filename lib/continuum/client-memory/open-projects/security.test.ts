import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Open Project work security", () => {
  it("does not activate CoS, Agent OS, Gmail writes, or shared dashboard compose", () => {
    for (const file of walkFiles(DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /agent-os/);
      assert.doesNotMatch(source, /composeChiefOfStaffBrief|presentCommandCenter/);
      assert.doesNotMatch(source, /gmail\.googleapis|continuum_gmail_messages/);
      assert.doesNotMatch(source, /continuum\/dashboard\/compose/);
      assert.doesNotMatch(source, /saveOpenJob|setProjectLifecycle|createProjectArtifact/);
      assert.doesNotMatch(source, /createBrowserClient/);
    }
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    assert.doesNotMatch(actions, /loadOpenProjectWork|selectOpenProjectWork|open-projects/);
    const dashboard = readFileSync(
      join(ROOT, "lib/continuum/dashboard/compose.ts"),
      "utf8",
    );
    assert.doesNotMatch(dashboard, /selectOpenProjectWork|open-projects|projectWork/);
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/page.tsx"),
      "utf8",
    );
    const card = readFileSync(join(DIR, "card.ts"), "utf8");
    const deskSupabase = readFileSync(
      join(ROOT, "lib/continuum/client-memory/project-desk/supabase.ts"),
      "utf8",
    );
    assert.match(card, /selectOpenProjectWork/);
    assert.doesNotMatch(card, /gmail\.googleapis|parseEmail|thread body/);
    assert.match(deskSupabase, /loadActiveLifecycleStates/);
    assert.match(deskSupabase, /listProjectsFromSnapshot\(\{ \.\.\.snapshot, lifecycleStates \}/);
    assert.match(page, /loadCurrentProjectCards/);
    assert.match(page, /loadContinuumHomeModel/);
    assert.doesNotMatch(page, /composeChiefOfStaffBrief/);
  });
});
