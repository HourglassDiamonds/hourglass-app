import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  readAnalyticsConsent,
  resetAnalyticsConsent,
  resetAnalyticsConsentMemoryForTests,
  writeAnalyticsConsent,
} from "./consent";
import {
  armClientAnalytics,
  disarmClientAnalytics,
  event,
  pageview,
  resetClientAnalyticsForTests,
} from "@/lib/gtag";

type GtagCall = unknown[];

function installLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key() {
      return null;
    },
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorage,
  });
  return store;
}

describe("analytics consent persistence", () => {
  beforeEach(() => {
    resetAnalyticsConsentMemoryForTests();
    installLocalStorage();
    (globalThis as { window?: Window }).window = globalThis as unknown as Window;
  });

  afterEach(() => {
    resetAnalyticsConsentMemoryForTests();
    delete (globalThis as { window?: Window }).window;
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("starts undecided", () => {
    assert.equal(readAnalyticsConsent(), "undecided");
  });

  it("persists allow and decline", () => {
    writeAnalyticsConsent("granted");
    assert.equal(readAnalyticsConsent(), "granted");
    assert.equal(
      globalThis.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY),
      "granted",
    );

    writeAnalyticsConsent("denied");
    assert.equal(readAnalyticsConsent(), "denied");
  });

  it("reset returns to undecided so the choice can be changed", () => {
    writeAnalyticsConsent("denied");
    resetAnalyticsConsent();
    assert.equal(readAnalyticsConsent(), "undecided");
    assert.equal(
      globalThis.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY),
      null,
    );
  });
});

describe("analytics dispatch follows consent", () => {
  const calls: GtagCall[] = [];
  const originalGaId = process.env.NEXT_PUBLIC_GA_ID;

  beforeEach(() => {
    resetClientAnalyticsForTests();
    resetAnalyticsConsentMemoryForTests();
    installLocalStorage();
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
    resetAnalyticsConsentMemoryForTests();
    if (originalGaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
    else process.env.NEXT_PUBLIC_GA_ID = originalGaId;
    delete (globalThis as { window?: Window }).window;
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("does not send analytics while undecided", () => {
    assert.equal(readAnalyticsConsent(), "undecided");
    pageview("/");
    event("generate_lead", { source: "test" });
    assert.equal(calls.length, 0);
  });

  it("does not send analytics after decline", () => {
    writeAnalyticsConsent("denied");
    pageview("/");
    event("generate_lead", { source: "test" });
    assert.equal(calls.length, 0);
  });

  it("sends analytics after allow", () => {
    writeAnalyticsConsent("granted");
    armClientAnalytics();
    pageview("/concierge");
    const pageViews = calls.filter(
      (call) => call[0] === "event" && call[1] === "page_view",
    );
    assert.equal(pageViews.length, 1);
  });

  it("stops sending after a later decline", () => {
    writeAnalyticsConsent("granted");
    armClientAnalytics();
    pageview("/");
    writeAnalyticsConsent("denied");
    disarmClientAnalytics();
    event("generate_lead", { source: "test" });
    const events = calls.filter((call) => call[0] === "event");
    assert.equal(events.length, 1);
    assert.equal(events[0]![1], "page_view");
  });
});
