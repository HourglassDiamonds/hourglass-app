import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const GMAIL_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(GMAIL_DIR, "../../../..");

function walk(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Client Memory Gmail index security", () => {
  it("keeps the Supabase adapter server-only and off public indexes", () => {
    const server = readFileSync(join(GMAIL_DIR, "server.ts"), "utf8");
    const barrel = readFileSync(join(GMAIL_DIR, "index.ts"), "utf8");
    const parent = readFileSync(join(GMAIL_DIR, "../index.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /createSupabaseGmailIndexStore/);
    assert.doesNotMatch(barrel, /createSupabaseGmailIndexStore/);
    assert.doesNotMatch(barrel, /from "\.\/supabase"/);
    assert.doesNotMatch(barrel, /from "\.\/server"/);
    assert.doesNotMatch(parent, /createSupabaseGmailIndexStore/);
    assert.doesNotMatch(parent, /gmail\/supabase/);
  });

  it("does not log source records or write canonical / kernel rows", () => {
    for (const file of walk(GMAIL_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /insertEvent|insertEvidence|insertObservation/);
      assert.doesNotMatch(source, /continuum_events|continuum_observations/);
      assert.doesNotMatch(source, /continuum_person_profiles|continuum_person_facts/);
      assert.doesNotMatch(source, /insertSourceNote|insertWish|createPersonAtomic/);
      assert.doesNotMatch(source, /gtag|localStorage|sessionStorage/);
      assert.doesNotMatch(source, /gmail\.googleapis|gmail\.readonly/);
      assert.doesNotMatch(source, /GOOGLE_REFRESH_TOKEN|AGENT_OS_GMAIL_USER/);
    }
  });

  it("does not attach Gmail index writes to public API routes", () => {
    const apiFiles = walk(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /client-memory\/gmail/);
      assert.doesNotMatch(source, /createSupabaseGmailIndexStore/);
      assert.doesNotMatch(source, /InMemoryGmailIndexStore/);
    }
  });

  it("does not persist a mailbox payload field on the indexed message type", () => {
    const types = readFileSync(join(GMAIL_DIR, "types.ts"), "utf8");
    assert.doesNotMatch(types, /body:/);
    assert.doesNotMatch(types, /excerpt:/);
    assert.match(types, /fromEmailHash/);
    const supabase = readFileSync(join(GMAIL_DIR, "supabase.ts"), "utf8");
    assert.doesNotMatch(supabase, /from "\.\/server"/);
    assert.match(supabase, /getSupabaseAdmin/);
  });
});
