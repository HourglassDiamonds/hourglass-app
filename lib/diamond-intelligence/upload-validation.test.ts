import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectUploadKindFromBytes,
  validateDiamondIntelligenceUpload,
} from "./upload-validation";

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PDF_HEADER = Buffer.from("%PDF-1.4\n", "ascii");

describe("validateDiamondIntelligenceUpload", () => {
  it("accepts valid PDF uploads with matching MIME and extension", () => {
    const result = validateDiamondIntelligenceUpload({
      bytes: PDF_HEADER,
      declaredMime: "application/pdf",
      sourceFilename: "report.pdf",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mime, "application/pdf");
      assert.equal(result.detectedKind, "pdf");
    }
  });

  it("accepts valid JPEG uploads", () => {
    const result = validateDiamondIntelligenceUpload({
      bytes: JPEG_HEADER,
      declaredMime: "image/jpeg",
      sourceFilename: "report.jpg",
    });
    assert.equal(result.ok, true);
  });

  it("accepts valid PNG uploads", () => {
    const result = validateDiamondIntelligenceUpload({
      bytes: PNG_HEADER,
      declaredMime: "image/png",
      sourceFilename: "report.png",
    });
    assert.equal(result.ok, true);
  });

  it("rejects empty files", () => {
    const result = validateDiamondIntelligenceUpload({
      bytes: Buffer.alloc(0),
      declaredMime: "application/pdf",
      sourceFilename: "report.pdf",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "empty_file");
  });

  it("rejects blocked extensions such as svg and zip", () => {
    for (const filename of ["report.svg", "archive.zip", "payload.exe"]) {
      const result = validateDiamondIntelligenceUpload({
        bytes: PDF_HEADER,
        declaredMime: "application/pdf",
        sourceFilename: filename,
      });
      assert.equal(result.ok, false, filename);
    }
  });

  it("rejects webp even when MIME is spoofed", () => {
    const result = validateDiamondIntelligenceUpload({
      bytes: PDF_HEADER,
      declaredMime: "image/webp",
      sourceFilename: "report.webp",
    });
    assert.equal(result.ok, false);
  });

  it("accepts PDF bytes when the browser sends an empty or octet-stream MIME", () => {
    for (const declaredMime of ["", "application/octet-stream"]) {
      const result = validateDiamondIntelligenceUpload({
        bytes: PDF_HEADER,
        declaredMime,
        sourceFilename: "7496507350.pdf",
      });
      assert.equal(result.ok, true, declaredMime || "(empty)");
      if (result.ok) {
        assert.equal(result.mime, "application/pdf");
        assert.equal(result.detectedKind, "pdf");
      }
    }
  });

  it("rejects MIME/content mismatches", () => {
    const result = validateDiamondIntelligenceUpload({
      bytes: PDF_HEADER,
      declaredMime: "image/png",
      sourceFilename: "report.png",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "mime_content_mismatch");
  });

  it("rejects unknown binary content", () => {
    const result = validateDiamondIntelligenceUpload({
      bytes: Buffer.from("not a report", "utf8"),
      declaredMime: "application/pdf",
      sourceFilename: "report.pdf",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unknown_binary");
  });
});

describe("detectUploadKindFromBytes", () => {
  it("detects pdf, jpeg, and png signatures", () => {
    assert.equal(detectUploadKindFromBytes(PDF_HEADER), "pdf");
    assert.equal(detectUploadKindFromBytes(JPEG_HEADER), "jpeg");
    assert.equal(detectUploadKindFromBytes(PNG_HEADER), "png");
  });
});
