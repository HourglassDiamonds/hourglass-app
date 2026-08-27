import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { requireInternalClientMemorySession } from "../read/access";
import { CLIENT_MEMORY_READER_METHODS } from "../read/reader";

const WRITE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(WRITE_DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Client Memory note writer security", () => {
  it("keeps the Supabase writer server-only and off the public indexes", () => {
    const server = readFileSync(join(WRITE_DIR, "server.ts"), "utf8");
    const index = readFileSync(join(WRITE_DIR, "index.ts"), "utf8");
    const parent = readFileSync(join(WRITE_DIR, "../index.ts"), "utf8");
    const readIndex = readFileSync(join(WRITE_DIR, "../read/index.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /createSupabaseClientMemoryNoteWriter/);
    assert.doesNotMatch(index, /createSupabaseClientMemoryNoteWriter/);
    assert.doesNotMatch(index, /from "\.\/supabase"/);
    assert.doesNotMatch(index, /from "\.\/server"/);
    assert.doesNotMatch(parent, /createSupabaseClientMemoryNoteWriter/);
    assert.doesNotMatch(readIndex, /write\//);
    assert.deepEqual(
      [...CLIENT_MEMORY_READER_METHODS].sort(),
      ["getPersonCockpit", "getPersonProfile", "listCurrentBirthdaysByMonth", "listOpenIdentityReviews", "listPersonSourceHistory", "searchPeople"].sort(),
    );
  });

  it("does not log note text or write kernel/analytics events", () => {
    for (const file of walkFiles(WRITE_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /insertEvent|insertEvidence|insertObservation/);
      assert.doesNotMatch(source, /continuum_events|continuum_evidence|continuum_observations/);
      assert.doesNotMatch(source, /continuum_person_facts|continuum_wishes/);
      assert.doesNotMatch(source, /gtag|analytics|noteText=/);
    }
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    assert.match(actions, /getAuthenticatedClientMemoryNoteWriter/);
    assert.match(actions, /requireInternalClientMemorySession|getAuthenticatedClientMemoryNoteWriter/);
    assert.doesNotMatch(actions, /console\.(log|info|debug|warn|error)/);
    assert.doesNotMatch(actions, /noteText=/);
    assert.match(actions, /\?saved=1/);
  });

  it("does not attach Client Memory writes to public API routes", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /client-memory\/write/);
      assert.doesNotMatch(source, /createSupabaseClientMemoryNoteWriter/);
      assert.doesNotMatch(source, /addManualNote/);
      assert.doesNotMatch(source, /saveManualConciergeNote/);
    }
  });

  it("fails closed without an internal founder session", () => {
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
    const load = readFileSync(join(WRITE_DIR, "load.ts"), "utf8");
    assert.match(load, /requireInternalClientMemorySession/);
    assert.match(load, /unauthorized/);
  });
});
