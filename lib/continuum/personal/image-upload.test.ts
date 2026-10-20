import assert from "node:assert/strict";
import test from "node:test";
import { detectedImageType, PERFORMANCE_IMAGE_ACCEPT, performanceImageMessage } from "./image-upload";

test("content signatures identify supported images instead of trusting filenames", () => {
  assert.equal(detectedImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectedImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectedImageType(new TextEncoder().encode("GIF89a")), "image/gif");
  assert.equal(detectedImageType(new TextEncoder().encode("RIFFxxxxWEBP")), "image/webp");
  assert.equal(detectedImageType(Uint8Array.from([0, 0, 0, 24, ...new TextEncoder().encode("ftypheic")])), "image/heic");
  assert.equal(detectedImageType(new TextEncoder().encode("not-an-image")), undefined);
});

test("iPhone types are selectable and failures remain distinct", () => {
  assert.match(PERFORMANCE_IMAGE_ACCEPT, /image\/heic/);
  assert.match(PERFORMANCE_IMAGE_ACCEPT, /\.heif/);
  assert.match(performanceImageMessage(new Error("unsupported-format")), /Unsupported photo format/);
  assert.match(performanceImageMessage(new Error("file-too-large")), /too large/);
  assert.match(performanceImageMessage(new Error("conversion-failed")), /could not be converted/);
  assert.match(performanceImageMessage(new Error("upload-failed")), /could not be uploaded/);
  assert.match(performanceImageMessage(new Error("extraction-failed")), /could not read/);
});
