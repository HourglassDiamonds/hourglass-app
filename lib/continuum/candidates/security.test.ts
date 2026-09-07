import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { CANDIDATE_CONSUMER_CONTRACT } from "./present";
import { CANDIDATE_MUTATION_BOUNDARY, CANDIDATE_TYPES } from "./types";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../..");

function walk(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("candidate contract security", () => {
  it("exposes the consumer contract for later slices without writers", () => {
    assert.equal(CANDIDATE_CONSUMER_CONTRACT.contractVersion, "continuum-candidates-v1");
    assert.deepEqual([...CANDIDATE_CONSUMER_CONTRACT.types], [...CANDIDATE_TYPES]);
    assert.deepEqual([...CANDIDATE_CONSUMER_CONTRACT.states], ["active", "conflict", "superseded"]);
    assert.deepEqual([...CANDIDATE_CONSUMER_CONTRACT.reviewStatuses], [
      "pending",
      "approved",
      "discarded",
      "deferred",
    ]);
    assert.deepEqual([...CANDIDATE_CONSUMER_CONTRACT.reviewActions], [
      "approve",
      "edit",
      "discard",
      "defer",
    ]);
    assert.equal(CANDIDATE_CONSUMER_CONTRACT.reviewOwnedBy, "founder-review");
    assert.equal(CANDIDATE_CONSUMER_CONTRACT.stateOwnedBy, "source-adapter-and-lineage");
    assert.equal(CANDIDATE_CONSUMER_CONTRACT.brainGate, "pluggable-later");
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.canonical, false);
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.callsSpecWriter, false);
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.createsOpenJobs, false);
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.mutatesGmail, false);
  });

  it("does not log or write canonical / kernel rows", () => {
    for (const file of walk(DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /insertEvent|insertEvidence|insertObservation/);
      assert.doesNotMatch(source, /createPersonAtomic|insertSourceNote/);
      assert.doesNotMatch(source, /createProjectJob|applyProjectSpecCorrection/);
      assert.doesNotMatch(source, /GOOGLE_REFRESH_TOKEN|OPENAI|ANTHROPIC/);
    }
  });

  it("does not attach candidates to public API routes", () => {
    for (const file of walk(join(ROOT, "app/api"), ".ts")) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /continuum\/candidates/);
      assert.doesNotMatch(source, /proposeGmailCandidates/);
      assert.doesNotMatch(source, /InMemoryCandidateStore/);
    }
  });
});
