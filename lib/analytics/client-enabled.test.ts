import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { isClientAnalyticsEnabled } from "./client-enabled";

describe("isClientAnalyticsEnabled", () => {
  const original = {
    gaId: process.env.NEXT_PUBLIC_GA_ID,
    vercelEnv: process.env.VERCEL_ENV,
    optIn: process.env.GA_CLIENT_ENABLED,
  };

  afterEach(() => {
    if (original.gaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
    else process.env.NEXT_PUBLIC_GA_ID = original.gaId;
    if (original.vercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = original.vercelEnv;
    if (original.optIn === undefined) delete process.env.GA_CLIENT_ENABLED;
    else process.env.GA_CLIENT_ENABLED = original.optIn;
  });

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_GA_ID;
    delete process.env.VERCEL_ENV;
    delete process.env.GA_CLIENT_ENABLED;
  });

  it("is a safe no-op when the measurement ID is missing", () => {
    process.env.VERCEL_ENV = "production";
    assert.equal(isClientAnalyticsEnabled(), false);
  });

  it("enables on Vercel production when the measurement ID is present", () => {
    process.env.NEXT_PUBLIC_GA_ID = "G-TESTONLY";
    process.env.VERCEL_ENV = "production";
    assert.equal(isClientAnalyticsEnabled(), true);
  });

  it("disables on Vercel Preview by default", () => {
    process.env.NEXT_PUBLIC_GA_ID = "G-TESTONLY";
    process.env.VERCEL_ENV = "preview";
    assert.equal(isClientAnalyticsEnabled(), false);
  });

  it("disables in local development by default", () => {
    process.env.NEXT_PUBLIC_GA_ID = "G-TESTONLY";
    assert.equal(isClientAnalyticsEnabled(), false);
  });

  it("allows explicit opt-in for intentional preview/local validation", () => {
    process.env.NEXT_PUBLIC_GA_ID = "G-TESTONLY";
    process.env.VERCEL_ENV = "preview";
    process.env.GA_CLIENT_ENABLED = "1";
    assert.equal(isClientAnalyticsEnabled(), true);
  });
});
