import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { requireInternalClientMemorySession } from "../read/access";

const LIFE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(LIFE_DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Project Lifecycle security and isolation", () => {
  it("does not populate lifecycle from reconstruction, Gmail, or artifacts", () => {
    const gmailDir = join(ROOT, "lib/continuum/gmail");
    for (const file of walkFiles(gmailDir, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /setProjectLifecycle/);
      assert.doesNotMatch(source, /continuum_project_lifecycle_states/);
      assert.doesNotMatch(source, /continuum_project_lifecycle_events/);
      assert.doesNotMatch(source, /continuum_client_memory_set_project_lifecycle/);
    }
    const reconstruction = join(ROOT, "lib/continuum/client-memory");
    for (const file of [
      join(reconstruction, "apply.ts"),
      join(reconstruction, "import-runtime.ts"),
      join(reconstruction, "workbook.ts"),
    ]) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /setProjectLifecycle/);
      assert.doesNotMatch(source, /continuum_project_lifecycle_states/);
    }
  });

  it("Person Project Book reads are batched, not N+1, and skip event history", () => {
    const load = readFileSync(join(LIFE_DIR, "load-states.ts"), "utf8");
    assert.match(load, /collectLifecycleProjectIds/);
    assert.match(load, /\.in\("project_id", projectIds\)/);
    assert.doesNotMatch(load, /for \(const .+ of .+\.projectId/);
    assert.doesNotMatch(
      load.slice(0, load.indexOf("loadProjectLifecycleForDesk")),
      /continuum_project_lifecycle_events/,
    );
    const reader = readFileSync(join(LIFE_DIR, "../read/supabase.ts"), "utf8");
    assert.match(reader, /loadActiveLifecycleStates/);
    assert.doesNotMatch(reader, /loadProjectLifecycleForDesk/);
  });

  it("does not attach lifecycle writes to public API routes", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /setProjectLifecycle/);
      assert.doesNotMatch(source, /saveProjectLifecycleCorrection/);
      assert.doesNotMatch(source, /continuum_project_lifecycle_states/);
    }
    const publicConcierge = readFileSync(join(ROOT, "app/concierge/page.tsx"), "utf8");
    assert.doesNotMatch(publicConcierge, /project-lifecycle|saveProjectLifecycle/);
  });

  it("requires founder authentication and does not log values", () => {
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
    for (const file of walkFiles(LIFE_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /insertEvent|insertEvidence|insertObservation/);
    }
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    assert.match(actions, /getAuthenticatedClientMemoryProjectSpecWriter/);
    assert.match(actions, /setProjectLifecycle/);
    assert.doesNotMatch(actions, /console\.(log|info|debug|warn|error)/);
  });

  it("does not auto-create lifecycle rows on read", () => {
    const load = readFileSync(join(LIFE_DIR, "load-states.ts"), "utf8");
    assert.doesNotMatch(load, /\.insert\(/);
    assert.doesNotMatch(load, /\.upsert\(/);
    const compose = readFileSync(join(LIFE_DIR, "../project-desk/compose.ts"), "utf8");
    assert.doesNotMatch(compose, /\.insert\(|setProjectLifecycle/);
    const kindSql = readFileSync(
      join(ROOT, "lib/supabase/continuum-client-memory-project-kind.sql"),
      "utf8",
    );
    assert.doesNotMatch(kindSql, /continuum_project_lifecycle/);
    const operatingSql = readFileSync(
      join(ROOT, "lib/supabase/continuum-client-memory-custom-repair-layers.sql"),
      "utf8",
    );
    assert.doesNotMatch(operatingSql, /continuum_project_lifecycle/);
  });
});
