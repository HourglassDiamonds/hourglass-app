import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const ROOT = join(process.cwd(), "app", "executive-dashboard", "concierge");

function read(...parts: string[]) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

describe("Sterling founder review UI", () => {
  it("keeps recommendations inline with four direct founder actions and no selection checkbox", () => {
    const answer = read("components", "ask-concierge-answer.tsx");
    const controls = read("components", "sterling-proposal-controls.tsx");
    assert.match(answer, /data-sterling-inline-proposal/);
    assert.doesNotMatch(answer, /Review proposed mutation/);
    for (const label of ["Approve", "Edit", "Defer", "Dismiss"]) {
      assert.match(controls, new RegExp(`>${label}<`));
    }
    assert.doesNotMatch(controls, /type="checkbox"|Save selected|Draft Only/i);
  });

  it("shows immediate, slow, successful, and recoverable failure states", () => {
    const controls = read("components", "sterling-proposal-controls.tsx");
    assert.match(controls, /Approving…/);
    assert.match(controls, /Deferring…/);
    assert.match(controls, /Dismissing…/);
    assert.match(controls, /taking longer than usual; retry protection is active/);
    assert.match(controls, /data-sterling-action-complete/);
    assert.match(controls, /You can retry safely/);
  });

  it("keeps the save action free of model calls and current-route revalidation", () => {
    const action = read("sterling-proposal-actions.ts");
    assert.doesNotMatch(action, /revalidatePath|runSterling|reasoningBrain|\.complete\(/);
    assert.match(action, /dependenciesMs/);
    assert.match(action, /reviewTiming/);
    assert.match(action, /SterlingApprovalService/);
  });
});
