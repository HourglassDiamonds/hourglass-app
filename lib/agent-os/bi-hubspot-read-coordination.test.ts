/**
 * P1-BI-3 — HubSpot read coordination & rate-limit resilience.
 * No live email, CRM mutation, analytics write, commit, push, or deploy.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { HubSpotRequestError } from "@/lib/concierge/hubspot-client";
import {
  ATTRIBUTION_FUNNEL_STAGES,
  ATTRIBUTION_JOIN_STATUS,
  founderFacingAttributionTextContainsPii,
  listExecutives,
  operationalExecutives,
  runAcceptedInquiryAttributionSpecialist,
  WEBSITE_QA_CRITICAL_ROUTES,
} from "./index";
import {
  DEFAULT_CLIENT_ATTENTION_THRESHOLDS,
  loadClientAttentionSources,
  loadSharedLiveCrmForAgentOs,
  runClientAttentionAnalysis,
  sliceHubSpotLiveBundleForLookback,
} from "./bi/client-attention";
import { ATTRIBUTION_PRIMARY_LOOKBACK_DAYS } from "./bi/attribution/types";
import { CURRENT_OPERATING_BACKLOG } from "./operating-backlog";

const NOW = "2026-08-15T16:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;

const CONCIERGE_DESCRIPTION = [
  "Submission ID: sub-coord-1",
  "Project Type: Engagement Ring",
  "Source: website-concierge",
  "",
  "Attribution:",
  "Originating Tool: Diamond Studio",
  "Landing path: /diamond-studio",
  "Last CTA: diamond_studio:hero",
].join("\n");

function isoDaysAgo(days: number): string {
  return new Date(Date.parse(NOW) - days * DAY).toISOString();
}

function msDaysAgo(days: number): string {
  return String(Date.parse(NOW) - days * DAY);
}

function mockCrmFetch(input: {
  recentDealDays?: number;
  olderDealDays?: number;
  dealCount?: number;
  throwStatus?: number;
  throwPathIncludes?: string;
}): {
  fetchJson: (path: string, init?: RequestInit) => Promise<unknown>;
  paths: string[];
  methods: string[];
} {
  const paths: string[] = [];
  const methods: string[] = [];
  const recentDays = input.recentDealDays ?? 12;
  const olderDays = input.olderDealDays ?? 55;
  const extraDeals = Math.max(0, (input.dealCount ?? 2) - 2);

  const fetchJson = async (path: string, init?: RequestInit) => {
    paths.push(path);
    methods.push(init?.method ?? "POST");
    if (
      input.throwStatus &&
      path.includes(input.throwPathIncludes ?? "/contacts/search")
    ) {
      throw new HubSpotRequestError(
        input.throwStatus,
        path,
        input.throwStatus === 429 ? "secondly limit" : "hubspot error",
        input.throwStatus === 429 ? 1 : undefined,
      );
    }
    if (path.includes("/contacts/search")) {
      return {
        results: [
          {
            id: "c-recent",
            properties: {
              email: "recent.client@clients.example.test",
              firstname: "Recent",
              lastname: "Client",
              lastmodifieddate: msDaysAgo(recentDays),
            },
          },
          {
            id: "c-older",
            properties: {
              email: "older.client@clients.example.test",
              firstname: "Older",
              lastname: "Client",
              lastmodifieddate: msDaysAgo(olderDays),
            },
          },
        ],
      };
    }
    if (path.includes("/deals/search")) {
      const deals = [
        {
          id: "d-recent",
          properties: {
            dealname: "Recent Client – Engagement Ring",
            dealstage: "appointmentscheduled",
            description: CONCIERGE_DESCRIPTION,
            createdate: msDaysAgo(recentDays),
            hs_lastmodifieddate: msDaysAgo(recentDays),
          },
        },
        {
          id: "d-older",
          properties: {
            dealname: "Older Client – Engagement Ring",
            dealstage: "appointmentscheduled",
            description: CONCIERGE_DESCRIPTION.replace(
              "sub-coord-1",
              "sub-coord-older",
            ),
            createdate: msDaysAgo(olderDays),
            hs_lastmodifieddate: msDaysAgo(olderDays),
          },
        },
      ];
      for (let i = 0; i < extraDeals; i += 1) {
        deals.push({
          id: `d-cap-${i}`,
          properties: {
            dealname: `Cap deal ${i}`,
            dealstage: "appointmentscheduled",
            description: "Internal wholesale conversation",
            createdate: msDaysAgo(5),
            hs_lastmodifieddate: msDaysAgo(5),
          },
        });
      }
      return { results: deals.slice(0, input.dealCount ?? deals.length) };
    }
    if (path.includes("/tasks/search")) {
      return { results: [] };
    }
    if (path.includes("/associations/deals/contacts")) {
      return {
        results: [
          { from: { id: "d-recent" }, to: [{ toObjectId: "c-recent" }] },
          { from: { id: "d-older" }, to: [{ toObjectId: "c-older" }] },
        ],
      };
    }
    if (path.includes("/associations/") || path.includes("/contacts/batch/read")) {
      return { results: [] };
    }
    return { results: [] };
  };

  return { fetchJson, paths, methods };
}

describe("P1-BI-3 HubSpot read coordination", () => {
  it("1 — one shared Agent OS CRM load does not repeat contacts/search or deals/search", async () => {
    const mock = mockCrmFetch({});
    const shared = await loadSharedLiveCrmForAgentOs({
      nowIso: NOW,
      token: "pat-test-token",
      fetchJson: mock.fetchJson as never,
      thresholds: { lookbackDays: ATTRIBUTION_PRIMARY_LOOKBACK_DAYS },
    });
    assert.deepEqual(mock.paths, [
      "/crm/v3/objects/contacts/search",
      "/crm/v3/objects/deals/search",
      "/crm/v3/objects/tasks/search",
      "/crm/v4/associations/contacts/deals/batch/read",
      "/crm/v4/associations/deals/contacts/batch/read",
    ]);
    assert.equal(
      mock.paths.filter((p) => p.includes("/contacts/search")).length,
      1,
    );
    assert.equal(
      mock.paths.filter((p) => p.includes("/deals/search")).length,
      1,
    );
    assert.equal(
      mock.paths.filter((p) => p.includes("/tasks/search")).length,
      1,
    );
    assert.equal(
      mock.paths.filter((p) => p.includes("/associations/")).length,
      2,
    );
    assert.equal(
      mock.paths.filter((p) =>
        p.includes("/objects/contacts/batch/read"),
      ).length,
      0,
    );
    assert.equal(shared.requestPaths.length, 5);
    assert.equal(
      mock.methods.every((m) => m === "POST" || m === "GET"),
      true,
    );
    assert.equal(
      mock.methods.some((m) => /PATCH|PUT|DELETE/i.test(m)),
      false,
    );
    assert.ok(shared.attribution.hubspot.deals.length >= 2);
    assert.ok(
      shared.clientAttention.hubspot.deals.length <
        shared.attribution.hubspot.deals.length,
    );
  });

  it("2 — Client Attention still sees the intended 30-day view", async () => {
    const mock = mockCrmFetch({});
    const shared = await loadSharedLiveCrmForAgentOs({
      nowIso: NOW,
      token: "pat-test-token",
      fetchJson: mock.fetchJson as never,
      thresholds: { lookbackDays: ATTRIBUTION_PRIMARY_LOOKBACK_DAYS },
      clientAttentionLookbackDays: DEFAULT_CLIENT_ATTENTION_THRESHOLDS.lookbackDays,
    });
    assert.equal(DEFAULT_CLIENT_ATTENTION_THRESHOLDS.lookbackDays, 30);
    const dealIds = shared.clientAttention.hubspot.deals.map((d) => d.dealId);
    assert.deepEqual(dealIds, ["d-recent"]);
    assert.equal(
      shared.clientAttention.concierge.submissions.every(
        (s) => Date.parse(s.submittedAt) >= Date.parse(isoDaysAgo(30)),
      ),
      true,
    );
    const ca = runClientAttentionAnalysis({
      mode: "live",
      nowIso: NOW,
      reportingPeriod: { start: "2026-08-01", end: "2026-08-15" },
      prefetchedSources: loadClientAttentionSources({
        mode: "live",
        nowIso: NOW,
        hubspot: { liveResult: shared.clientAttention.hubspot },
        concierge: { liveResult: shared.clientAttention.concierge },
      }),
    });
    assert.ok(ca.audit);
    assert.notEqual(shared.clientAttention.hubspot.status, "failed");
  });

  it("3-4 — Attribution keeps the 90-day requested window and truthful coverage", async () => {
    const mock = mockCrmFetch({});
    const shared = await loadSharedLiveCrmForAgentOs({
      nowIso: NOW,
      token: "pat-test-token",
      fetchJson: mock.fetchJson as never,
      thresholds: { lookbackDays: ATTRIBUTION_PRIMARY_LOOKBACK_DAYS },
    });
    const { snapshot } = runAcceptedInquiryAttributionSpecialist({
      mode: "live",
      nowIso: NOW,
      reportingPeriod: { start: "2026-05-17", end: "2026-08-15" },
      concierge: shared.attribution.concierge,
      crmReadLookbackDays: ATTRIBUTION_PRIMARY_LOOKBACK_DAYS,
      crmRecordCap: DEFAULT_CLIENT_ATTENTION_THRESHOLDS.maxHubSpotDeals,
      crmRecordsReturned: shared.attribution.hubspot.deals.length,
      ga4Available: false,
    });
    assert.equal(snapshot.lookback.requestedDays, 90);
    assert.equal(snapshot.lookback.actualCrmCoverageDays, 90);
    assert.equal(snapshot.acceptedInquiryCount, 2);
    assert.equal(snapshot.ga4Sanity.joinStatus, ATTRIBUTION_JOIN_STATUS);
    assert.equal(snapshot.ga4Sanity.identityJoinPerformed, false);
    assert.equal(snapshot.funnel.qualifiedOpportunity, "unknown-not-yet-defined");
    assert.equal(snapshot.funnel.revenue, "not-attributed");
  });

  it("5-7 — 40-deal cap stays explicit; truncated 90-day read is PARTIAL without 28d comparison", async () => {
    const cap = DEFAULT_CLIENT_ATTENTION_THRESHOLDS.maxHubSpotDeals;
    assert.equal(cap, 40);
    const mock = mockCrmFetch({ dealCount: 40 });
    const shared = await loadSharedLiveCrmForAgentOs({
      nowIso: NOW,
      token: "pat-test-token",
      fetchJson: mock.fetchJson as never,
      thresholds: {
        lookbackDays: ATTRIBUTION_PRIMARY_LOOKBACK_DAYS,
        maxHubSpotDeals: cap,
      },
    });
    assert.equal(shared.attribution.hubspot.deals.length, 40);
    const { snapshot } = runAcceptedInquiryAttributionSpecialist({
      mode: "live",
      nowIso: NOW,
      reportingPeriod: { start: "2026-05-17", end: "2026-08-15" },
      concierge: shared.attribution.concierge,
      crmReadLookbackDays: 90,
      crmRecordCap: cap,
      crmRecordsReturned: shared.attribution.hubspot.deals.length,
      ga4Available: false,
    });
    assert.equal(snapshot.lookback.recordCap, 40);
    assert.equal(snapshot.lookback.truncatedByRecordCap, true);
    assert.equal(snapshot.lookback.completeness, "partial");
    assert.equal(snapshot.optionalComparison, null);
    const caDealIds = shared.clientAttention.hubspot.deals.map((d) => d.dealId);
    assert.ok(caDealIds.includes("d-recent"));
    assert.equal(caDealIds.includes("d-older"), false);
    const afterSlicePaths = mock.paths.length;
    sliceHubSpotLiveBundleForLookback(shared.attribution, {
      lookbackDays: 30,
      nowIso: NOW,
    });
    assert.equal(mock.paths.length, afterSlicePaths);
  });

  it("8-9 — transient and persistent 429 stay unavailable, never a zero-inquiry fact, never retry forever", async () => {
    const mock = mockCrmFetch({
      throwStatus: 429,
      throwPathIncludes: "/contacts/search",
    });
    const shared = await loadSharedLiveCrmForAgentOs({
      nowIso: NOW,
      token: "pat-test-token",
      fetchJson: mock.fetchJson as never,
      thresholds: { lookbackDays: ATTRIBUTION_PRIMARY_LOOKBACK_DAYS },
    });
    assert.equal(
      mock.paths.filter((p) => p.includes("/contacts/search")).length,
      1,
    );
    assert.equal(shared.attribution.hubspot.status, "failed");
    assert.equal(shared.clientAttention.hubspot.status, "failed");
    const { snapshot, recommendations } = runAcceptedInquiryAttributionSpecialist({
      mode: "live",
      nowIso: NOW,
      reportingPeriod: { start: "2026-05-17", end: "2026-08-15" },
      concierge: shared.attribution.concierge,
      crmReadLookbackDays: 90,
      crmRecordCap: 40,
      crmRecordsReturned: shared.attribution.hubspot.deals.length,
      ga4Available: false,
    });
    assert.equal(snapshot.sourceStatus, "unavailable");
    assert.equal(snapshot.lookback.completeness, "unavailable");
    assert.equal(snapshot.originCoverageRate, null);
    assert.equal(snapshot.sampleStrength, null);
    assert.equal(snapshot.founderRecommendationEmitted, false);
    assert.equal(recommendations.length, 0);
    assert.ok(
      snapshot.facts.some((f) => /unknown/i.test(f) || /unavailable/i.test(f)),
    );
    assert.equal(
      snapshot.facts.some((f) => /zero inquir/i.test(f) && !/placeholder/i.test(f)),
      false,
    );
    assert.ok(
      snapshot.inferences.some((i) =>
        /placeholder, not evidence that there were zero inquiries/i.test(i),
      ),
    );
    assert.equal(
      mock.methods.some((m) => /PATCH|PUT|DELETE/i.test(m)),
      false,
    );
  });

  it("10 — no PII reaches founder-facing attribution aggregates", async () => {
    const mock = mockCrmFetch({});
    const shared = await loadSharedLiveCrmForAgentOs({
      nowIso: NOW,
      token: "pat-test-token",
      fetchJson: mock.fetchJson as never,
      thresholds: { lookbackDays: ATTRIBUTION_PRIMARY_LOOKBACK_DAYS },
    });
    const { snapshot } = runAcceptedInquiryAttributionSpecialist({
      mode: "live",
      nowIso: NOW,
      reportingPeriod: { start: "2026-05-17", end: "2026-08-15" },
      concierge: shared.attribution.concierge,
      crmReadLookbackDays: 90,
      crmRecordCap: 40,
      crmRecordsReturned: shared.attribution.hubspot.deals.length,
      ga4Available: false,
    });
    const blob = JSON.stringify({
      byOriginatingTool: snapshot.byOriginatingTool,
      byCtaSurface: snapshot.byCtaSurface,
      byLandingPath: snapshot.byLandingPath,
      facts: snapshot.facts,
    });
    assert.equal(founderFacingAttributionTextContainsPii(blob), false);
    assert.doesNotMatch(blob, /recent\.client@clients\.example\.test/i);
  });

  it("13-14 — Website QA routes and five executives remain unchanged", () => {
    assert.ok(WEBSITE_QA_CRITICAL_ROUTES.length >= 7);
    assert.equal(listExecutives().length, 5);
    assert.equal(operationalExecutives().length, 5);
    assert.deepEqual(
      listExecutives().map((e) => e.id),
      [
        "chief-of-staff",
        "business-intelligence",
        "search-strategy",
        "content",
        "opportunity",
      ],
    );
  });

  it("does not add a founder-now HubSpot rate-limit backlog item", () => {
    const blob = JSON.stringify(CURRENT_OPERATING_BACKLOG);
    assert.doesNotMatch(blob, /Fix HubSpot rate limits/i);
    assert.doesNotMatch(blob, /P1-BI-3/i);
  });

  it("run.ts uses one shared CRM load instead of parallel reconstructions", () => {
    const src = readFileSync(new URL("./run.ts", import.meta.url), "utf8");
    assert.match(src, /loadSharedLiveCrmForAgentOs/);
    assert.doesNotMatch(
      src,
      /Promise\.all\(\s*\[\s*loadClientAttentionSourcesAsync/,
    );
    assert.doesNotMatch(
      src,
      /fetchHubSpotClientAttentionLive\(\s*\{\s*thresholds:\s*\{\s*lookbackDays:\s*ATTRIBUTION_PRIMARY_LOOKBACK_DAYS/,
    );
  });

  it("P1-BI-2 join / qualification / revenue bans remain intact", () => {
    assert.equal(ATTRIBUTION_JOIN_STATUS, "unjoined");
    assert.equal(
      ATTRIBUTION_FUNNEL_STAGES.qualifiedOpportunity,
      "unknown-not-yet-defined",
    );
    assert.equal(ATTRIBUTION_FUNNEL_STAGES.revenue, "not-attributed");
  });
});
