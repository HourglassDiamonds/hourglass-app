import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ASK_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(ASK_DIR, "../../../..");
const CONCIERGE_DIR = join(ROOT, "app", "executive-dashboard", "concierge");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Ask Concierge security", () => {
  it("is deterministic structured lookup with no LLM, Gmail, notes, or CoS wiring", () => {
    for (const file of walkFiles(ASK_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /openai|anthropic|grok|embeddings|vector/i);
      assert.doesNotMatch(source, /gmail|sourceNotes|searchPeople|getPersonProfile/);
      assert.doesNotMatch(source, /upcomingBirthdays|composeContinuumHome|ChiefOfStaff|loadContinuumHomeModel/);
      assert.doesNotMatch(source, /localStorage|sessionStorage|gtag|analytics/);
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
    }
  });

  it("keeps the Ask client component off the Supabase reader and public APIs", () => {
    const ask = readFileSync(join(CONCIERGE_DIR, "components", "ask-concierge-shell.tsx"), "utf8");
    const askAnswer = readFileSync(join(CONCIERGE_DIR, "components", "ask-concierge-answer.tsx"), "utf8");
    const actions = readFileSync(join(CONCIERGE_DIR, "actions.ts"), "utf8");
    assert.match(ask, /askConcierge/);
    assert.doesNotMatch(ask, /listCurrentBirthdaysByMonth|createSupabaseClientMemoryReader|getSupabaseAdmin/);
    assert.doesNotMatch(ask, /fetch\(|\/api\/|localStorage|sessionStorage|gtag/);
    assert.doesNotMatch(askAnswer, /listCurrentBirthdaysByMonth|createSupabaseClientMemoryReader|getSupabaseAdmin/);
    assert.match(askAnswer, /conciergeClientPath/);
    assert.match(actions, /askConcierge/);
    assert.match(actions, /getAuthenticatedClientMemoryReader/);
    assert.match(actions, /answerAskConciergeQuery/);
    assert.doesNotMatch(actions, /console\.(log|info|debug|warn|error)/);
    assert.doesNotMatch(actions, /from\("continuum_/);
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /client-memory\/ask|askConcierge|listCurrentBirthdaysByMonth/);
    }
  });
});
