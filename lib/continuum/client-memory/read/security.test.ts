import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { requireInternalClientMemorySession } from "./access";
import { CLIENT_MEMORY_READER_METHODS } from "./reader";

const READ_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(READ_DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Client Memory reader security", () => {
  it("keeps the Supabase reader server-only", () => {
    const server = readFileSync(join(READ_DIR, "server.ts"), "utf8");
    const supabase = readFileSync(join(READ_DIR, "supabase.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /createSupabaseClientMemoryReader/);
    assert.match(supabase, /Do not import from client components/);
    assert.match(supabase, /Never INSERT\/UPDATE\/DELETE/);
    assert.doesNotMatch(supabase, /\.insert\(/);
    assert.doesNotMatch(supabase, /\.update\(/);
    assert.doesNotMatch(supabase, /\.delete\(/);
    assert.doesNotMatch(supabase, /\.upsert\(/);
    assert.match(supabase, /getSupabaseAdmin/);
  });

  it("does not export the Supabase admin reader from the public read index", () => {
    const index = readFileSync(join(READ_DIR, "index.ts"), "utf8");
    assert.doesNotMatch(index, /createSupabaseClientMemoryReader/);
    assert.doesNotMatch(index, /from "\.\/supabase"/);
    assert.doesNotMatch(index, /from "\.\/server"/);
    const parent = readFileSync(join(READ_DIR, "../index.ts"), "utf8");
    assert.doesNotMatch(parent, /createSupabaseClientMemoryReader/);
    assert.doesNotMatch(parent, /client-memory\/read\/supabase/);
  });

  it("does not log from the read layer", () => {
    for (const file of walkFiles(READ_DIR, ".ts")) {
      if (file.endsWith(".test.ts") || file.endsWith("fixtures.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
    }
  });

  it("does not attach Client Memory reads to public API routes", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /client-memory\/read/);
      assert.doesNotMatch(source, /createSupabaseClientMemoryReader/);
      assert.doesNotMatch(source, /continuum_person_profiles/);
    }
  });

  it("fails closed without an internal founder session", () => {
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.reason === "missing-config" || denied.reason === "missing-session", true);
    }
  });

  it("documents the reader as search/profile only", () => {
    assert.deepEqual(
      [...CLIENT_MEMORY_READER_METHODS].sort(),
      ["getPersonCockpit", "getPersonProfile", "listCurrentBirthdaysByMonth", "listOpenIdentityReviews", "listPersonSourceHistory", "searchPeople"].sort(),
    );
  });
});
