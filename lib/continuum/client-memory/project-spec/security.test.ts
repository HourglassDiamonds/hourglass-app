import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { requireInternalClientMemorySession } from "../read/access";

const SPEC_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SPEC_DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Client Memory project-spec writer security", () => {
  it("keeps the Supabase writer server-only and off public indexes", () => {
    const server = readFileSync(join(SPEC_DIR, "server.ts"), "utf8");
    const index = readFileSync(join(SPEC_DIR, "index.ts"), "utf8");
    const parent = readFileSync(join(SPEC_DIR, "../index.ts"), "utf8");
    const readIndex = readFileSync(join(SPEC_DIR, "../read/index.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /createSupabaseClientMemoryProjectSpecWriter/);
    assert.doesNotMatch(index, /createSupabaseClientMemoryProjectSpecWriter/);
    assert.doesNotMatch(index, /from "\.\/supabase"/);
    assert.doesNotMatch(index, /from "\.\/server"/);
    assert.doesNotMatch(parent, /createSupabaseClientMemoryProjectSpecWriter/);
    assert.doesNotMatch(parent, /project-spec\/supabase/);
    assert.doesNotMatch(readIndex, /project-spec\/correct/);
    assert.doesNotMatch(readIndex, /correctProjectSpec/);
  });

  it("does not log spec values or write kernel/analytics events", () => {
    for (const file of walkFiles(SPEC_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /insertEvent|insertEvidence|insertObservation/);
      assert.doesNotMatch(source, /continuum_events|continuum_evidence|continuum_observations/);
      assert.doesNotMatch(source, /continuum_person_facts|continuum_wishes|continuum_source_notes/);
      assert.doesNotMatch(source, /gtag|analytics|fingerSize=/);
    }
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    assert.match(actions, /getAuthenticatedClientMemoryProjectSpecWriter/);
    assert.doesNotMatch(actions, /console\.(log|info|debug|warn|error)/);
    assert.match(actions, /\?saved=spec/);
  });

  it("does not attach project spec writes to public API routes", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /client-memory\/project-spec/);
      assert.doesNotMatch(source, /correctProjectSpec/);
      assert.doesNotMatch(source, /correctProjectKind/);
      assert.doesNotMatch(source, /correctProjectOperatingDetail/);
      assert.doesNotMatch(source, /createSupabaseClientMemoryProjectSpecWriter/);
      assert.doesNotMatch(source, /saveProjectSpecCorrection/);
      assert.doesNotMatch(source, /saveProjectKindCorrection/);
      assert.doesNotMatch(source, /saveProjectOperatingDetailCorrection/);
      assert.doesNotMatch(source, /setProjectLifecycle/);
      assert.doesNotMatch(source, /saveProjectLifecycleCorrection/);
    }
  });

  it("fails closed without an internal founder session", () => {
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
    const load = readFileSync(join(SPEC_DIR, "load.ts"), "utf8");
    assert.match(load, /requireInternalClientMemorySession/);
    assert.match(load, /unauthorized/);
  });

  it("leaves Command Center, Ask, CoS, Human Intake, and Gmail free of spec writes", () => {
    const concierge = join(ROOT, "app", "executive-dashboard", "concierge");
    const command = readFileSync(join(concierge, "components", "command-center-home.tsx"), "utf8");
    const ask = readFileSync(join(concierge, "components", "ask-concierge-shell.tsx"), "utf8");
    const cos = readFileSync(join(concierge, "components", "chief-of-staff-today.tsx"), "utf8");
    const plaud = readFileSync(join(concierge, "components", "add-plaud-form.tsx"), "utf8");
    for (const source of [command, ask, cos, plaud]) {
      assert.doesNotMatch(source, /correctProjectSpec|correctProjectKind|correctProjectOperatingDetail|setProjectLifecycle|saveProjectSpecCorrection|saveProjectKindCorrection|saveProjectOperatingDetailCorrection|saveProjectLifecycleCorrection/);
    }
    const gmail = join(ROOT, "lib", "continuum", "client-memory", "gmail");
    for (const file of walkFiles(gmail, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /correctProjectSpec|correctProjectKind|project-spec/);
    }
  });
});
