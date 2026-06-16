import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIENT_RATE_LIMIT_ERROR,
  DiamondIntelligenceUploadError,
  parseRetryAfterHeader,
  resolveInterpretUploadFailure,
} from "./client-upload";
import { DI_UNSUPPORTED_FILE_TYPE_MESSAGE } from "./upload-format-policy";
import { validateDiamondIntelligenceUpload } from "./upload-validation";

const BMP_HEADER = Buffer.alloc(54);
BMP_HEADER.write("BM", 0, "ascii");

describe("unsupported upload format policy", () => {
  it("rejects BMP with blocked_extension and consumer format copy", () => {
    const result = validateDiamondIntelligenceUpload({
      bytes: BMP_HEADER,
      declaredMime: "image/bmp",
      sourceFilename: "3436a87e-7086-4e81-b77d-45ad7f9f97f1.bmp",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "blocked_extension");
      assert.equal(result.error, DI_UNSUPPORTED_FILE_TYPE_MESSAGE);
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
