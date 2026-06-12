import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDiamondIntelligenceResultState } from "./diamond-intelligence-result-state";

describe("resolveDiamondIntelligenceResultState", () => {
  it("returns PROCESSING while upload phases are active", () => {
    for (const uploadPhase of ["reading", "checking", "building"] as const) {
      assert.equal(
        resolveDiamondIntelligenceResultState({
          uploadPhase,
          uploadError: null,
          hasReport: true,
          partialListing: false,
          v3RenderPhase: "full",
          canRenderFullResult: true,
        }),
        "PROCESSING",
      );
    }
  });

  it("returns ERROR for upload failures without rendering prior success", () => {
    assert.equal(
      resolveDiamondIntelligenceResultState({
        uploadPhase: "error",
        uploadError: "Upload failed",
        hasReport: false,
        partialListing: false,
        v3RenderPhase: "empty",
        canRenderFullResult: false,
      }),
      "ERROR",
    );
  });

  it("returns PARTIAL for grade-completion flow", () => {
    assert.equal(
      resolveDiamondIntelligenceResultState({
        uploadPhase: "idle",
        uploadError: null,
        hasReport: true,
        partialListing: false,
        v3RenderPhase: "partial",
        canRenderFullResult: false,
      }),
      "PARTIAL",
    );
  });

  it("returns SUCCESS only when full result can render", () => {
    assert.equal(
      resolveDiamondIntelligenceResultState({
        uploadPhase: "idle",
        uploadError: null,
        hasReport: true,
        partialListing: false,
        v3RenderPhase: "full",
        canRenderFullResult: true,
      }),
      "SUCCESS",
    );
  });

  it("returns ERROR when a loaded report cannot produce a full read", () => {
    assert.equal(
      resolveDiamondIntelligenceResultState({
        uploadPhase: "idle",
        uploadError: null,
        hasReport: true,
        partialListing: false,
        v3RenderPhase: "full",
        canRenderFullResult: false,
      }),
      "ERROR",
    );
  });

  it("returns NO_RESULT for empty and partial-listing states", () => {
    assert.equal(
      resolveDiamondIntelligenceResultState({
        uploadPhase: "idle",
        uploadError: null,
        hasReport: false,
        partialListing: true,
        v3RenderPhase: "empty",
        canRenderFullResult: false,
      }),
      "NO_RESULT",
    );
  });
});
