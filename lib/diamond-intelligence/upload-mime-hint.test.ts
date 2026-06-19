import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLikelyReportImageUpload } from "./upload-mime-hint";

describe("isLikelyReportImageUpload", () => {
  it("prefers normalizedMime over filename", () => {
    assert.equal(
      isLikelyReportImageUpload({
        normalizedMime: "image/png",
        fileName: "report.pdf",
      }),
      true,
    );
    assert.equal(
      isLikelyReportImageUpload({
        normalizedMime: "application/pdf",
        fileName: "IMG_4299.png",
      }),
      false,
    );
  });

  it("uses originalMime when normalizedMime is absent", () => {
    assert.equal(
      isLikelyReportImageUpload({
        originalMime: "image/bmp",
        mime: "application/octet-stream",
        fileName: "upload.dat",
      }),
      true,
    );
  });

  it("uses declared mime before filename extension", () => {
    assert.equal(
      isLikelyReportImageUpload({
        mime: "image/jpeg",
        fileName: "report.pdf",
      }),
      true,
    );
    assert.equal(
      isLikelyReportImageUpload({
        mime: "application/pdf",
        fileName: "IMG_4288.png",
      }),
      false,
    );
  });

  it("falls back to filename only when MIME is unavailable", () => {
    assert.equal(
      isLikelyReportImageUpload({
        fileName: "IMG_4299.png",
      }),
      true,
    );
    assert.equal(
      isLikelyReportImageUpload({
        fileName: "2504691249.pdf",
      }),
      false,
    );
  });

  it("falls back to filename when MIME is inconclusive", () => {
    assert.equal(
      isLikelyReportImageUpload({
        mime: "",
        fileName: "IMG_4289.jpeg",
      }),
      true,
    );
  });
});
