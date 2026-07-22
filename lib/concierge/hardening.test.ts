import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, beforeEach } from "node:test";
import {
  checkConciergeRateLimit,
  getConciergeClientIp,
  resetConciergeRateLimits,
} from "./rate-limit";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("concierge honeypot contract", () => {
  const route = readFileSync(
    join(root, "app", "api", "concierge", "route.ts"),
    "utf8",
  );
  const client = readFileSync(
    join(root, "app", "concierge", "concierge-page-client.tsx"),
    "utf8",
  );

  it("API soft-accepts honeypot with accepted false before rate limit and CRM", () => {
    assert.match(route, /company_website/);
    assert.match(route, /function softAcceptJson/);
    assert.match(route, /accepted:\s*false/);
    assert.match(route, /accepted:\s*true/);
    const postStart = route.indexOf("export async function POST");
    const honeypotInPost = route.indexOf("company_website", postStart);
    const softAcceptInPost = route.indexOf("softAcceptJson()", postStart);
    const rateInPost = route.indexOf("checkConciergeRateLimit", postStart);
    const beginInPost = route.indexOf("beginConciergeSubmission", postStart);
    assert.ok(postStart > 0);
    assert.ok(honeypotInPost > postStart);
    assert.ok(softAcceptInPost > honeypotInPost);
    assert.ok(rateInPost > softAcceptInPost);
    assert.ok(beginInPost > rateInPost);
  });

  it("resolves HubSpot token server-side from ACCESS or PRIVATE_APP alias", () => {
    assert.match(route, /resolveHubSpotToken/);
    assert.match(route, /HUBSPOT_PRIVATE_APP_TOKEN/);
    assert.match(route, /Authorization: `Bearer \$\{token\}`/);
    assert.doesNotMatch(route, /NEXT_PUBLIC_.*HUBSPOT/);
  });

  it("logs association and note failures as nonfatal warning codes without CRM ids", () => {
    assert.match(route, /CONCIERGE_ASSOCIATION_NONFATAL/);
    assert.match(route, /CONCIERGE_NOTE_NONFATAL/);
    assert.match(route, /console\.warn\(\s*"\[CONCIERGE_ASSOCIATION_NONFATAL\]"/);
    assert.match(route, /console\.warn\(\s*"\[CONCIERGE_NOTE_NONFATAL\]"/);
    assert.doesNotMatch(
      route,
      /console\.warn\(\s*"\[CONCIERGE_ASSOCIATION_NONFATAL\]"[\s\S]{0,240}contactId/,
    );
  });

  it("client fires lead events only when accepted === true", () => {
    assert.match(client, /data\.accepted === true/);
    assert.match(client, /trackGenerateLead/);
    assert.match(client, /trackConciergeFormSubmitted/);
    assert.doesNotMatch(
      client,
      /if\s*\(\s*!leadTracked\.current\s*\)\s*\{\s*leadTracked\.current = true;\s*trackConciergeFormSubmitted/,
    );
  });
});

describe("checkConciergeRateLimit", () => {
  beforeEach(() => {
    resetConciergeRateLimits();
  });

  it("allows requests when IP cannot be determined", () => {
    const result = checkConciergeRateLimit("");
    assert.equal(result.allowed, true);
  });

  it("extracts the first x-forwarded-for hop", () => {
    const request = new Request("https://example.com/api/concierge", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
    });
    assert.equal(getConciergeClientIp(request), "203.0.113.10");
  });
});

describe("executive dashboard production deny contract", () => {
  it("keeps Vercel production hidden and requires real auth elsewhere", () => {
    const layout = readFileSync(
      join(root, "app", "executive-dashboard", "layout.tsx"),
      "utf8",
    );
    const envModule = readFileSync(
      join(root, "lib", "executive-dashboard", "env.ts"),
      "utf8",
    );
    const envExample = readFileSync(join(root, ".env.example"), "utf8");
    assert.match(layout, /isExecutiveDashboardPublicProduction/);
    assert.match(layout, /noindex|robots/);
    assert.match(envModule, /VERCEL_ENV === "production"/);
    assert.doesNotMatch(layout, /EXECUTIVE_DASHBOARD_ENABLED/);
    assert.doesNotMatch(envExample, /EXECUTIVE_DASHBOARD_ENABLED=true/);
    assert.match(envExample, /EXECUTIVE_DASHBOARD_SESSION_SECRET/);
    assert.match(envExample, /EXECUTIVE_DASHBOARD_PASSWORD_HASH/);
  });
});
