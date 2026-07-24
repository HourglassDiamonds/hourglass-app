import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { activateClientBundledTesseractRuntime } from "@/lib/diamond-intelligence/client-tesseract-runtime";
import {
  getOcrRuntimeProbeSnapshot,
  isOcrRuntimeAvailable,
  setTesseractWorkerCreateOptions,
} from "./ocr";
import { tesseractWorkerCreateOptions } from "./tesseract-runtime-paths";

const originalFetch = globalThis.fetch;
const originalWorkerUrl = process.env.OCR_WORKER_URL;
const originalWorkerSecret = process.env.OCR_WORKER_SECRET;
const originalOcrDisabled = process.env.CALIBRATION_OCR_DISABLED;

describe("ocr remote → local fallback", () => {
  beforeEach(() => {
    process.env.OCR_WORKER_URL = "http://ocr-worker.test";
    process.env.OCR_WORKER_SECRET = "test-secret";
    delete process.env.CALIBRATION_OCR_DISABLED;
    setTesseractWorkerCreateOptions(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalWorkerUrl === undefined) {
      delete process.env.OCR_WORKER_URL;
    } else {
      process.env.OCR_WORKER_URL = originalWorkerUrl;
    }
    if (originalWorkerSecret === undefined) {
      delete process.env.OCR_WORKER_SECRET;
    } else {
      process.env.OCR_WORKER_SECRET = originalWorkerSecret;
    }
    if (originalOcrDisabled === undefined) {
      delete process.env.CALIBRATION_OCR_DISABLED;
    } else {
      process.env.CALIBRATION_OCR_DISABLED = originalOcrDisabled;
    }
    setTesseractWorkerCreateOptions(null);
  });

  it("falls back to bundled local Tesseract when remote health returns 404", async () => {
    globalThis.fetch = async () =>
      new Response("not found", { status: 404 });

    activateClientBundledTesseractRuntime();
    setTesseractWorkerCreateOptions(tesseractWorkerCreateOptions());

    const available = await isOcrRuntimeAvailable();
    const snap = getOcrRuntimeProbeSnapshot();

    assert.equal(available, true);
    assert.equal(snap.available, true);
    assert.equal(snap.transport, "local");
    assert.match(String(snap.error ?? ""), /remote-ocr-unavailable/);
    assert.ok(
      (snap.log ?? []).some((entry) =>
        entry.includes("remote-ocr-fallback-local"),
      ),
    );
  });

  it("uses remote transport when remote health is ok", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          available: true,
          workerWarm: true,
          lang: "eng",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    activateClientBundledTesseractRuntime();
    const available = await isOcrRuntimeAvailable();
    const snap = getOcrRuntimeProbeSnapshot();

    assert.equal(available, true);
    assert.equal(snap.transport, "remote");
    assert.equal(snap.error, undefined);
  });
});
