import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  PRODUCTION_STAGING_AUTH_ROUTE,
  PRODUCTION_STAGING_CONTINUUM_PATH,
  PRODUCTION_STAGING_LOGIN_PATH,
  PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH,
  productionStagingRequestDecision,
} from "./production-staging-access";

function decide(
  method: string,
  pathname: string,
  hasNextServerActionHeader = false,
  allowOperationalShadowAction = false,
) {
  return productionStagingRequestDecision({
    method,
    pathname,
    hasNextServerActionHeader,
    allowOperationalShadowAction,
  });
}

describe("Production-backed staging request boundary", () => {
  it("allows only the conventional founder-auth POST", () => {
    assert.equal(decide("POST", PRODUCTION_STAGING_AUTH_ROUTE).allowed, true);
    assert.deepEqual(decide("POST", "/api/concierge"), {
      allowed: false,
      reason: "method-denied",
    });
    assert.deepEqual(decide("POST", "/executive-dashboard/concierge"), {
      allowed: false,
      reason: "method-denied",
    });
  });

  it("denies every Next Server Action even on an otherwise allowed path", () => {
    assert.deepEqual(decide("POST", PRODUCTION_STAGING_AUTH_ROUTE, true), {
      allowed: false,
      reason: "server-action-denied",
    });
    assert.deepEqual(decide("POST", PRODUCTION_STAGING_LOGIN_PATH, true), {
      allowed: false,
      reason: "server-action-denied",
    });
  });

  it("permits only the fixed operational Server Action when its separate switch is on", () => {
    assert.equal(decide("GET", PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH, false, true).allowed, true);
    assert.equal(decide("POST", PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH, true, true).allowed, true);
    assert.deepEqual(decide("POST", PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH, true, false), {
      allowed: false, reason: "server-action-denied",
    });
    assert.deepEqual(decide("POST", `${PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH}/other`, true, true), {
      allowed: false, reason: "server-action-denied",
    });
  });

  it("permits public reads and the single dashboard read surface", () => {
    assert.equal(decide("GET", "/").allowed, true);
    assert.equal(decide("HEAD", "/diamond-studio").allowed, true);
    assert.equal(decide("GET", PRODUCTION_STAGING_LOGIN_PATH).allowed, true);
    assert.equal(decide("GET", PRODUCTION_STAGING_CONTINUUM_PATH).allowed, true);
  });

  it("denies API GETs, cron/OAuth, Concierge pages, and all other methods", () => {
    for (const pathname of [
      "/api/cron/continuum-gmail-freshness",
      "/api/continuum/gmail/oauth/callback",
      "/api/concierge",
    ]) {
      assert.deepEqual(decide("GET", pathname), {
        allowed: false,
        reason: "api-denied",
      });
    }
    assert.deepEqual(decide("GET", "/executive-dashboard/concierge"), {
      allowed: false,
      reason: "dashboard-denied",
    });
    assert.deepEqual(decide("GET", "/executive-dashboard"), {
      allowed: false,
      reason: "dashboard-denied",
    });
    assert.deepEqual(decide("GET", `${PRODUCTION_STAGING_CONTINUUM_PATH}/nested`), {
      allowed: false,
      reason: "dashboard-denied",
    });
    assert.deepEqual(decide("DELETE", PRODUCTION_STAGING_AUTH_ROUTE), {
      allowed: false,
      reason: "method-denied",
    });
  });

  it("places the boundary before authenticated dashboard routing", () => {
    const proxy = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
    const boundary = proxy.indexOf("productionStagingRequestDecision");
    const dashboard = proxy.indexOf("isExecutiveDashboardPath(pathname)");
    assert.ok(boundary >= 0 && dashboard > boundary);
    assert.match(proxy, /request\.headers\.has\("next-action"\)/);
    assert.match(proxy, /status:\s*404/);
    assert.match(proxy, /PRODUCTION_STAGING_LOGIN_PATH/);
    assert.match(proxy, /PRODUCTION_STAGING_CONTINUUM_PATH/);
  });

  it("pins successful and existing-session redirects to the read-only Continuum route", () => {
    const authRoute = readFileSync(resolve(process.cwd(), "app/api/continuum/production-staging-founder-auth/route.ts"), "utf8");
    const loginPage = readFileSync(resolve(process.cwd(), "app/executive-dashboard/staging-login/page.tsx"), "utf8");
    assert.match(authRoute, /stagingRedirect\(request, PRODUCTION_STAGING_CONTINUUM_PATH\)/);
    assert.match(loginPage, /session\.ok\) redirect\(PRODUCTION_STAGING_CONTINUUM_PATH\)/);
  });
});
