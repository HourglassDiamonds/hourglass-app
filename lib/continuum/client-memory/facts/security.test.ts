import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { CLIENT_MEMORY_READER_METHODS } from "../read/reader";

const FACTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(FACTS_DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Client Memory fact writer security", () => {
  it("keeps the Supabase writer server-only and off public indexes", () => {
    const server = readFileSync(join(FACTS_DIR, "server.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /createSupabaseClientMemoryFactWriter/);
    const parent = readFileSync(join(FACTS_DIR, "../index.ts"), "utf8");
    assert.doesNotMatch(parent, /createSupabaseClientMemoryFactWriter/);
    assert.doesNotMatch(parent, /facts\/supabase/);
    const readIndex = readFileSync(join(FACTS_DIR, "../read/index.ts"), "utf8");
    assert.doesNotMatch(readIndex, /facts\/write/);
    assert.doesNotMatch(readIndex, /setManualBirthday/);
    assert.ok(CLIENT_MEMORY_READER_METHODS.includes("listCurrentBirthdaysByMonth"));
  });

  it("does not log or write notes, wishes, or kernel artifacts", () => {
    for (const file of walkFiles(FACTS_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /insertEvent|insertEvidence|insertObservation/);
      assert.doesNotMatch(source, /continuum_events|continuum_observations/);
      assert.doesNotMatch(source, /insertSourceNote|insertWish/);
      assert.doesNotMatch(source, /gtag|localStorage|sessionStorage/);
    }
  });

  it("does not attach fact writes to public API routes", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /client-memory\/facts/);
      assert.doesNotMatch(source, /setManualBirthday/);
      assert.doesNotMatch(source, /createSupabaseClientMemoryFactWriter/);
    }
  });

  it("leaves Command Center, Ask, and CoS compose free of fact writes", () => {
    const concierge = join(ROOT, "app", "executive-dashboard", "concierge");
    const command = readFileSync(join(concierge, "components", "command-center-home.tsx"), "utf8");
    const ask = readFileSync(join(concierge, "components", "ask-concierge-shell.tsx"), "utf8");
    const cos = readFileSync(join(concierge, "components", "chief-of-staff-today.tsx"), "utf8");
    const dashboard = join(ROOT, "lib", "continuum", "dashboard");
    for (const source of [command, ask, cos]) {
      assert.doesNotMatch(source, /setManualBirthday|listCurrentBirthdaysByMonth/);
    }
    for (const file of walkFiles(dashboard, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /birthday|setManualBirthday|person_facts/);
    }
  });
});
