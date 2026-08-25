import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { CLIENT_MEMORY_READER_METHODS } from "../read/reader";

const PERSON_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(PERSON_DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Client Memory Person writer security", () => {
  it("keeps the Supabase writer server-only and off public indexes", () => {
    const server = readFileSync(join(PERSON_DIR, "server.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /createSupabaseClientMemoryPersonWriter/);
    const parent = readFileSync(join(PERSON_DIR, "../index.ts"), "utf8");
    assert.doesNotMatch(parent, /createSupabaseClientMemoryPersonWriter/);
    assert.doesNotMatch(parent, /person\/supabase/);
    assert.doesNotMatch(parent, /addManualClient/);
    const readIndex = readFileSync(join(PERSON_DIR, "../read/index.ts"), "utf8");
    assert.doesNotMatch(readIndex, /person\/add-manual-client/);
    assert.doesNotMatch(readIndex, /addManualClient/);
    assert.doesNotMatch(readIndex, /editPersonProfile/);
    const edit = readFileSync(join(PERSON_DIR, "edit-person.ts"), "utf8");
    assert.doesNotMatch(edit, /applyExistingPersonAtomic|planProfileMerge|createPersonAtomic/);
    assert.ok(CLIENT_MEMORY_READER_METHODS.includes("searchPeople"));
  });

  it("does not log PII or write notes, facts, wishes, or kernel artifacts", () => {
    for (const file of walkFiles(PERSON_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /insertEvent|insertEvidence|insertObservation/);
      assert.doesNotMatch(source, /continuum_events|continuum_observations/);
      assert.doesNotMatch(source, /insertSourceNote|insertWish|setCurrentPersonFact/);
      assert.doesNotMatch(source, /gtag|localStorage|sessionStorage/);
    }
  });

  it("does not attach Person writes to public API routes", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /client-memory\/person/);
      assert.doesNotMatch(source, /addManualClient/);
      assert.doesNotMatch(source, /editPersonProfile/);
      assert.doesNotMatch(source, /createSupabaseClientMemoryPersonWriter/);
      assert.doesNotMatch(source, /saveManualClient/);
      assert.doesNotMatch(source, /savePersonProfile/);
    }
  });

  it("leaves Command Center, Ask, and CoS compose free of Person writes", () => {
    const concierge = join(ROOT, "app", "executive-dashboard", "concierge");
    const command = readFileSync(join(concierge, "components", "command-center-home.tsx"), "utf8");
    const ask = readFileSync(join(concierge, "components", "ask-concierge-shell.tsx"), "utf8");
    const askAnswer = readFileSync(join(concierge, "components", "ask-concierge-answer.tsx"), "utf8");
    const cos = readFileSync(join(concierge, "components", "chief-of-staff-today.tsx"), "utf8");
    const dashboard = join(ROOT, "lib", "continuum", "dashboard");
    for (const source of [command, ask, askAnswer, cos]) {
      assert.doesNotMatch(source, /addManualClient|saveManualClient|editPersonProfile|savePersonProfile/);
    }
    for (const file of walkFiles(dashboard, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /addManualClient|saveManualClient|editPersonProfile|savePersonProfile/);
    }
  });

  it("does not modify passkey or session authentication", () => {
    for (const file of walkFiles(PERSON_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /passkey|WebAuthn|issue-session|password\.ts/);
    }
    const load = readFileSync(join(PERSON_DIR, "load.ts"), "utf8");
    assert.match(load, /requireInternalClientMemorySession/);
    assert.match(load, /unauthorized/);
  });
});
