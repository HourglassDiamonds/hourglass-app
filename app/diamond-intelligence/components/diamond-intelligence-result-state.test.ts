import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveDiamondIntelligenceResultState,
  shouldShowUploadInlineError,
} from "./diamond-intelligence-result-state";

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
        uploadErrorKind: "interpret_failure",
        hasReport: false,
        partialListing: false,
        v3RenderPhase: "empty",
        canRenderFullResult: false,
      }),
      "ERROR",
    );
  });

  it("returns LISTING_INACCESSIBLE for retailer access blocks", () => {
    assert.equal(
      resolveDiamondIntelligenceResultState({
        uploadPhase: "error",
        uploadError: "Listing returned HTTP 403.",
        uploadErrorKind: "listing_inaccessible",
        hasReport: false,
        partialListing: false,
        v3RenderPhase: "empty",
        canRenderFullResult: false,
      }),
      "LISTING_INACCESSIBLE",
    );
  });

  it("returns RATE_LIMITED for rate_limited upload failures", () => {
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

  it("returns UNSUPPORTED_REPORT_FORMAT for unsupported report format failures", () => {
    assert.equal(
      resolveDiamondIntelligenceResultState({
        uploadPhase: "error",
        uploadError:
          "This report format is not currently supported by Diamond Intelligence.",
        uploadErrorKind: "unsupported_report_format",
        hasReport: false,
        partialListing: false,
        v3RenderPhase: "empty",
        canRenderFullResult: false,
      }),
      "UNSUPPORTED_REPORT_FORMAT",
    );
  });

  it("suppresses upload inline error for unsupported report format card", () => {
    assert.equal(
      shouldShowUploadInlineError({
        resultState: "UNSUPPORTED_REPORT_FORMAT",
        errorMessage:
          "This report format is not currently supported by Diamond Intelligence.",
      }),
      false,
    );
  });

  it("returns NO_RESULT for unsupported file type so the dock shows format copy", () => {
    assert.equal(
      resolveDiamondIntelligenceResultState({
        uploadPhase: "error",
        uploadError:
          "This file type isn't supported yet. Please upload a PDF, JPG, or PNG image of the report.",
        uploadErrorKind: "unsupported_format",
        hasReport: false,
        partialListing: false,
        v3RenderPhase: "empty",
        canRenderFullResult: false,
      }),
      "NO_RESULT",
    );
  });

  it("shows inline upload error for unsupported file type", () => {
    assert.equal(
      shouldShowUploadInlineError({
        resultState: "NO_RESULT",
        errorMessage:
          "This file type isn't supported yet. Please upload a PDF, JPG, or PNG image of the report.",
      }),
      true,
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

  it("suppresses upload inline error when V3 failure card is active", () => {
    assert.equal(
      shouldShowUploadInlineError({
        resultState: "ERROR",
        errorMessage:
          "We couldn't read enough from this file to build a useful interpretation.",
      }),
      false,
    );
    assert.equal(
      shouldShowUploadInlineError({
        resultState: "RATE_LIMITED",
        errorMessage: "Too many reports submitted. Please try again later.",
      }),
      false,
    );
    assert.equal(
      shouldShowUploadInlineError({
        resultState: "LISTING_INACCESSIBLE",
        errorMessage: "Listing returned HTTP 403.",
      }),
      false,
    );
    assert.equal(
      shouldShowUploadInlineError({
        resultState: "NO_RESULT",
        errorMessage: "Upload failed",
      }),
      true,
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
