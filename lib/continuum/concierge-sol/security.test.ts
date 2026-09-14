import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { CONCIERGE_WRITE_TOOL_NAMES } from "./tools";
import { CONCIERGE_FOREGROUND_BRAIN, conciergeForegroundModel } from "./models";

const DIR = dirname(fileURLToPath(import.meta.url));

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) found.push(path);
  }
  return found;
}

describe("Concierge Sol security", () => {
  it("keeps Sol interchangeable and forbids Astra, SQL, and canonical writes", () => {
    assert.equal(CONCIERGE_FOREGROUND_BRAIN, "sol");
    assert.equal(conciergeForegroundModel("gpt-astra-mini"), "gpt-5.6-sol");
    assert.equal(conciergeForegroundModel("gpt-5.6"), "gpt-5.6-sol");
    assert.equal(conciergeForegroundModel(), "gpt-5.6-sol");
    assert.deepEqual([...CONCIERGE_WRITE_TOOL_NAMES], []);
    for (const file of walk(DIR)) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      if (file.endsWith("models.ts")) {
        assert.match(source, /CONCIERGE_FOREGROUND_MODEL/);
        continue;
      }
      assert.doesNotMatch(source, /\bastra\b/i);
      assert.doesNotMatch(source, /from\("continuum_/);
      assert.doesNotMatch(source, /\.insert\(|\.upsert\(/);
      assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|GOOGLE_REFRESH_TOKEN/);
    }
  });

  it("keeps the Ask client off the OpenAI key and raw SQL", () => {
    const root = join(DIR, "../../..");
    const shell = readFileSync(
      join(root, "app/executive-dashboard/concierge/components/ask-concierge-shell.tsx"),
      "utf8",
    );
    const answer = readFileSync(
      join(root, "app/executive-dashboard/concierge/components/ask-concierge-answer.tsx"),
      "utf8",
    );
    assert.doesNotMatch(shell, /OPENAI_API_KEY|chat\.completions|\/v1\/responses|gpt-5\.6/);
    assert.doesNotMatch(answer, /OPENAI_API_KEY|promptTokens|toolNames/);
    assert.doesNotMatch(shell, /from\("continuum_/);
  });
});
