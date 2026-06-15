import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { V3_UNABLE_TO_VERIFY } from "./consumer-display-labels";

const componentPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "DiV3UnableToVerify.tsx",
);

describe("DiV3UnableToVerify failure state", () => {
  it("exports shared unable-to-verify headline constant", () => {
    assert.equal(
      V3_UNABLE_TO_VERIFY.headline,
      "We Couldn't Read This Report",
    );
  });

  it("renders the shared headline in the failure component", () => {
    const source = readFileSync(componentPath, "utf8");
    assert.match(source, /V3_UNABLE_TO_VERIFY\.headline/);
    assert.match(source, /Upload Another Report/);
    assert.match(source, /justinReviewCta/);
  });

  it("dashboard suppresses duplicate inline upload error when failure card shows", () => {
    const dashboardPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "LightPerformanceDashboard.tsx",
    );
    const source = readFileSync(dashboardPath, "utf8");
    assert.match(source, /shouldShowUploadInlineError/);
    assert.match(source, /uploadInlineError \? uploadError : null/);
    assert.match(source, /uploadErrorKind/);
    assert.match(source, /resultState === "ERROR"/);
    assert.doesNotMatch(
      source,
      /uploadErrorKind === "unsupported_format"[\s\S]*DiV3UnableToVerify/,
    );
  });

  it("does not render editorial failure card for unsupported file type", () => {
    const dashboardPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "LightPerformanceDashboard.tsx",
    );
    const source = readFileSync(dashboardPath, "utf8");
    assert.match(source, /\{resultState === "ERROR" \?/);
    assert.match(source, /uploadErrorKind/);
  });
});
