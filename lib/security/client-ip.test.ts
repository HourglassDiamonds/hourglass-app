import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRequestClientIp,
  resolveAbuseLimiterIdentity,
} from "./client-ip";

function withEnv(
  values: Record<string, string | undefined>,
  fn: () => void,
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://hourglass.example/limit", { headers });
}

describe("getRequestClientIp on Vercel", () => {
  it("prefers x-vercel-forwarded-for over every other forwarding header", () => {
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => {
      const ip = getRequestClientIp(
        requestWith({
          "x-vercel-forwarded-for": "203.0.113.10",
          "x-forwarded-for": "198.51.100.1",
          "x-real-ip": "192.0.2.9",
          "x-client-ip": "8.8.8.8",
        }),
      );
      assert.equal(ip, "203.0.113.10");
    });
  });

  it("does not let a spoofed lower-priority header override the platform header", () => {
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => {
      const ip = getRequestClientIp(
        requestWith({
          "x-vercel-forwarded-for": "203.0.113.44",
          "x-forwarded-for": "1.2.3.4, 9.9.9.9",
          "x-real-ip": "10.0.0.1",
          "x-client-ip": "4.4.4.4",
          "true-client-ip": "5.5.5.5",
          "cf-connecting-ip": "6.6.6.6",
        }),
      );
      assert.equal(ip, "203.0.113.44");
    });
  });

  it("falls back to a single Vercel-overwritten x-forwarded-for when the platform header is absent", () => {
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => {
      const ip = getRequestClientIp(
        requestWith({
          "x-forwarded-for": "198.51.100.20",
          "x-real-ip": "8.8.8.8",
          "x-client-ip": "1.1.1.1",
        }),
      );
      assert.equal(ip, "198.51.100.20");
    });
  });

  it("does not fall back to x-forwarded-for when the platform header is present but malformed", () => {
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => {
      const ip = getRequestClientIp(
        requestWith({
          "x-vercel-forwarded-for": "not-an-ip",
          "x-forwarded-for": "203.0.113.99",
          "x-real-ip": "203.0.113.99",
        }),
      );
      assert.equal(ip, "");
    });
  });

  it("rejects comma-separated forwarding chains instead of picking a hop", () => {
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => {
      assert.equal(
        getRequestClientIp(
          requestWith({
            "x-vercel-forwarded-for": "203.0.113.10, 10.0.0.1",
          }),
        ),
        "",
      );
      assert.equal(
        getRequestClientIp(
          requestWith({
            "x-forwarded-for": "203.0.113.10, 10.0.0.1",
          }),
        ),
        "",
      );
    });
  });

  it("does not trust x-client-ip or x-real-ip in production", () => {
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => {
      assert.equal(
        getRequestClientIp(
          requestWith({
            "x-client-ip": "203.0.113.50",
            "x-real-ip": "203.0.113.51",
          }),
        ),
        "",
      );
    });
  });

  it("accepts IPv4 and IPv6 platform values, including bracketed IPv6", () => {
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => {
      assert.equal(
        getRequestClientIp(
          requestWith({ "x-vercel-forwarded-for": "192.0.2.10" }),
        ),
        "192.0.2.10",
      );
      assert.equal(
        getRequestClientIp(
          requestWith({ "x-vercel-forwarded-for": "2001:db8::1" }),
        ),
        "2001:db8::1",
      );
      assert.equal(
        getRequestClientIp(
          requestWith({ "x-vercel-forwarded-for": "[2001:db8::55]" }),
        ),
        "2001:db8::55",
      );
    });
  });

  it("fails closed on missing or malformed production IP", () => {
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => {
      assert.equal(getRequestClientIp(requestWith({})), "");
      assert.equal(
        getRequestClientIp(requestWith({ "x-vercel-forwarded-for": "   " })),
        "",
      );
      assert.equal(
        getRequestClientIp(
          requestWith({ "x-vercel-forwarded-for": "garbage" }),
        ),
        "",
      );
      assert.equal(resolveAbuseLimiterIdentity(""), null);
    });
  });
});

describe("getRequestClientIp outside Vercel", () => {
  it("uses a single x-forwarded-for, then x-real-ip, then unknown", () => {
    withEnv({ VERCEL: undefined, VERCEL_ENV: undefined }, () => {
      assert.equal(
        getRequestClientIp(
          requestWith({
            "x-forwarded-for": "203.0.113.8",
            "x-real-ip": "192.0.2.1",
          }),
        ),
        "203.0.113.8",
      );
      assert.equal(
        getRequestClientIp(requestWith({ "x-real-ip": "192.0.2.1" })),
        "192.0.2.1",
      );
      assert.equal(getRequestClientIp(requestWith({})), "unknown");
      assert.equal(
        getRequestClientIp(requestWith({ "x-client-ip": "8.8.8.8" })),
        "unknown",
      );
    });
  });

  it("does not parse a local comma-separated chain as a hop list", () => {
    withEnv({ VERCEL: undefined, VERCEL_ENV: undefined }, () => {
      assert.equal(
        getRequestClientIp(
          requestWith({
            "x-forwarded-for": "203.0.113.8, 10.0.0.1",
            "x-real-ip": "192.0.2.7",
          }),
        ),
        "192.0.2.7",
      );
    });
  });
});
