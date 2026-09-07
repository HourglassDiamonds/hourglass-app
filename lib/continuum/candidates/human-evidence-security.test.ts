import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../..");
const CONCIERGE = join(ROOT, "app", "executive-dashboard", "concierge");

function walk(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("human evidence adapter security", () => {
  it("never calls founder review or writes canonical / kernel / CRM state", () => {
    const files = [
      join(DIR, "human-evidence.ts"),
      join(DIR, "human-evidence-source-ref.ts"),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /applyFounderReview|applyReview\(/);
      assert.doesNotMatch(source, /reviewIntakeCandidate|action:\s*"approve"/);
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /insertEvent|insertEvidence|insertObservation/);
      assert.doesNotMatch(source, /createPersonAtomic|insertSourceNote|editPersonProfile/);
      assert.doesNotMatch(source, /createProjectJob|applyProjectSpecCorrection/);
      assert.doesNotMatch(source, /saveProjectKindCorrection|setProjectLifecycle/);
      assert.doesNotMatch(source, /composeChiefOfStaffBrief|continuum_commitments/);
      assert.doesNotMatch(source, /openai|anthropic|tesseract/i);
      assert.doesNotMatch(source, /extractPdfTextLayer|diamond-intelligence/i);
      assert.doesNotMatch(source, /remarkable\.cloud|my\.remarkable/i);
      assert.doesNotMatch(source, /users\.messages\.send|gmail\.googleapis/);
      assert.doesNotMatch(source, /OPENAI|ANTHROPIC|GOOGLE_API_KEY/);
    }
  });

  it("does not attach PLAUD or reMarkable candidate generation to public APIs", () => {
    for (const file of walk(join(ROOT, "app/api"), ".ts")) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /ingestHumanEvidenceCandidates/);
      assert.doesNotMatch(source, /proposeHumanEvidenceCandidates/);
      assert.doesNotMatch(source, /saveRemarkableHumanSource/);
      assert.doesNotMatch(source, /savePlaudHumanSource/);
    }
  });

  it("keeps concierge save actions off review, OCR, and communication send", () => {
    const actions = readFileSync(join(CONCIERGE, "actions.ts"), "utf8");
    const savePlaud = actions.slice(
      actions.indexOf("export async function savePlaudHumanSource"),
      actions.indexOf("function capturedAtFromForm"),
    );
    const saveRemarkable = actions.slice(
      actions.indexOf("export async function saveRemarkableHumanSource"),
    );
    for (const source of [savePlaud, saveRemarkable]) {
      assert.match(source, /auth\.store\.ingest/);
      assert.doesNotMatch(source, /extractCandidates/);
      assert.doesNotMatch(source, /ingestHumanEvidenceCandidates/);
      assert.doesNotMatch(source, /applyFounderReview|applyReview\(/);
      assert.doesNotMatch(source, /reviewIntakeCandidate|action:\s*"approve"/);
      assert.doesNotMatch(source, /createPersonAtomic|insertSourceNote/);
      assert.doesNotMatch(source, /tesseract|extractPdfTextLayer/i);
    }
    assert.doesNotMatch(actions, /openai|anthropic|my\.remarkable/i);
    assert.doesNotMatch(actions, /users\.messages\.send/);
  });
});
