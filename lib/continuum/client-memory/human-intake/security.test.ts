import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { requireInternalClientMemorySession } from "../read/access";

const INTAKE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(INTAKE_DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Human intake security", () => {
  it("keeps the Supabase store server-only and off public indexes", () => {
    const server = readFileSync(join(INTAKE_DIR, "server.ts"), "utf8");
    const index = readFileSync(join(INTAKE_DIR, "index.ts"), "utf8");
    const parent = readFileSync(join(INTAKE_DIR, "../index.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /createSupabaseHumanSourceStore/);
    assert.doesNotMatch(index, /createSupabaseHumanSourceStore/);
    assert.doesNotMatch(index, /from "\.\/supabase"/);
    assert.doesNotMatch(index, /from "\.\/server"/);
    assert.doesNotMatch(parent, /createSupabaseHumanSourceStore/);
    assert.doesNotMatch(parent, /human-intake\/supabase/);
  });

  it("does not log transcripts or write canonical / kernel / CoS / Open Jobs / Gmail", () => {
    for (const file of walkFiles(INTAKE_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /insertEvent|insertEvidence|insertObservation/);
      assert.doesNotMatch(source, /continuum_events|continuum_observations/);
      assert.doesNotMatch(source, /insertSourceNote|insertWish|setCurrentPersonFact/);
      assert.doesNotMatch(source, /continuum_person_facts|continuum_wishes/);
      assert.doesNotMatch(source, /continuum_project_history/);
      assert.doesNotMatch(source, /continuum_attention_items|composeChiefOfStaffBrief/);
      assert.doesNotMatch(source, /continuum_open_jobs|continuum_commitments/);
      assert.doesNotMatch(source, /continuum_gmail_messages|gmail\.googleapis/);
      assert.doesNotMatch(source, /continuum_intake_candidates/);
      assert.doesNotMatch(source, /getPublicUrl/);
      assert.doesNotMatch(source, /gtag|localStorage|sessionStorage/);
      assert.doesNotMatch(source, /openai|anthropic|generateText/i);
    }
  });

  it("does not attach human-source writes to public API routes", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /human-intake/);
      assert.doesNotMatch(source, /createSupabaseHumanSourceStore/);
      assert.doesNotMatch(source, /savePlaudHumanSource/);
      assert.doesNotMatch(source, /continuum_human_sources/);
    }
  });

  it("requires a founder session and keeps the private bucket private", () => {
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
    const load = readFileSync(join(INTAKE_DIR, "load.ts"), "utf8");
    assert.match(load, /requireInternalClientMemorySession/);
    assert.match(load, /unauthorized/);
    const storage = readFileSync(join(INTAKE_DIR, "storage.ts"), "utf8");
    assert.match(storage, /continuum-human-sources/);
    assert.doesNotMatch(storage, /getPublicUrl/);
    const supabase = readFileSync(join(INTAKE_DIR, "supabase.ts"), "utf8");
    assert.match(supabase, /getSupabaseAdmin/);
    assert.doesNotMatch(supabase, /getPublicUrl/);
    assert.doesNotMatch(supabase, /createBrowserClient/);
  });
});
