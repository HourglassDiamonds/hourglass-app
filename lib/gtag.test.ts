import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  armClientAnalytics,
  configureGaWithoutAutomaticPageViews,
  event,
  pageview,
  resetClientAnalyticsForTests,
} from "./gtag";

type GtagCall = unknown[];

describe("gtag pageview ownership", () => {
  const calls: GtagCall[] = [];
  const originalGaId = process.env.NEXT_PUBLIC_GA_ID;

  beforeEach(() => {
    resetClientAnalyticsForTests();
    calls.length = 0;
    process.env.NEXT_PUBLIC_GA_ID = "G-TESTONLY";
    (globalThis as { window?: Window }).window = {
      dataLayer: [],
      gtag: ((...args: unknown[]) => {
        calls.push(args);
      }) as Window["gtag"],
    } as unknown as Window;
  });

  afterEach(() => {
    resetClientAnalyticsForTests();
    if (originalGaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
    else process.env.NEXT_PUBLIC_GA_ID = originalGaId;
    delete (globalThis as { window?: Window }).window;
  });

  it("configureGaWithoutAutomaticPageViews disables automatic page views", () => {
    configureGaWithoutAutomaticPageViews("G-TESTONLY");
    const configCall = calls.find(
      (call) => call[0] === "config" && call[1] === "G-TESTONLY",
    );
    assert.ok(configCall);
    assert.deepEqual(configCall![2], {
      send_page_view: false,
      anonymize_ip: true,
    });
  });

  it("initial route creates exactly one manual page_view", () => {
    armClientAnalytics();
    pageview("/concierge", "utm_source=instagram&report=SECRET");
    const pageViews = calls.filter(
      (call) => call[0] === "event" && call[1] === "page_view",
    );
    assert.equal(pageViews.length, 1);
    assert.deepEqual(pageViews[0]![2], {
      page_path: "/concierge?utm_source=instagram",
      page_location:
        "https://www.hourglassdiamonds.com/concierge?utm_source=instagram",
    });
  });

  it("a meaningful route change creates exactly one additional page_view", () => {
    armClientAnalytics();
    pageview("/");
    pageview("/diamond-studio");
    const pageViews = calls.filter(
      (call) => call[0] === "event" && call[1] === "page_view",
    );
    assert.equal(pageViews.length, 2);
    assert.equal(
      (pageViews[1]![2] as { page_path: string }).page_path,
      "/diamond-studio",
    );
  });

  it("a rerender with the same effective URL does not create an additional call", () => {
    armClientAnalytics();
    pageview("/the-house", "utm_campaign=hg_conv_01&sid=1");
    pageview("/the-house", "utm_campaign=hg_conv_01&sid=2");
    const pageViews = calls.filter(
      (call) => call[0] === "event" && call[1] === "page_view",
    );
    assert.equal(pageViews.length, 1);
  });

  it("missing GA configuration is a safe no-op", () => {
    delete process.env.NEXT_PUBLIC_GA_ID;
    resetClientAnalyticsForTests();
    armClientAnalytics();
    pageview("/");
    event("generate_lead", { source: "test" });
    assert.equal(calls.length, 0);
  });

  it("disabled environments do not dispatch events when not armed", () => {
    // Measurement ID present (as on Preview) but loader never armed client GA.
    pageview("/");
    event("generate_lead", { source: "test" });
    assert.equal(calls.length, 0);
  });

  it("does not call gtag config for navigations", () => {
    armClientAnalytics();
    pageview("/");
    pageview("/concierge");
    const configCalls = calls.filter((call) => call[0] === "config");
    assert.equal(configCalls.length, 0);
  });
});

describe("GoogleAnalytics loader contract", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const source = readFileSync(
    join(root, "app", "shared-components", "GoogleAnalytics.tsx"),
    "utf8",
  );

  it("configures GA through configureGaWithoutAutomaticPageViews", () => {
    assert.match(source, /configureGaWithoutAutomaticPageViews/);
    assert.match(source, /pageview\(pathname,\s*query\)/);
    assert.doesNotMatch(source, /gtag\('config'/);
  });
});
