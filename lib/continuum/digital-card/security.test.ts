import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const CARD_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(CARD_DIR, "../../..");

function walk(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("digital-card security", () => {
  it("keeps the Supabase adapter server-only and off the public barrel", () => {
    const server = readFileSync(join(CARD_DIR, "server.ts"), "utf8");
    const barrel = readFileSync(join(CARD_DIR, "index.ts"), "utf8");
    const load = readFileSync(join(CARD_DIR, "load.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /createSupabaseDigitalCardStore/);
    assert.doesNotMatch(barrel, /createSupabaseDigitalCardStore/);
    assert.doesNotMatch(barrel, /from "\.\/supabase"/);
    assert.doesNotMatch(barrel, /from "\.\/server"/);
    assert.doesNotMatch(barrel, /from "\.\/load"/);
    assert.doesNotMatch(barrel, /from "\.\/ingest-deps"/);
    const ingestDeps = readFileSync(join(CARD_DIR, "ingest-deps.ts"), "utf8");
    assert.match(ingestDeps, /import "server-only"/);
    assert.match(load, /requireInternalClientMemorySession/);
  });

  it("does not log PII or write kernel events", () => {
    for (const file of walk(CARD_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /insertEvent|insertEvidence|insertObservation/);
      assert.doesNotMatch(source, /continuum_events|continuum_observations/);
      assert.doesNotMatch(source, /gtag|localStorage|sessionStorage/);
    }
  });

  it("does not attach card editing to public API routes", () => {
    const apiFiles = walk(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /digital-card/);
      assert.doesNotMatch(source, /saveOwnerCard/);
      assert.doesNotMatch(source, /createSupabaseDigitalCardStore/);
    }
  });

  it("keeps public card routes free of founder session loaders and private ids", () => {
    const publicDir = join(ROOT, "app", "c");
    for (const file of walk(publicDir, ".ts").concat(walk(publicDir, ".tsx"))) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /digital-card\/load/);
      assert.doesNotMatch(source, /getAuthenticatedDigitalCardAccess/);
      assert.doesNotMatch(source, /getAuthenticatedClientMemoryReader/);
      assert.doesNotMatch(source, /saveOwnerCard/);
      assert.doesNotMatch(source, /ownerPersonId|ownerUsername/);
      assert.doesNotMatch(source, /counterpartyPersonId/);
      assert.doesNotMatch(source, /continuum_person_facts|continuum_source_notes/);
    }
  });

  it("requires a founder session to edit a card", () => {
    const actions = readFileSync(
      join(ROOT, "app", "executive-dashboard", "concierge", "card", "actions.ts"),
      "utf8",
    );
    const page = readFileSync(
      join(ROOT, "app", "executive-dashboard", "concierge", "card", "page.tsx"),
      "utf8",
    );
    assert.match(actions, /saveAuthenticatedDigitalCard/);
    assert.match(page, /loadOwnerDigitalCard/);
    assert.doesNotMatch(actions, /shareDigitalCardContact/);
  });
});
