import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  V3_RATE_LIMITED,
  V3_UNABLE_TO_VERIFY,
} from "./consumer-display-labels";
import { resolveDiamondIntelligenceResultState } from "./diamond-intelligence-result-state";

const dashboardPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "LightPerformanceDashboard.tsx",
);

describe("Diamond Intelligence rate-limit UI", () => {
  it("maps rate_limited upload errors to RATE_LIMITED result state", () => {
    assert.equal(
      resolveDiamondIntelligenceResultState({
        uploadPhase: "error",
        uploadError: "Too many reports submitted. Please try again later.",
        uploadErrorKind: "rate_limited",
        hasReport: false,
        partialListing: false,
        v3RenderPhase: "empty",
        canRenderFullResult: false,
      }),
      "RATE_LIMITED",
    );
  });

  it("does not map interpret failures to RATE_LIMITED", () => {
    assert.equal(
      resolveDiamondIntelligenceResultState({
        uploadPhase: "error",
        uploadError: "We couldn't read enough from this file.",
        uploadErrorKind: "interpret_failure",
        hasReport: false,
        partialListing: false,
        v3RenderPhase: "empty",
        canRenderFullResult: false,
      }),
      "ERROR",
    );
  });

  it("renders dedicated rate-limit card instead of unable-to-verify", () => {
    const source = readFileSync(dashboardPath, "utf8");
    assert.match(source, /resultState === "RATE_LIMITED"/);
    assert.match(source, /<DiV3RateLimited/);
    assert.doesNotMatch(
      source,
      /uploadErrorKind === "rate_limited"[\s\S]*DiV3UnableToVerify/,
    );
  });

  it("exports distinct consumer copy for rate-limit headline", () => {
    assert.equal(V3_RATE_LIMITED.headline, "Please Wait a Moment");
    assert.notEqual(V3_RATE_LIMITED.headline, V3_UNABLE_TO_VERIFY.headline);
  });
});
