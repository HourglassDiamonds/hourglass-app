import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { fetchBinaryResource, fetchListingPage } from "./fetch-listing-page";
import { setRemoteDnsLookupForTests } from "./url-safety";
import { URL_FETCH_MAX_REDIRECTS } from "./safe-remote-fetch";

function jsonResponse(
  status: number,
  body: string,
  headers?: Record<string, string>,
): Response {
  return new Response(body, { status, headers });
}

describe("fetchBinaryResource SSRF containment", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setRemoteDnsLookupForTests(null);
  });

  it("allows a public https URL", async () => {
    setRemoteDnsLookupForTests(async () => [{ address: "8.8.8.8", family: 4 }]);
    globalThis.fetch = (async () =>
      jsonResponse(200, "pdf-bytes", {
        "content-type": "application/pdf",
      })) as typeof fetch;

    const result = await fetchBinaryResource("https://cdn.example.com/report.pdf");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mime, "application/pdf");
      assert.equal(result.bytes.toString(), "pdf-bytes");
    }
  });

  it("rejects http URLs", async () => {
    const result = await fetchBinaryResource("http://cdn.example.com/report.pdf");
    assert.equal(result.ok, false);
  });

  it("rejects localhost, loopback, RFC1918, link-local, and metadata", async () => {
    const blocked = [
      "https://localhost/report.pdf",
      "https://127.0.0.1/report.pdf",
      "https://[::1]/report.pdf",
      "https://10.0.0.4/report.pdf",
      "https://192.168.0.12/report.pdf",
      "https://169.254.169.254/latest/meta-data",
    ];
    for (const url of blocked) {
      const result = await fetchBinaryResource(url);
      assert.equal(result.ok, false, url);
    }
  });

  it("rejects a redirect to a private target", async () => {
    setRemoteDnsLookupForTests(async () => [{ address: "8.8.8.8", family: 4 }]);
    globalThis.fetch = (async () =>
      jsonResponse(302, "", {
        location: "https://127.0.0.1/secret.pdf",
      })) as typeof fetch;

    const result = await fetchBinaryResource(
      "https://cdn.example.com/report.pdf",
    );
    assert.equal(result.ok, false);
  });

  it("enforces the redirect chain bound", async () => {
    setRemoteDnsLookupForTests(async () => [{ address: "1.1.1.1", family: 4 }]);
    let hops = 0;
    globalThis.fetch = (async () => {
      hops += 1;
      return jsonResponse(302, "", {
        location: `https://cdn.example.com/hop-${hops}.pdf`,
      });
    }) as typeof fetch;

    const result = await fetchBinaryResource("https://cdn.example.com/start.pdf");
    assert.equal(result.ok, false);
    assert.ok(hops <= URL_FETCH_MAX_REDIRECTS + 1);
  });

  it("allows a valid public https redirect", async () => {
    setRemoteDnsLookupForTests(async () => [{ address: "8.8.8.8", family: 4 }]);
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse(302, "", {
          location: "https://files.example.com/report.pdf",
        });
      }
      return jsonResponse(200, "%PDF-1.4", {
        "content-type": "application/pdf",
      });
    }) as typeof fetch;

    const result = await fetchBinaryResource(
      "https://www.example.com/listing-report",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.bytes.toString(), "%PDF-1.4");
    }
  });

  it("preserves oversize, content-type, and timeout safeguards", async () => {
    setRemoteDnsLookupForTests(async () => [{ address: "8.8.8.8", family: 4 }]);

    globalThis.fetch = (async () =>
      jsonResponse(200, "tiny", {
        "content-type": "application/pdf",
        "content-length": String(21 * 1024 * 1024),
      })) as typeof fetch;
    const oversized = await fetchBinaryResource(
      "https://cdn.example.com/huge.pdf",
    );
    assert.equal(oversized.ok, false);

    globalThis.fetch = (async () =>
      jsonResponse(200, "img", { "content-type": "image/jpeg" })) as typeof fetch;
    const typed = await fetchBinaryResource("https://cdn.example.com/report.jpg");
    assert.equal(typed.ok, true);
    if (typed.ok) {
      assert.equal(typed.mime, "image/jpeg");
    }

    globalThis.fetch = (async (_url, init) => {
      const err = new Error("aborted");
      err.name = "AbortError";
      if (init?.signal?.aborted) throw err;
      init?.signal?.addEventListener("abort", () => undefined);
      throw err;
    }) as typeof fetch;
    const timedOut = await fetchBinaryResource(
      "https://cdn.example.com/slow.pdf",
      { timeoutMs: 1 },
    );
    assert.equal(timedOut.ok, false);
    if (!timedOut.ok) {
      assert.match(timedOut.reason, /Timed out/i);
    }
  });
});

describe("fetchListingPage redirect containment", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setRemoteDnsLookupForTests(null);
  });

  it("does not follow a private redirect for listing HTML", async () => {
    setRemoteDnsLookupForTests(async () => [{ address: "8.8.8.8", family: 4 }]);
    globalThis.fetch = (async () =>
      jsonResponse(301, "", { location: "https://192.168.1.20/admin" })) as typeof fetch;
    const result = await fetchListingPage(
      "https://www.jamesallen.com/loose-diamonds/round/123",
    );
    assert.equal(result.ok, false);
  });

  it("re-validates every resolved address on a redirect hostname", async () => {
    setRemoteDnsLookupForTests(async (hostname) => {
      if (hostname === "evil.example") {
        return [
          { address: "8.8.8.8", family: 4 },
          { address: "10.0.0.1", family: 4 },
        ];
      }
      return [{ address: "8.8.8.8", family: 4 }];
    });
    globalThis.fetch = (async () =>
      jsonResponse(302, "", {
        location: "https://evil.example/secret",
      })) as typeof fetch;
    const result = await fetchListingPage(
      "https://www.jamesallen.com/loose-diamonds/round/123",
    );
    assert.equal(result.ok, false);
  });
});
