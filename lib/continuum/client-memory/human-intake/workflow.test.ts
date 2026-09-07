import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONCIERGE = join(ROOT, "app", "executive-dashboard", "concierge");

describe("PLAUD daily intake workflow", () => {
  it("stores the source before any candidate proposal and never auto-approves", () => {
    const actions = readFileSync(join(CONCIERGE, "actions.ts"), "utf8");
    const saveFn = actions.slice(
      actions.indexOf("export async function savePlaudHumanSource"),
      actions.indexOf("function capturedAtFromForm"),
    );
    const ingestIdx = saveFn.indexOf("auth.store.ingest");
    assert.ok(ingestIdx > 0);
    assert.doesNotMatch(saveFn, /extractCandidates/);
    assert.doesNotMatch(saveFn, /ingestHumanEvidenceCandidates/);
    assert.doesNotMatch(saveFn, /reviewIntakeCandidate\(/);
    assert.doesNotMatch(saveFn, /applyFounderReview|applyReview\(/);
    assert.doesNotMatch(saveFn, /action:\s*"approve"/);
    assert.match(saveFn, /shared #18 parser/);
  });

  it("keeps ingest on one founder-private path and uses shared founder review", () => {
    const form = readFileSync(
      join(CONCIERGE, "components", "add-plaud-form.tsx"),
      "utf8",
    );
    assert.match(form, /Ingest source/);
    const create = readFileSync(join(CONCIERGE, "inbox", "new", "page.tsx"), "utf8");
    assert.match(create, /stores the source/);
    assert.match(create, /founder review/);
    const detail = readFileSync(
      join(CONCIERGE, "inbox", "[sourceId]", "page.tsx"),
      "utf8",
    );
    assert.match(detail, /Another PLAUD/);
    assert.match(detail, /Another reMarkable/);
    assert.match(detail, /IntakeCandidateReviewList/);
    assert.match(detail, /ingestHumanEvidenceCandidates/);
    assert.match(detail, /getAuthenticatedCandidateStore/);
    assert.doesNotMatch(detail, /InMemoryCandidateStore/);
    assert.doesNotMatch(detail, /extractCandidates/);
    assert.doesNotMatch(detail, /openai|anthropic/i);
  });
});
