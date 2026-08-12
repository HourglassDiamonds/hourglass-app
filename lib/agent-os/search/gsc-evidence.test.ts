import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { INTELLIGENCE_OAUTH_SCOPES } from "@/lib/intelligence/google-oauth";
import { isBrandQuery } from "@/lib/intelligence/brand-queries";
import {
  GSC_PAGINATION_MAX_REQUESTS,
  GSC_QUERY_COVERAGE_NOTE,
  collectSearchAnalyticsRows,
  mapGscSitemapListPayload,
  annotateCriticalPagesWithGlobalTop,
  criticalPageAbsoluteUrl,
  type GscCriticalPageRow,
  type GscWeeklyBundle,
} from "@/lib/integrations/gsc";
import { createFixtureGscBundle } from "../fixtures/sample-data";
import {
  GSC_BRAND_CLASSIFIER_ID,
  GSC_EVIDENCE_SOURCE,
  buildGscEvidenceBundle,
  emptyGscEvidenceBundle,
} from "./gsc-evidence";
import { detectGscEvidenceOpportunities } from "./opportunities";

const GSC_TS = readFileSync(
  resolve(process.cwd(), "lib/integrations/gsc.ts"),
  "utf8",
);
const EVIDENCE_TS = readFileSync(
  resolve(process.cwd(), "lib/agent-os/search/gsc-evidence.ts"),
  "utf8",
);
const OAUTH_TS = readFileSync(
  resolve(process.cwd(), "lib/intelligence/google-oauth.ts"),
  "utf8",
);
const SETUP_MJS = readFileSync(
  resolve(process.cwd(), "scripts/google-oauth-setup.mjs"),
  "utf8",
);

describe("GSC permission / mutation boundaries", () => {
  it("OAuth scopes are readonly only — no full webmasters scope", () => {
    const scopes: readonly string[] = INTELLIGENCE_OAUTH_SCOPES;
    assert.ok(
      scopes.includes(
        "https://www.googleapis.com/auth/webmasters.readonly",
      ),
    );
    assert.equal(
      scopes.includes("https://www.googleapis.com/auth/webmasters"),
      false,
    );
    assert.match(OAUTH_TS, /webmasters\.readonly/);
    assert.match(SETUP_MJS, /webmasters\.readonly/);
    assert.equal(/auth\/webmasters"/.test(OAUTH_TS), false);
    assert.equal(/auth\/webmasters'/.test(SETUP_MJS), false);
  });

  it("GSC client has no mutation APIs, URL Inspection, or Indexing API", () => {
    assert.equal(/sitemaps\.submit/.test(GSC_TS), false);
    assert.equal(/sites\.add/.test(GSC_TS), false);
    assert.equal(/sites\.delete/.test(GSC_TS), false);
    assert.equal(/urlInspection/.test(GSC_TS), false);
    assert.equal(/indexing\.googleapis/.test(GSC_TS), false);
    assert.equal(/urlNotifications/.test(GSC_TS), false);
    assert.equal(/urlInspection/.test(EVIDENCE_TS), false);
    assert.match(GSC_TS, /method: "GET"/);
    assert.match(GSC_TS, /\/sitemaps`/);
  });

  it("V1 specialist path does not request device or country dimensions", () => {
    assert.match(GSC_TS, /GSC_V1_SEARCH_ANALYTICS_DIMENSIONS/);
    const specialist = GSC_TS.slice(
      GSC_TS.indexOf("fetchSpecialistDimensionRows"),
    );
    assert.equal(/\bdevice\b/.test(specialist.slice(0, 800)), false);
    assert.equal(/\bcountry\b/.test(specialist.slice(0, 800)), false);
    assert.equal(GSC_TS.includes('"device"'), false);
    assert.equal(GSC_TS.includes('"country"'), false);
  });
});

describe("Bounded Search Analytics pagination", () => {
  it("stops at maxRequests even if every page is full", async () => {
    let calls = 0;
    const { rows, meta } = await collectSearchAnalyticsRows({
      pageSize: 10,
      maxRows: 10_000,
      maxRequests: 3,
      coverageNote: GSC_QUERY_COVERAGE_NOTE,
      fetchPage: async ({ rowLimit }) => {
        calls += 1;
        assert.ok(calls <= GSC_PAGINATION_MAX_REQUESTS);
        return {
          rows: Array.from({ length: rowLimit }, (_, i) => ({
            keys: [`q-${calls}-${i}`],
            clicks: 1,
            impressions: 10,
          })),
        };
      },
    });
    assert.equal(calls, 3);
    assert.equal(meta.requestsMade, 3);
    assert.equal(meta.stoppedReason, "max-requests");
    assert.equal(meta.truncatedOrPotentiallyIncomplete, true);
    assert.equal(rows.length, 30);
    assert.ok(meta.requestLimit >= rows.length);
    assert.match(meta.note, /not all queries/i);
    assert.doesNotMatch(meta.note, /these are all queries/i);
  });

  it("clamps maxRequests to the hard cap", async () => {
    let calls = 0;
    const { meta } = await collectSearchAnalyticsRows({
      pageSize: 1,
      maxRows: 1000,
      maxRequests: 99,
      coverageNote: "note",
      fetchPage: async () => {
        calls += 1;
        return { rows: [{ keys: ["x"], clicks: 1, impressions: 1 }] };
      },
    });
    assert.equal(calls, GSC_PAGINATION_MAX_REQUESTS);
    assert.equal(meta.requestsMade, GSC_PAGINATION_MAX_REQUESTS);
    assert.ok(meta.requestsMade <= GSC_PAGINATION_MAX_REQUESTS);
  });

  it("treats a short final page as complete", async () => {
    let calls = 0;
    const { meta, rows } = await collectSearchAnalyticsRows({
      pageSize: 5,
      maxRows: 50,
      maxRequests: 6,
      coverageNote: GSC_QUERY_COVERAGE_NOTE,
      fetchPage: async () => {
        calls += 1;
        return { rows: [{ keys: ["only"] }] };
      },
    });
    assert.equal(calls, 1);
    assert.equal(rows.length, 1);
    assert.equal(meta.stoppedReason, "complete");
    assert.equal(meta.truncatedOrPotentiallyIncomplete, false);
  });
});

describe("Sitemap mapping ignores deprecated indexed counts", () => {
  it("does not model contents[].indexed", () => {
    const entries = mapGscSitemapListPayload({
      sitemap: [
        {
          path: "https://www.hourglassdiamonds.com/sitemap.xml",
          lastSubmitted: "2026-08-01",
          lastDownloaded: "2026-08-02",
          isPending: false,
          isSitemapsIndex: true,
          warnings: "1",
          errors: "2",
          contents: [
            { type: "web", submitted: "40", indexed: "9999" },
          ],
        },
      ],
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.path, "https://www.hourglassdiamonds.com/sitemap.xml");
    assert.equal(entries[0]!.errors, 2);
    assert.equal(entries[0]!.warnings, 1);
    assert.equal(entries[0]!.isSitemapsIndex, true);
    assert.equal(entries[0]!.contents[0]!.submitted, 40);
    assert.equal(entries[0]!.contents[0]!.type, "web");
    assert.equal("indexed" in entries[0]!.contents[0]!, false);
    assert.equal(JSON.stringify(entries).includes("9999"), false);
    assert.equal(JSON.stringify(entries).includes("indexed"), false);
  });
});

describe("GscEvidenceBundle", () => {
  it("missing credentials / unavailable GSC soft-fails without fabricated metrics", () => {
    const missing = buildGscEvidenceBundle(null, { available: false });
    assert.equal(missing.availability, "not-configured");
    assert.equal(missing.source, GSC_EVIDENCE_SOURCE);
    assert.equal(missing.observed.totals, null);
    assert.equal(missing.derived.brandedVsNonBranded, null);
    assert.ok(missing.unknown.length > 0);

    const denied: GscWeeklyBundle = {
      status: "unavailable",
      siteUrl: "sc-domain:hourglassdiamonds.com",
      unavailableReason: "Search Console permission denied",
      failureCode: "API_FORBIDDEN",
      fetchedAt: "2026-08-12T00:00:00.000Z",
    };
    const ev = buildGscEvidenceBundle(denied, { available: false });
    assert.equal(ev.availability, "property-denied");
    assert.equal(ev.observed.totals, null);
    assert.equal(ev.observed.queries.length, 0);
    assert.equal(ev.failureCode, "API_FORBIDDEN");
    assert.ok(ev.fetchedAt);
    assert.equal(ev.propertyDisplay, "sc-domain:hourglassdiamonds.com");
  });

  it("auth failure is a distinct soft-fail", () => {
    const ev = buildGscEvidenceBundle(
      {
        status: "unavailable",
        siteUrl: null,
        failureCode: "TOKEN_FAILED",
        unavailableReason: "refresh failed",
        fetchedAt: "2026-08-12T00:00:00.000Z",
      },
      { available: false },
    );
    assert.equal(ev.availability, "auth-failed");
    assert.equal(ev.observed.totals, null);
  });

  it("partial sitemap failure keeps Search Analytics observed and sitemap UNKNOWN", () => {
    const gsc = createFixtureGscBundle();
    gsc.sitemaps = {
      status: "unavailable",
      unavailableReason: "sitemap list failed",
      entries: [],
    };
    const ev = buildGscEvidenceBundle(gsc, { available: true });
    assert.equal(ev.availability, "partial");
    assert.ok(ev.observed.totals);
    assert.ok(ev.observed.queries.length > 0);
    assert.equal(ev.observed.sitemaps, null);
    assert.ok(
      ev.unknown.some((g) => /sitemap/i.test(g.claim) || /sitemap/i.test(g.reason)),
    );
    assert.equal(detectGscEvidenceOpportunities(ev).length, 0);
  });

  it("brand split is DERIVED / APPROXIMATE using the intelligence classifier", () => {
    const ev = buildGscEvidenceBundle(createFixtureGscBundle(), {
      available: true,
    });
    const brand = ev.derived.brandedVsNonBranded;
    assert.ok(brand);
    assert.equal(brand!.epistemic, "derived");
    assert.equal(brand!.approximate, true);
    assert.equal(brand!.classifier, GSC_BRAND_CLASSIFIER_ID);
    assert.match(brand!.coverageNote, /DERIVED \/ APPROXIMATE/);
    assert.match(brand!.coverageNote, /not the exact share of all searches/i);
    assert.equal(isBrandQuery("hourglass diamonds"), true);
    assert.equal(EVIDENCE_TS.includes("fan-out"), false);
    assert.match(EVIDENCE_TS, /@\/lib\/intelligence\/brand-queries/);
    assert.ok(brand!.branded.queryRows >= 1);
    assert.ok(brand!.nonBranded.queryRows >= 1);
  });

  it("retrieval metadata reports rows, cap, and potential incompleteness", () => {
    const gsc = createFixtureGscBundle();
    gsc.retrieval = {
      queries: {
        rowsReturned: 5,
        requestLimit: 15000,
        requestsMade: 1,
        truncatedOrPotentiallyIncomplete: false,
        stoppedReason: "complete",
        note: GSC_QUERY_COVERAGE_NOTE,
      },
      pages: {
        rowsReturned: 4,
        requestLimit: 5000,
        requestsMade: 1,
        truncatedOrPotentiallyIncomplete: false,
        stoppedReason: "complete",
        note: "bounded pages",
      },
    };
    const ev = buildGscEvidenceBundle(gsc, { available: true });
    assert.ok(ev.retrieval.queries);
    assert.equal(ev.retrieval.queries!.labeledAsAllQueries, false);
    assert.equal(ev.retrieval.queries!.rowsReturned, 5);
    assert.equal(ev.retrieval.queries!.requestLimit, 15000);
    assert.match(ev.retrieval.queries!.note, /not all queries/i);
    assert.ok(ev.freshness);
    assert.equal(ev.source, GSC_EVIDENCE_SOURCE);
  });

  it("critical-page evidence distinguishes observed vs unknown and does not zero-fill", () => {
    const observed: GscCriticalPageRow = {
      path: "/diamond-studio",
      pageUrl: criticalPageAbsoluteUrl("/diamond-studio"),
      state: "observed",
      inGlobalTopPages: false,
      metrics: {
        page: criticalPageAbsoluteUrl("/diamond-studio"),
        impressions: 12,
        clicks: 1,
        ctr: 1 / 12,
        position: 20,
      },
    };
    const emptyLookup: GscCriticalPageRow = {
      path: "/concierge",
      pageUrl: criticalPageAbsoluteUrl("/concierge"),
      state: "filtered-lookup-empty",
      inGlobalTopPages: false,
      metrics: null,
    };
    const annotated = annotateCriticalPagesWithGlobalTop(
      [observed, emptyLookup],
      [
        {
          page: "https://www.hourglassdiamonds.com/diamond-shape-studio",
          impressions: 100,
          clicks: 4,
          ctr: 0.04,
          position: 10,
        },
      ],
    );
    assert.equal(annotated[0]!.inGlobalTopPages, false);
    assert.equal(annotated[1]!.inGlobalTopPages, false);

    const gsc = createFixtureGscBundle();
    gsc.criticalPages = {
      current: [
        observed,
        emptyLookup,
        {
          path: "/engagement-rings",
          pageUrl: criticalPageAbsoluteUrl("/engagement-rings"),
          state: "filtered-lookup-empty",
          inGlobalTopPages: true,
          metrics: null,
        },
      ],
      previous: [],
    };
    const ev = buildGscEvidenceBundle(gsc, { available: true });
    const studio = ev.derived.toolPages.find(
      (p) => p.pathOrPrefix === "/diamond-studio",
    );
    const concierge = ev.derived.commercialPages.find(
      (p) => p.pathOrPrefix === "/concierge",
    );
    const rings = ev.derived.commercialPages.find(
      (p) => p.pathOrPrefix === "/engagement-rings",
    );
    assert.equal(studio?.state, "observed");
    assert.ok(studio?.metrics);
    assert.equal(concierge?.state, "filtered-lookup-empty");
    assert.equal(concierge?.metrics, null);
    assert.equal(rings?.inGlobalTopPages, true);
    assert.equal(rings?.metrics, null);
    assert.ok(
      ev.unknown.some((g) => g.claim.includes("/concierge") && /not an observed zero/i.test(g.reason)),
    );
  });

  it("empty helper keeps OBSERVED / DERIVED / UNKNOWN distinct", () => {
    const empty = emptyGscEvidenceBundle({ availability: "not-configured" });
    assert.equal(empty.observed.totals, null);
    assert.equal(empty.derived.brandedVsNonBranded, null);
    assert.ok(empty.unknown.some((g) => /Coverage/i.test(g.claim)));
  });
});
