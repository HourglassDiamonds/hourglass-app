import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adoptRemoteCaptureImage } from "./adopt-capture-image";

describe("adoptRemoteCaptureImage", () => {
  it("creates a local object URL after a successful image download", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9, ...Array(40).fill(1)]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      })) as typeof fetch;

    try {
      const adopted = await adoptRemoteCaptureImage(
        "https://example.invalid/signed-only",
      );
      assert.ok(adopted.objectUrl.startsWith("blob:"));
      assert.equal(adopted.mime, "image/jpeg");
      assert.ok(adopted.byteLength >= 32);
      URL.revokeObjectURL(adopted.objectUrl);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fails closed when download is not ok — no adoption", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(null, { status: 403 })) as typeof fetch;

    try {
      await assert.rejects(
        () => adoptRemoteCaptureImage("https://example.invalid/signed-only"),
        /download_failed/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects tiny non-image payloads", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "text/plain" },
      })) as typeof fetch;

    try {
      await assert.rejects(
        () => adoptRemoteCaptureImage("https://example.invalid/signed-only"),
        /invalid_image/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
