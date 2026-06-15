import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

const originalFetch = globalThis.fetch;
const originalWorkerUrl = process.env.OCR_WORKER_URL;
const originalWorkerSecret = process.env.OCR_WORKER_SECRET;

beforeEach(() => {
  process.env.OCR_WORKER_URL = "http://ocr-worker.test";
  process.env.OCR_WORKER_SECRET = "test-secret";
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
});

test("isRemoteOcrConfigured reflects OCR_WORKER_URL", async () => {
  const { isRemoteOcrConfigured } = await import("./ocr-transport.ts");
  assert.equal(isRemoteOcrConfigured(), true);
  delete process.env.OCR_WORKER_URL;
  assert.equal(isRemoteOcrConfigured(), false);
});

test("remoteOcrRuntimeAvailable returns true on healthy worker", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "http://ocr-worker.test/health");
    assert.equal(init?.method, "GET");
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer test-secret",
    );
    return new Response(
      JSON.stringify({ ok: true, available: true, workerWarm: true, lang: "eng" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const { remoteOcrRuntimeAvailable } = await import("./ocr-transport.ts");
  assert.equal(await remoteOcrRuntimeAvailable(), true);
});

test("remoteOcrRuntimeAvailable returns false when worker unavailable", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true, available: false, workerWarm: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const { remoteOcrRuntimeAvailable } = await import("./ocr-transport.ts");
  assert.equal(await remoteOcrRuntimeAvailable(), false);
});

test("remoteOcrImageBuffer posts PNG base64 and returns text", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "http://ocr-worker.test/recognize");
    assert.equal(init?.method, "POST");
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer test-secret");
    assert.equal(headers["Content-Type"], "application/json");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.mime, "image/png");
    assert.equal(body.lang, "eng");
    assert.equal(body.imageBase64, Buffer.from("hello").toString("base64"));
    return new Response(JSON.stringify({ ok: true, text: "  TABLE 57  ", durationMs: 42 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const { remoteOcrImageBuffer } = await import("./ocr-transport.ts");
  const result = await remoteOcrImageBuffer(Buffer.from("hello"));
  assert.equal(result.ok, true);
  assert.equal(result.text, "TABLE 57");
});

test("remoteOcrImageBuffer surfaces worker errors", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false, error: "worker-init-failed", durationMs: 10 }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });

  const { remoteOcrImageBuffer } = await import("./ocr-transport.ts");
  const result = await remoteOcrImageBuffer(Buffer.from("x"));
  assert.equal(result.ok, false);
  assert.equal(result.error, "worker-init-failed");
});
