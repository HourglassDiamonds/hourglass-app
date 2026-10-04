import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  isTodayItemVisible,
  transitionTodayMutationPhase,
  type TodayMutationPhase,
} from "../../../../app/executive-dashboard/concierge/components/today-optimistic-state";

const ROOT = process.cwd();

describe("Today optimistic mutation UX", () => {
  it("hides three independently submitted rows before persistence settles", () => {
    const phases: Record<string, TodayMutationPhase> = {
      A: "visible",
      B: "visible",
      C: "visible",
    };
    for (const id of Object.keys(phases)) {
      phases[id] = transitionTodayMutationPhase(phases[id], { type: "begin" });
      assert.equal(isTodayItemVisible(phases[id]), false);
    }
    phases.A = transitionTodayMutationPhase(phases.A, { type: "succeed" });
    phases.B = transitionTodayMutationPhase(phases.B, { type: "succeed" });
    phases.C = transitionTodayMutationPhase(phases.C, { type: "succeed" });
    assert.deepEqual(phases, { A: "settled", B: "settled", C: "settled" });
  });

  it("rolls back only the failed row and supports retry", () => {
    const phases: Record<string, TodayMutationPhase> = {
      A: "pending",
      B: "pending",
      C: "pending",
    };
    phases.B = transitionTodayMutationPhase(phases.B, { type: "fail" });
    assert.equal(isTodayItemVisible(phases.A), false);
    assert.equal(isTodayItemVisible(phases.B), true);
    assert.equal(isTodayItemVisible(phases.C), false);
    phases.B = transitionTodayMutationPhase(phases.B, { type: "begin" });
    assert.equal(isTodayItemVisible(phases.B), false);
  });

  it("contains mutation failures below the workspace error boundary", () => {
    const action = readFileSync(join(
      ROOT,
      "app/executive-dashboard/concierge/cos-operating-loop-actions.ts",
    ), "utf8");
    const optimistic = readFileSync(join(
      ROOT,
      "app/executive-dashboard/concierge/components/today-optimistic-item.tsx",
    ), "utf8");
    assert.doesNotMatch(action, /redirect\(CONCIERGE_HOME_PATH/);
    assert.doesNotMatch(action, /throw new Error/);
    assert.match(action, /TodayMutationResult/);
    assert.match(optimistic, /data-today-mutation-failure/);
    assert.match(optimistic, />\s*Retry\s*</);
    assert.match(optimistic, /catch \{/);
    assert.match(action, /revalidatePath\(CONCIERGE_HOME_PATH\)/);
  });

  it("keeps mutation controls mobile reachable", () => {
    const optimistic = readFileSync(join(
      ROOT,
      "app/executive-dashboard/concierge/components/today-optimistic-item.tsx",
    ), "utf8");
    const actions = readFileSync(join(
      ROOT,
      "app/executive-dashboard/concierge/components/cos-docket-actions.tsx",
    ), "utf8");
    assert.match(optimistic, /min-h-11/);
    assert.match(actions, /min-h-11/);
  });

  it("uses the same optimistic hide, restore, and retry path for row directives", () => {
    const ask = readFileSync(join(
      ROOT,
      "app/executive-dashboard/concierge/components/cos-ask-concierge.tsx",
    ), "utf8");
    const optimistic = readFileSync(join(
      ROOT,
      "app/executive-dashboard/concierge/components/today-optimistic-item.tsx",
    ), "utf8");
    assert.match(ask, /beginDirective\(\)/);
    assert.match(ask, /founderDirectiveStatus/);
    assert.match(ask, /succeedDirective\(\)/);
    assert.match(ask, /restoreDirective\(\)/);
    assert.match(ask, /failDirective\(text, submit\)/);
    assert.match(optimistic, /kind: "directive"/);
  });
});
