import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../../..");

function walkFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, found);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      found.push(path);
    }
  }
  return found;
}

describe("Human intake candidate security", () => {
  it("does not write canonical memory, Open Jobs, kernel, or mint Persons", () => {
    for (const file of walkFiles(DIR)) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /createProjectJob|addManualNote|correctProjectSpec/);
      assert.doesNotMatch(source, /insertPersonProfile|createPersonAtomic/);
      assert.doesNotMatch(source, /insertEvent|insertEvidence|insertObservation/);
      assert.doesNotMatch(source, /openai|anthropic|generateText/i);
      assert.doesNotMatch(source, /continuum_commitments/);
      assert.doesNotMatch(source, /applyFounderReview|applyReview\(/);
    }
  });

  it("does not attach candidate generation to public API routes", () => {
    const api = resolve(ROOT, "app/api");
    function walk(dir: string, found: string[] = []): string[] {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path, found);
        else if (entry.name.endsWith(".ts")) found.push(path);
      }
      return found;
    }
    for (const file of walk(api)) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /proposeHumanIntakeCandidates|ingestHumanIntakeCandidates/);
    }
  });
});
