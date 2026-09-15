import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { getRequestClientIp } from "@/lib/security/client-ip";
import { getExecutiveDashboardAuthClientIp } from "./rate-limit";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

function headersWith(headers: Record<string, string>): Headers {
  return new Headers(headers);
}

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://hourglass.example/limit", { headers });
}

function assertMatchesHardenedHelper(
  headers: Record<string, string>,
): void {
  assert.equal(
    getExecutiveDashboardAuthClientIp(headersWith(headers)),
    getRequestClientIp(requestWith(headers)),
  );
}

describe("getExecutiveDashboardAuthClientIp delegates to getRequestClientIp", () => {
  it("prefers the Vercel platform IP over attacker-supplied X-Forwarded-For", () => {
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => {
      const headers = {
        "x-vercel-forwarded-for": "203.0.113.10",
        "x-forwarded-for": "198.51.100.1",
        "x-real-ip": "192.0.2.9",
      };
      assert.equal(
        getExecutiveDashboardAuthClientIp(headersWith(headers)),
        "203.0.113.10",
      );
      assertMatchesHardenedHelper(headers);
    });
  });

  it("rejects an X-Forwarded-For comma chain as a founder-auth bucket identity", () => {
    const hostile = { "x-forwarded-for": "1.2.3.4, 5.6.7.8" };
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => {
      assert.equal(
        getExecutiveDashboardAuthClientIp(headersWith(hostile)),
        "",
      );
      assert.notEqual(
        getExecutiveDashboardAuthClientIp(headersWith(hostile)),
        "1.2.3.4",
      );
      assertMatchesHardenedHelper(hostile);
    });
    withEnv({ VERCEL: undefined, VERCEL_ENV: undefined }, () => {
      assert.equal(
        getExecutiveDashboardAuthClientIp(headersWith(hostile)),
        "unknown",
      );
      assert.notEqual(
        getExecutiveDashboardAuthClientIp(headersWith(hostile)),
        "1.2.3.4",
      );
      assertMatchesHardenedHelper(hostile);
    });
  });

  it("does not accept x-real-ip on Vercel", () => {
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => {
      const headers = {
        "x-real-ip": "203.0.113.51",
        "x-client-ip": "203.0.113.50",
      };
      assert.equal(
        getExecutiveDashboardAuthClientIp(headersWith(headers)),
        "",
      );
      assertMatchesHardenedHelper(headers);
    });
  });

  it("accepts a single forwarded IP on the non-Vercel path", () => {
    withEnv({ VERCEL: undefined, VERCEL_ENV: undefined }, () => {
      const headers = {
        "x-forwarded-for": "203.0.113.8",
        "x-real-ip": "192.0.2.1",
      };
      assert.equal(
        getExecutiveDashboardAuthClientIp(headersWith(headers)),
        "203.0.113.8",
      );
      assertMatchesHardenedHelper(headers);
    });
  });

  it("follows the hardened helper missing-identity fallback", () => {
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => {
      assert.equal(getExecutiveDashboardAuthClientIp(headersWith({})), "");
      assertMatchesHardenedHelper({});
    });
    withEnv({ VERCEL: undefined, VERCEL_ENV: undefined }, () => {
      assert.equal(getExecutiveDashboardAuthClientIp(headersWith({})), "unknown");
      assertMatchesHardenedHelper({});
    });
  });

  it("does not re-parse forwarding headers independently of the hardened helper", () => {
    const source = readFileSync(
      join(ROOT, "lib/executive-dashboard/rate-limit.ts"),
      "utf8",
    );
    assert.match(source, /getRequestClientIp/);
    assert.doesNotMatch(source, /split\s*\(\s*["'`],["'`]\s*\)/);
  });

  it("keeps founder-auth callers on the shared identity helper", () => {
    const files = [
      "app/executive-dashboard/actions.ts",
      "app/executive-dashboard/passkey-actions.ts",
      "app/executive-dashboard/security/passkeys/actions.ts",
      "app/executive-dashboard/security/passkeys/pairing-actions.ts",
      "app/executive-dashboard/security/passkeys/pair/actions.ts",
    ];
    for (const relative of files) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      assert.match(source, /getExecutiveDashboardAuthClientIp/);
    }
    const claim = readFileSync(
      join(ROOT, "app/executive-dashboard/security/passkeys/pair/actions.ts"),
      "utf8",
    );
    assert.match(claim, /export async function claimIphonePairingFromTokenAction/);
    const claimFn = claim.slice(
      claim.indexOf("export async function claimIphonePairingFromTokenAction"),
      claim.indexOf("export async function readPhonePairingAction"),
    );
    assert.doesNotMatch(claimFn, /clientIp\(|getExecutiveDashboardAuthClientIp/);
  });
});
