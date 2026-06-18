import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DiamondIntelligenceUploadError,
  parseRetryAfterHeader,
  resolveInterpretUploadFailure,
} from "./client-upload";
import { createMinimalBmpBuffer } from "./test-bmp-fixture";
import { DI_UNSUPPORTED_FILE_TYPE_MESSAGE } from "./upload-format-policy";
import { normalizeDiamondIntelligenceUpload } from "./upload-normalize";
import { validateDiamondIntelligenceUpload } from "./upload-validation";

describe("unsupported upload format policy", () => {
  it("normalizes BMP then passes validation with consumer-safe pipeline input", async () => {
    const bmp = await createMinimalBmpBuffer(16, 16);

    const normalized = await normalizeDiamondIntelligenceUpload({
      bytes: bmp,
      declaredMime: "image/bmp",
      sourceFilename: "3436a87e-7086-4e81-b77d-45ad7f9f97f1.bmp",
    });

    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;

    const result = validateDiamondIntelligenceUpload({
      bytes: normalized.bytes,
      declaredMime: normalized.mime,
      sourceFilename: normalized.sourceFilename,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mime, "image/png");
    }
  });

  it("rejects corrupt BMP during normalization with consumer format copy", async () => {
    const corrupt = Buffer.alloc(54);
    corrupt.write("BM", 0, "ascii");

    const normalized = await normalizeDiamondIntelligenceUpload({
      bytes: corrupt,
      declaredMime: "image/bmp",
      sourceFilename: "3436a87e-7086-4e81-b77d-45ad7f9f97f1.bmp",
    });

    assert.equal(normalized.ok, false);
    if (!normalized.ok) {
      assert.equal(normalized.code, "unknown_binary");
      assert.equal(normalized.error, DI_UNSUPPORTED_FILE_TYPE_MESSAGE);
    }
  });

  it("maps API 400 blocked_extension to unsupported_format client error", () => {
    const err = resolveInterpretUploadFailure(400, {
      ok: false,
      code: "blocked_extension",
      error: DI_UNSUPPORTED_FILE_TYPE_MESSAGE,
    });

    assert.ok(err instanceof DiamondIntelligenceUploadError);
    assert.equal(err.kind, "unsupported_format");
    assert.equal(err.code, "blocked_extension");
    assert.equal(err.message, DI_UNSUPPORTED_FILE_TYPE_MESSAGE);
  });

  it("maps API 422 interpret failure to generic interpret error", () => {
    const err = resolveInterpretUploadFailure(422, {
      ok: false,
      error: "We couldn't read enough from this file to build a useful interpretation.",
    });

    assert.ok(!(err instanceof DiamondIntelligenceUploadError));
    assert.match(err.message, /couldn't read enough/i);
  });

  it("parses Retry-After header seconds for rate-limit UI", () => {
    assert.equal(parseRetryAfterHeader("38"), 38);
    assert.equal(parseRetryAfterHeader(" 12 "), 12);
    assert.equal(parseRetryAfterHeader(""), undefined);
    assert.equal(parseRetryAfterHeader("abc"), undefined);
  });
});
