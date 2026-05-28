import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CalibrationTimeoutError,
  readImageDimensionsFromBuffer,
  validateCalibrationUpload,
  withTimeout,
} from "./runtime-guard";
import { MAX_IMAGE_DIMENSION_PX, MAX_UPLOAD_BYTES } from "./runtime-limits";

test("withTimeout rejects slow operations", async () => {
  await assert.rejects(
    () =>
      withTimeout(
        new Promise<string>((resolve) => {
          setTimeout(() => resolve("late"), 500);
        }),
        30,
        "test-slow-op",
      ),
    (err: unknown) => err instanceof CalibrationTimeoutError,
  );
});

test("withTimeout resolves fast operations", async () => {
  const value = await withTimeout(Promise.resolve("ok"), 500, "test-fast-op");
  assert.equal(value, "ok");
});

test("validateCalibrationUpload rejects oversized buffer", async () => {
  const huge = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
  const result = await validateCalibrationUpload(huge, "application/pdf");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "upload_too_large");
});

test("validateCalibrationUpload rejects oversized PNG dimensions", async () => {
  const w = MAX_IMAGE_DIMENSION_PX + 100;
  const h = 100;
  const buf = Buffer.alloc(24);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf.writeUInt32BE(w, 16);
  buf.writeUInt32BE(h, 20);
  const result = await validateCalibrationUpload(buf, "image/png");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "image_dimensions_exceeded");
});

test("readImageDimensionsFromBuffer reads PNG header", () => {
  const buf = Buffer.alloc(24);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf.writeUInt32BE(800, 16);
  buf.writeUInt32BE(600, 20);
  const dims = readImageDimensionsFromBuffer(buf);
  assert.deepEqual(dims, { width: 800, height: 600 });
});
