import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { requireInternalClientMemorySession } from "../read/access";
import { PROJECT_DESK_READER_METHODS } from "./reader";

const DESK_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DESK_DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

const FORBIDDEN_LIFECYCLE = [
  /continuum_project_operating/,
  /continuum_client_memory_set_project_lifecycle/,
  /saveProjectLifecycle/,
  /setProjectLifecycle/,
  /ProjectLifecycleForm/,
  /createSupabaseProjectDeskOperatingWriter/,
  /listOpenProjects/,
];

describe("Project Desk security", () => {
  it("keeps the Supabase reader server-only and off public indexes", () => {
    const server = readFileSync(join(DESK_DIR, "server.ts"), "utf8");
    const index = readFileSync(join(DESK_DIR, "index.ts"), "utf8");
    const parent = readFileSync(join(DESK_DIR, "../index.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /createSupabaseProjectDeskReader/);
    assert.doesNotMatch(server, /createSupabaseProjectDeskOperatingWriter/);
    assert.doesNotMatch(index, /createSupabaseProjectDeskReader/);
    assert.doesNotMatch(index, /from "\.\/supabase"/);
    assert.doesNotMatch(index, /from "\.\/server"/);
    assert.doesNotMatch(index, /from "\.\/writer"/);
    assert.doesNotMatch(index, /from "\.\/lifecycle"/);
    assert.doesNotMatch(parent, /createSupabaseProjectDeskReader/);
    assert.doesNotMatch(parent, /project-desk\/supabase/);
    assert.deepEqual(
      [...PROJECT_DESK_READER_METHODS].sort(),
      ["getProjectDesk", "listProjects"].sort(),
    );
  });

  it("does not query Gmail, CoS, Open Jobs, artifacts, Human Intake, or lifecycle state", () => {
    for (const file of walkFiles(DESK_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /continuum_gmail_messages|continuum_gmail_checkpoints/);
      assert.doesNotMatch(source, /continuum_attention_items|continuum_attention_briefs/);
      assert.doesNotMatch(source, /composeChiefOfStaffBrief|SpecialistObservation/);
      assert.doesNotMatch(source, /continuum_project_open_jobs|continuum_project_artifacts|continuum_project_jobs/);
      assert.doesNotMatch(source, /human-intake|source-inbox/);
      assert.doesNotMatch(source, /gmail\.googleapis|createBrowserClient/);
      assert.doesNotMatch(source, /Waiting on Client|No Current Action/);
      for (const pattern of FORBIDDEN_LIFECYCLE) {
        assert.doesNotMatch(source, pattern);
      }
    }
  });

  it("does not attach Project Desk to public API routes", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /project-desk/);
      assert.doesNotMatch(source, /saveProjectLifecycle/);
      assert.doesNotMatch(source, /createSupabaseProjectDeskReader/);
    }
    const publicConcierge = readFileSync(join(ROOT, "app/concierge/page.tsx"), "utf8");
    assert.doesNotMatch(publicConcierge, /project-desk|Open Projects|saveProjectLifecycle/);
  });

  it("fails closed without an internal founder session", () => {
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
    const load = readFileSync(join(DESK_DIR, "load.ts"), "utf8");
    assert.match(load, /requireInternalClientMemorySession/);
    assert.match(load, /unauthorized/);
    assert.doesNotMatch(load, /getAuthenticatedProjectDeskWriter|OperatingWriter/);
    const layout = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/layout.tsx"),
      "utf8",
    );
    assert.match(layout, /requireInternalClientMemorySession/);
    const projects = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/projects/page.tsx"),
      "utf8",
    );
    const desk = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/projects/[projectId]/page.tsx"),
      "utf8",
    );
    assert.match(projects, /getAuthenticatedProjectDeskReader/);
    assert.match(desk, /getAuthenticatedProjectDeskReader/);
    assert.match(desk, /isProjectIdParam/);
  });
});
