import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { requireInternalClientMemorySession } from "../read/access";

const OP_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(OP_DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Custom / Repair operating-layer security and isolation", () => {
  it("Y. does not populate subtype fields from reconstruction, Gmail, or artifacts", () => {
    const gmailDir = join(ROOT, "lib/continuum/gmail");
    for (const file of walkFiles(gmailDir, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /correctProjectOperatingDetail/);
      assert.doesNotMatch(source, /continuum_project_custom_details/);
      assert.doesNotMatch(source, /continuum_project_repair_details/);
      assert.doesNotMatch(source, /custom_design_brief|repair_requested_service/);
    }
  });

  it("Z. Person Project Book reads are batched by Kind, not N+1", () => {
    const load = readFileSync(join(OP_DIR, "load-details.ts"), "utf8");
    assert.match(load, /collectActiveOperatingProjectIds/);
    assert.match(load, /\.in\("project_id", customProjectIds\)/);
    assert.match(load, /\.in\("project_id", repairProjectIds\)/);
    assert.doesNotMatch(load, /for \(const .+ of .+\.projectId/);
    assert.doesNotMatch(load, /maybeSingle\(\)/);
    const reader = readFileSync(join(OP_DIR, "../read/supabase.ts"), "utf8");
    assert.match(reader, /loadActiveOperatingDetails/);
    assert.doesNotMatch(
      reader,
      /for \(const .+ of projectIds\)[\s\S]{0,400}custom_details/,
    );
  });

  it("does not attach operating-detail writes to public API routes", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /correctProjectOperatingDetail/);
      assert.doesNotMatch(source, /saveProjectOperatingDetailCorrection/);
      assert.doesNotMatch(source, /continuum_project_custom_details/);
    }
    const publicConcierge = readFileSync(join(ROOT, "app/concierge/page.tsx"), "utf8");
    assert.doesNotMatch(publicConcierge, /operating-detail|custom_design_brief/);
  });

  it("requires founder authentication and does not log values", () => {
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
    for (const file of walkFiles(OP_DIR, ".ts")) {
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
    assert.match(actions, /correctProjectOperatingDetail/);
    assert.doesNotMatch(actions, /console\.(log|info|debug|warn|error)/);
  });

  it("does not auto-create subtype rows on read", () => {
    const load = readFileSync(join(OP_DIR, "load-details.ts"), "utf8");
    assert.doesNotMatch(load, /\.insert\(/);
    assert.doesNotMatch(load, /\.upsert\(/);
    const desk = readFileSync(join(OP_DIR, "../project-desk/supabase.ts"), "utf8");
    assert.doesNotMatch(desk, /continuum_project_custom_details[\s\S]{0,200}\.insert/);
    const compose = readFileSync(join(OP_DIR, "../project-desk/compose.ts"), "utf8");
    assert.doesNotMatch(compose, /\.insert\(|correctProjectOperatingDetail/);
  });
});
