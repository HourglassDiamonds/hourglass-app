import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("Sterling founder-controlled approval interface", () => {
  it("keeps the actionable workflow founder-authenticated and Preview-only", () => {
    const load = read("lib/continuum/today-sterling/canonical-approval-load.ts");
    const action = read("app/executive-dashboard/concierge/sterling-today/approval-actions.ts");
    assert.match(load, /requireInternalClientMemorySession/);
    assert.match(load, /isVerifiedSterlingTodayPreviewRuntime/);
    assert.match(action, /getAuthenticatedCanonicalApprovalReviewAccess/);
    assert.match(action, /expectedRecordVersion/);
    assert.doesNotMatch(action, /CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED|isSterlingTodayPreviewPublisherEnabled/);
  });

  it("shows exact identity, state, evidence, versions, ambiguity, and explicit decisions", () => {
    const page = read("app/executive-dashboard/concierge/sterling-today/page.tsx");
    for (const label of [
      "Canonical identities",
      "Existing canonical state",
      "Proposed precise changes",
      "Reasoning and provenance",
      "Ambiguity and missing evidence",
      "Approve and apply once",
      "Reject · no canonical change",
    ]) assert.match(page, new RegExp(label));
    assert.match(page, /Viewing a proposal never changes canonical records/);
    assert.match(page, /Review\/defer is unavailable/);
  });

  it("guards exact replay and rejection with payload and record-version comparisons", () => {
    const repository = read("lib/continuum/today-sterling/canonical-approval-repository.ts");
    const action = read("app/executive-dashboard/concierge/sterling-today/approval-actions.ts");
    assert.match(repository, /stableJson\(current\.approvedPayload\) === stableJson\(payload\)/);
    assert.match(repository, /approval-idempotency-conflict/);
    assert.match(repository, /\.eq\("record_version", input\.expectedRecordVersion\)/);
    assert.match(repository, /rejection-idempotency-conflict/);
    assert.match(action, /approved-pending-execution/);
    const page = read("app/executive-dashboard/concierge/sterling-today/page.tsx");
    assert.match(page, /Founder approval was recorded durably/);
  });

  it("documents synthetic-only shared Preview fixtures as a separately authorized gate", () => {
    const plan = read("docs/sterling/founder-controlled-preview-acceptance.md");
    for (const acceptanceCase of [
      "CAD/Design waiting on vendor",
      "In Production",
      "Completed/resolved",
      "Cancelled/superseded",
      "Exact-source suppression",
      "Ambiguous identity",
      "Stale approval",
      "Duplicate replay",
    ]) assert.match(plan, new RegExp(acceptanceCase));
    assert.match(plan, /No shared Preview fixture rows are authorized/);
    assert.match(plan, /CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED` off/);
  });
});
