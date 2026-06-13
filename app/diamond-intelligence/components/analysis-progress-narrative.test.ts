import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYSIS_PROGRESS_LONG_DURATION_MS,
  ANALYSIS_PROGRESS_STATES,
  nextAnalysisProgressIndex,
  shouldShowLongDurationAnalysisMessage,
} from "./analysis-progress-narrative";

describe("analysis progress narrative", () => {
  it("cycles through all states in order", () => {
    const headlines = ANALYSIS_PROGRESS_STATES.map((state) => state.headline);
    let index = 0;

    for (let step = 0; step < ANALYSIS_PROGRESS_STATES.length; step += 1) {
      assert.equal(ANALYSIS_PROGRESS_STATES[index]?.headline, headlines[index]);
      index = nextAnalysisProgressIndex(index);
    }

    assert.equal(index, 0);
  });

  it("shows long-duration copy after thirty seconds", () => {
    assert.equal(shouldShowLongDurationAnalysisMessage(29_999), false);
    assert.equal(shouldShowLongDurationAnalysisMessage(30_000), true);
    assert.equal(shouldShowLongDurationAnalysisMessage(45_000), true);
  });

  it("defines four rotating states before long duration", () => {
    assert.equal(ANALYSIS_PROGRESS_STATES.length, 4);
    assert.equal(ANALYSIS_PROGRESS_LONG_DURATION_MS, 30_000);
  });
});
