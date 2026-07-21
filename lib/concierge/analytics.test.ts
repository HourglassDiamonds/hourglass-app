import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  trackGenerateLead,
  trackConciergeFormSubmitted,
} from "./analytics";
import {
  armClientAnalytics,
  resetClientAnalyticsForTests,
} from "@/lib/gtag";

describe("concierge generate_lead protection (behavioral)", () => {
  const calls: unknown[][] = [];
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
    armClientAnalytics();
  });

  afterEach(() => {
    resetClientAnalyticsForTests();
    if (originalGaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
    else process.env.NEXT_PUBLIC_GA_ID = originalGaId;
    delete (globalThis as { window?: Window }).window;
  });

  it("fires generate_lead with non-PII params when invoked after acceptance", () => {
    trackGenerateLead({
      project_type: "Engagement Ring",
      budget_band: "Prefer to Discuss",
      timeline: "Flexible",
      source: "concierge_page",
      originating_tool: "diamond-intelligence",
      campaign: "hg_conv_01",
    });

    const lead = calls.find(
      (call) => call[0] === "event" && call[1] === "generate_lead",
    );
    assert.ok(lead);
    assert.deepEqual(lead![2], {
      project_type: "Engagement Ring",
      budget_band: "Prefer to Discuss",
      timeline: "Flexible",
      source: "concierge_page",
      originating_tool: "diamond-intelligence",
      campaign_name: "hg_conv_01",
    });
    const payload = JSON.stringify(lead![2]);
    assert.doesNotMatch(payload, /@/);
    assert.doesNotMatch(payload, /report/i);
  });

  it("fires concierge_form_submitted independently with the same safe fields", () => {
    trackConciergeFormSubmitted({
      project_type: "Custom Design",
      source: "instagram",
      campaign: "hg_conv_01",
    });
    const submitted = calls.find(
      (call) => call[0] === "event" && call[1] === "concierge_form_submitted",
    );
    assert.ok(submitted);
    assert.equal(
      (submitted![2] as { campaign?: string }).campaign,
      "hg_conv_01",
    );
  });

  it("swallows analytics errors without throwing", () => {
    (window as Window).gtag = (() => {
      throw new Error("network blocked");
    }) as Window["gtag"];
    assert.doesNotThrow(() =>
      trackGenerateLead({ source: "concierge_page" }),
    );
  });
});

describe("concierge client accepted===true contract (source)", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const client = readFileSync(
    join(root, "app", "concierge", "concierge-page-client.tsx"),
    "utf8",
  );

  it("still gates generate_lead on accepted === true", () => {
    assert.match(client, /data\.accepted === true/);
    assert.match(client, /trackGenerateLead/);
    assert.match(client, /trackConciergeFormSubmitted/);
    // Must not fire lead events from the catch / validation branches alone.
    const validationBlock = client.slice(
      client.indexOf('trackConciergeFormError("validation")') - 120,
      client.indexOf('trackConciergeFormError("validation")') + 80,
    );
    assert.doesNotMatch(validationBlock, /trackGenerateLead/);
  });
});
