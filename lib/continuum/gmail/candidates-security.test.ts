import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const CANDIDATE_DIR = join(HERE, "candidates");
const CONTRACT_DIR = resolve(HERE, "../candidates");

function walk(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Gmail Candidate security", () => {
  it("does not fetch Gmail, write canonical state, or log secrets", () => {
    const files = [
      ...walk(CANDIDATE_DIR, ".ts"),
      ...walk(CONTRACT_DIR, ".ts"),
    ];
    assert.ok(files.length > 0);
    for (const file of files) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /correctProjectSpec|applyProjectSpecCorrection/);
      assert.doesNotMatch(source, /saveProjectKindCorrection|correctProjectKind/);
      assert.doesNotMatch(source, /createProjectJob|insertProjectJob/);
      assert.doesNotMatch(source, /editPersonProfile|createPersonAtomic/);
      assert.doesNotMatch(source, /runExactProjectThreadFetch|listMessages\(/);
      assert.doesNotMatch(source, /getThread\(|getMessage\(|getAttachment/);
      assert.doesNotMatch(source, /users\.messages\.send|gmail\.googleapis/);
      assert.doesNotMatch(source, /putCheckpoint|indexMessage/);
      assert.doesNotMatch(source, /OPENAI|ANTHROPIC|GOOGLE_API_KEY/);
      assert.doesNotMatch(source, /NEXT_PUBLIC_CONTINUUM_GMAIL/);
    }
    for (const file of walk(CANDIDATE_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /applyFounderReview|applyReview\(/);
    }
  });

  it("keeps the inspection surface internal and review-free", () => {
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail/candidates/page.tsx"),
      "utf8",
    );
    const warning = readFileSync(join(CANDIDATE_DIR, "dry-run.ts"), "utf8");
    assert.match(page, /Developer \/ internal/);
    assert.match(page, /GMAIL_CANDIDATE_DEV_WARNING/);
    assert.match(warning, /Not founder review/);
    assert.doesNotMatch(page, /\b(approve|discard)\b/i);
    assert.doesNotMatch(page, /runExactProjectThreadFetch|getThread\(/);
    assert.doesNotMatch(page, /formData|use server/i);
    assert.match(page, /robots: \{ index: false/);
  });

  it("does not attach candidate generation to public API routes", () => {
    const apiFiles = walk(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /proposeGmailCandidates|ingestGmailCandidates/);
      assert.doesNotMatch(source, /continuum\/candidates/);
    }
  });
});
