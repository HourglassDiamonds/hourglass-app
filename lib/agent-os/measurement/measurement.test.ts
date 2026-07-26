import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessChange,
  classifyGscLag,
  classifyMeasurementFailure,
  dedupeStable,
  founderLabelForHealthCode,
  getAgentOsMeasurementWindows,
  getWindowsEndingOn,
  localMidnightUtcIso,
  preflightShouldExitNonzero,
  safePercentChange,
  shortenMeasurementGapLabel,
  shouldSuppressGscRowForFounderPriority,
  sourceAgeDays,
  type MeasurementPreflightResult,
} from "./index";
import { detectMeasurementEnvPresence } from "./preflight";
import { buildDataConfidenceNote } from "../brief-quality";
import { GA4_ADAPTER_QUERIED_EVENTS } from "../bi/expected-events";
import { GA4_LIVE_QUERIED_EVENTS } from "@/lib/integrations/ga4";

describe("measurement health codes", () => {
  it("maps founder labels precisely for GA4 failures", () => {
    assert.equal(
      founderLabelForHealthCode("ga4", "not-configured"),
      "GA4 not configured",
    );
    assert.equal(
      founderLabelForHealthCode("ga4", "oauth-auth-failed"),
      "GA4 OAuth authentication failed",
    );
    assert.equal(
      founderLabelForHealthCode("ga4", "property-access-denied"),
      "GA4 property access denied",
    );
    assert.equal(
      founderLabelForHealthCode("ga4", "empty"),
      "GA4 returned no usable rows",
    );
  });

  it("maps GSC normal lag without calling it an outage", () => {
    const label = founderLabelForHealthCode("gsc", "stale-within-normal-delay", {
      newestAvailableDate: "2026-07-23",
      ageDays: 3,
    });
    assert.match(label, /July 23/);
    assert.match(label, /processing delay|finalized/i);
    assert.doesNotMatch(label, /unavailable|failed/i);
  });

  it("classifies OAuth and permission failures", () => {
    assert.equal(
      classifyMeasurementFailure("ga4", {
        code: "INVALID_REFRESH_TOKEN",
        message: "invalid_grant",
      }),
      "oauth-auth-failed",
    );
    assert.equal(
      classifyMeasurementFailure("ga4", {
        code: "GA4_PROPERTY_ACCESS_DENIED",
        message: "permission denied 403",
      }),
      "property-access-denied",
    );
    assert.equal(
      classifyMeasurementFailure("gsc", {
        code: "API_FORBIDDEN",
        message: "permission denied",
      }),
      "site-access-denied",
    );
    assert.equal(
      classifyMeasurementFailure("ga4", { message: "ga4 timed out after 12000ms" }),
      "timeout",
    );
  });

  it("shortens gap labels without collapsing known reasons", () => {
    assert.equal(
      shortenMeasurementGapLabel("GA4 OAuth authentication failed"),
      "GA4 OAuth authentication failed",
    );
    assert.equal(
      shortenMeasurementGapLabel("GA4 retrieval failed"),
      "GA4 request failed",
    );
    assert.equal(
      shortenMeasurementGapLabel("Search Console not configured"),
      "Search Console not configured",
    );
    assert.equal(
      shortenMeasurementGapLabel("HubSpot aggregates unavailable"),
      "HubSpot unavailable",
    );
  });
});

describe("daily brief health copy", () => {
  it("preserves precise GA4/GSC reasons in data confidence", () => {
    const note = buildDataConfidenceNote({
      missingOrUnreliableData: [
        "GA4 OAuth authentication failed",
        "Search Console site access denied",
        "HubSpot aggregates unavailable",
      ],
      executiveNotes: [],
      briefEvidenceQuality: "partial-degraded",
    });
    assert.equal(note.level, "Partial");
    assert.match(note.summary, /GA4 OAuth authentication failed/);
    assert.match(note.summary, /Search Console site access denied/);
    assert.doesNotMatch(note.summary, /^GA4 unavailable;/);
  });
});

describe("ET completed-day windows", () => {
  it("excludes the incomplete current local day", () => {
    // 2026-07-20 16:00 UTC = 12:00 EDT — local today 2026-07-20; complete day 2026-07-19
    const asOf = new Date("2026-07-20T16:00:00.000Z");
    const w = getAgentOsMeasurementWindows(asOf);
    assert.equal(w.localToday, "2026-07-20");
    assert.equal(w.mostRecentCompleteDay.end, "2026-07-19");
    assert.equal(w.priorCompleteDay.end, "2026-07-18");
    assert.equal(w.rolling7d.start, "2026-07-13");
    assert.equal(w.rolling7d.end, "2026-07-19");
    assert.equal(w.prior7d.start, "2026-07-06");
    assert.equal(w.prior7d.end, "2026-07-12");
    assert.equal(w.baseline28d.start, "2026-06-22");
    assert.equal(w.baseline28d.end, "2026-07-19");
  });

  it("handles America/New_York midnight boundary", () => {
    // Just after local midnight EDT on 2026-03-20 (EDT starts 2026-03-08)
    const localMidnight = localMidnightUtcIso("2026-03-20");
    const justAfter = new Date(new Date(localMidnight).getTime() + 60_000);
    const w = getAgentOsMeasurementWindows(justAfter);
    assert.equal(w.localToday, "2026-03-20");
    assert.equal(w.mostRecentCompleteDay.end, "2026-03-19");
  });

  it("handles DST spring forward (2026-03-08)", () => {
    // 2026-03-08 07:30 UTC ≈ 03:30 EDT after spring forward (02:00 → 03:00)
    const asOf = new Date("2026-03-08T07:30:00.000Z");
    const w = getAgentOsMeasurementWindows(asOf);
    assert.equal(w.localToday, "2026-03-08");
    assert.equal(w.mostRecentCompleteDay.end, "2026-03-07");
  });

  it("handles DST fall back (2026-11-01)", () => {
    const asOf = new Date("2026-11-01T16:00:00.000Z");
    const w = getAgentOsMeasurementWindows(asOf);
    assert.equal(w.localToday, "2026-11-01");
    assert.equal(w.mostRecentCompleteDay.end, "2026-10-31");
  });

  it("builds GSC windows from newest reliable date", () => {
    const w = getWindowsEndingOn("2026-07-23");
    assert.equal(w.mostRecentCompleteDay.end, "2026-07-23");
    assert.equal(w.rolling7d.end, "2026-07-23");
    assert.equal(w.rolling7d.start, "2026-07-17");
    assert.equal(w.prior7d.end, "2026-07-16");
    assert.equal(w.prior7d.start, "2026-07-10");
  });

  it("classifies GSC lag bands", () => {
    assert.equal(classifyGscLag(1).lagClassification, "fresh");
    assert.equal(classifyGscLag(3).lagClassification, "normal-delay");
    assert.equal(classifyGscLag(3).healthCode, "stale-within-normal-delay");
    assert.equal(classifyGscLag(6).lagClassification, "unusual-stale");
    assert.equal(classifyGscLag(6).healthCode, "stale-unusual");
  });

  it("computes source age vs complete local day", () => {
    const asOf = new Date("2026-07-26T16:00:00.000Z"); // local 2026-07-26
    assert.equal(sourceAgeDays("2026-07-23", asOf), 2); // complete day 07-25
  });
});

describe("change math / noise guards", () => {
  it("suppresses percent claims on zero / tiny priors", () => {
    assert.equal(safePercentChange(10, 0), null);
    assert.equal(safePercentChange(25, 25, 20), 0);
    const tiny = assessChange(8, 4, { minPriorForPercent: 20 });
    assert.equal(tiny.percentClaimSafe, false);
    assert.equal(tiny.percentChange, null);
  });

  it("flags small-sample and ordinary noise", () => {
    const noise = assessChange(22, 20, {
      minPriorForPercent: 10,
      ordinaryNoisePercent: 15,
      smallSampleCombined: 50,
    });
    assert.equal(noise.ordinaryNoise, true);
  });

  it("suppresses sparse GSC rows for founder priority", () => {
    assert.equal(
      shouldSuppressGscRowForFounderPriority({
        impressions: 40,
        clicks: 2,
      }),
      true,
    );
    assert.equal(
      shouldSuppressGscRowForFounderPriority({
        impressions: 500,
        clicks: 40,
      }),
      false,
    );
  });

  it("dedupes evidence keys", () => {
    assert.deepEqual(
      dedupeStable(
        [
          { id: "a", v: 1 },
          { id: "a", v: 2 },
          { id: "b", v: 3 },
        ],
        (x) => x.id,
      ).map((x) => x.v),
      [1, 3],
    );
  });
});

describe("event allowlist coverage", () => {
  it("keeps expected-events allowlist in sync with GA4 live queried events", () => {
    assert.deepEqual(
      [...GA4_ADAPTER_QUERIED_EVENTS].sort(),
      [...GA4_LIVE_QUERIED_EVENTS].sort(),
    );
    assert.ok(GA4_ADAPTER_QUERIED_EVENTS.includes("generate_lead"));
    assert.ok(GA4_ADAPTER_QUERIED_EVENTS.includes("concierge_form_started"));
  });
});

describe("preflight / smoke defaults", () => {
  it("detects env presence without reading secret values", () => {
    const env = detectMeasurementEnvPresence();
    for (const v of Object.values(env)) {
      assert.equal(typeof v, "boolean");
    }
  });

  it("exits nonzero for auth failures but not for empty healthy sources", () => {
    const emptyHealthy: MeasurementPreflightResult = {
      env: {
        GOOGLE_CLIENT_ID: true,
        GOOGLE_CLIENT_SECRET: true,
        GOOGLE_REFRESH_TOKEN: true,
        GOOGLE_OAUTH_REDIRECT_URI: false,
        GA4_PROPERTY_ID: true,
        GSC_SITE_URL: true,
      },
      oauth: {
        configured: true,
        tokenExchange: "ok",
        healthCode: "ok",
        message: null,
      },
      ga4: {
        configured: true,
        propertyIdDisplay: "123456",
        accessible: true,
        healthCode: "empty",
        founderLabel: "GA4 returned no usable rows",
      },
      gsc: {
        configured: true,
        siteUrlDisplay: "https://example.com/",
        accessible: true,
        healthCode: "stale-within-normal-delay",
        founderLabel: "Search Console reporting delay within expected range",
      },
      asOfUtc: "2026-07-26T12:00:00.000Z",
      hasBlockingFailure: false,
    };
    assert.equal(preflightShouldExitNonzero(emptyHealthy), false);

    const authFail: MeasurementPreflightResult = {
      ...emptyHealthy,
      oauth: {
        configured: true,
        tokenExchange: "failed",
        healthCode: "oauth-auth-failed",
        message: "invalid_grant",
      },
      ga4: {
        ...emptyHealthy.ga4,
        healthCode: "oauth-auth-failed",
        founderLabel: "GA4 OAuth authentication failed",
        accessible: false,
      },
    };
    assert.equal(preflightShouldExitNonzero(authFail), true);
  });

  it("smoke CLI refuses email flags (documented contract)", async () => {
    // Contract tested via script source scan — never import send path.
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      new URL("../../../scripts/agent-os-measurement-smoke.ts", import.meta.url),
      "utf8",
    );
    assert.match(src, /never sends email/i);
    assert.match(src, /delivery: "disabled"/);
    assert.doesNotMatch(src, /sendFounder|resend\.emails\.send/i);
  });
});
