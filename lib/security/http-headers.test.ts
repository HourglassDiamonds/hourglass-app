import assert from "node:assert/strict";
import { describe, it } from "node:test";
import nextConfig from "../../next.config";
import {
  EXECUTIVE_DASHBOARD_SECURITY_HEADERS,
  PUBLIC_SECURITY_HEADERS,
} from "./http-headers";

function headerValue(list: { key: string; value: string }[], key: string): string {
  const found = list.find((header) => header.key === key);
  assert.ok(found, `missing ${key}`);
  return found.value;
}

describe("site-wide security headers", () => {
  it("sets nosniff, referrer, permissions, hsts, and same-origin framing", () => {
    assert.equal(headerValue(PUBLIC_SECURITY_HEADERS, "X-Content-Type-Options"), "nosniff");
    assert.equal(
      headerValue(PUBLIC_SECURITY_HEADERS, "Referrer-Policy"),
      "strict-origin-when-cross-origin",
    );
    assert.equal(headerValue(PUBLIC_SECURITY_HEADERS, "X-Frame-Options"), "SAMEORIGIN");
    assert.match(
      headerValue(PUBLIC_SECURITY_HEADERS, "Permissions-Policy"),
      /camera=\(self\)/,
    );
    assert.match(
      headerValue(PUBLIC_SECURITY_HEADERS, "Permissions-Policy"),
      /geolocation=\(\)/,
    );
    assert.match(
      headerValue(PUBLIC_SECURITY_HEADERS, "Strict-Transport-Security"),
      /max-age=31536000/,
    );
    const csp = headerValue(PUBLIC_SECURITY_HEADERS, "Content-Security-Policy");
    assert.match(csp, /frame-ancestors 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.doesNotMatch(csp, /script-src/);
  });

  it("keeps the dashboard framing boundary tighter than public SAMEORIGIN", () => {
    assert.equal(
      headerValue(EXECUTIVE_DASHBOARD_SECURITY_HEADERS, "X-Frame-Options"),
      "DENY",
    );
    assert.equal(
      headerValue(EXECUTIVE_DASHBOARD_SECURITY_HEADERS, "Referrer-Policy"),
      "no-referrer",
    );
    assert.match(
      headerValue(EXECUTIVE_DASHBOARD_SECURITY_HEADERS, "Content-Security-Policy"),
      /frame-ancestors 'none'/,
    );
  });

  it("does not block same-origin Ring Studio or camera capture", () => {
    const csp = headerValue(PUBLIC_SECURITY_HEADERS, "Content-Security-Policy");
    assert.match(csp, /frame-ancestors 'self'/);
    assert.match(
      headerValue(PUBLIC_SECURITY_HEADERS, "Permissions-Policy"),
      /camera=\(self\)/,
    );
  });

  it("wires public headers through next.config", async () => {
    const headersFn = nextConfig.headers;
    assert.equal(typeof headersFn, "function");
    const headers = await headersFn!();
    assert.ok(headers.length >= 2);
    const sources = headers.map((entry) => entry.source);
    assert.ok(sources.includes("/"));
    assert.ok(sources.includes("/:path*"));
    const first = headers[0];
    const keys = first.headers.map((header) => header.key);
    assert.ok(keys.includes("X-Content-Type-Options"));
    assert.ok(keys.includes("Content-Security-Policy"));
    assert.ok(keys.includes("Strict-Transport-Security"));
  });
});
