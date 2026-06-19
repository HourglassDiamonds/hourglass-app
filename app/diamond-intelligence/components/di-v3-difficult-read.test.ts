import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  V3_FANCY_COLOR_GUIDANCE,
  V3_PARTIAL_SCREENSHOT_CLARITY,
  V3_UNABLE_TO_VERIFY_IMAGE,
} from "./consumer-display-labels";
import { isLikelyReportImageUpload } from "./di-v3-upload-hints";

const partialPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "DiV3PartialGradeReview.tsx",
);
const unablePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "DiV3UnableToVerify.tsx",
);
const dashboardPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "LightPerformanceDashboard.tsx",
);

describe("difficult screenshot consumer clarity", () => {
  it("exports partial screenshot clarity copy without technical jargon", () => {
    assert.match(V3_PARTIAL_SCREENSHOT_CLARITY.body, /Phone screenshots/i);
    assert.doesNotMatch(V3_PARTIAL_SCREENSHOT_CLARITY.body, /OCR|parser|gradeHints/i);
    assert.match(V3_PARTIAL_SCREENSHOT_CLARITY.followUp, /PDF/i);
  });

  it("exports image-specific unable-to-verify copy", () => {
    assert.match(V3_UNABLE_TO_VERIFY_IMAGE.body, /screenshot/i);
    assert.match(V3_UNABLE_TO_VERIFY_IMAGE.followUp, /Concierge/i);
  });

  it("exports fancy color guidance without D-Z color prompt language", () => {
    assert.match(V3_FANCY_COLOR_GUIDANCE.body, /fancy color/i);
    assert.match(V3_FANCY_COLOR_GUIDANCE.body, /D–Z|D-Z/);
    assert.doesNotMatch(V3_FANCY_COLOR_GUIDANCE.body, /Select color/i);
  });

  it("partial grade review renders screenshot clarity above manual fields", () => {
    const source = readFileSync(partialPath, "utf8");
    assert.match(source, /DiV3PartialScreenshotClarity/);
    assert.match(
      source,
      /incompleteCopy\.subhead[\s\S]*DiV3PartialScreenshotClarity[\s\S]*incompleteCopy\.sectionHeadline/,
    );
  });

  it("unable-to-verify supports difficult image variant", () => {
    const source = readFileSync(unablePath, "utf8");
    assert.match(source, /difficultImageRead/);
    assert.match(source, /V3_UNABLE_TO_VERIFY_IMAGE/);
  });

  it("dashboard passes difficult image flag from MIME hint state", () => {
    const source = readFileSync(dashboardPath, "utf8");
    assert.match(source, /difficultImageUnableToVerify/);
    assert.match(source, /uploadMimeHint/);
    assert.match(source, /normalizedMime: uploadMimeHint/);
    assert.match(source, /DiV3FancyColorGuidance/);
  });

  it("detects likely report image uploads by MIME with filename fallback", () => {
    assert.equal(
      isLikelyReportImageUpload({ normalizedMime: "image/png" }),
      true,
    );
    assert.equal(
      isLikelyReportImageUpload({ mime: "application/pdf" }),
      false,
    );
    assert.equal(isLikelyReportImageUpload({ fileName: "IMG_4299.png" }), true);
    assert.equal(isLikelyReportImageUpload({ fileName: "report.pdf" }), false);
  });
});
