/**
 * Concierge reconstruction + HubSpot live fetch unit tests (mocked HTTP).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HubSpotRequestError } from "@/lib/concierge/hubspot-client";
import {
  conciergeReconstructionQualityReport,
  parseConciergeDealDescription,
  reconstructConciergeFromHubSpot,
} from "./adapters/concierge-from-hubspot";
import {
  fetchHubSpotClientAttentionLive,
  sliceHubSpotLiveBundleForLookback,
} from "./adapters/hubspot-live";
import { gmailLiveReadiness } from "./adapters/gmail";

const SAMPLE_DESCRIPTION = [
  "Submission ID: sub-abc-123",
  "Project Type: Engagement Ring",
  "Shape Interest: Oval",
  "Design Direction: Classic",
  "Ring Presence: No ring yet",
  "Timeline: 1-3 months",
  "Budget Range: $5,000-$8,000",
  "Preferred Contact: Email",
  "Source: website-concierge",
  "",
  "Attribution:",
  "UTM Source: google",
  "UTM Medium: cpc",
  "UTM Campaign: engagement-ring",
  "Landing path: /engagement-rings",
  "Referrer host: google.com /aclk",
  "Last CTA: engagement_rings:hero",
  "Originating Tool: Diamond Studio",
  "",
  "Inspiration / Notes:",
  "Wants something understated for a summer proposal.",
].join("\n");

describe("concierge-from-hubspot reconstruction", () => {
  it("parses Concierge deal description fields", () => {
    const parsed = parseConciergeDealDescription(SAMPLE_DESCRIPTION);
    assert.equal(parsed.submissionId, "sub-abc-123");
    assert.equal(parsed.projectType, "Engagement Ring");
    assert.equal(parsed.timeline, "1-3 months");
    assert.equal(parsed.budgetRange, "$5,000-$8,000");
    assert.equal(parsed.designDirection, "Classic");
    assert.equal(parsed.preferredContact, "Email");
    assert.equal(parsed.originatingTool, "Diamond Studio");
    assert.equal(parsed.landingPath, "/engagement-rings");
    assert.equal(parsed.utmSource, "google");
    assert.equal(parsed.utmMedium, "cpc");
    assert.equal(parsed.utmCampaign, "engagement-ring");
    assert.equal(parsed.lastCtaLocation, "engagement_rings:hero");
    assert.equal(parsed.referrerHost, "google.com");
    assert.ok(parsed.inspirationNotes?.includes("summer proposal"));
  });

  it("reconstructs submissions and enriches from contacts", () => {
    const result = reconstructConciergeFromHubSpot({
      nowIso: "2026-07-28T12:00:00.000Z",
      maxSubmissions: 10,
      dealDescriptions: { "d1": SAMPLE_DESCRIPTION },
      deals: [
        {
          dealId: "d1",
          contactIds: ["c1"],
          dealName: "Alex R. – Engagement Ring",
          createdAt: "2026-07-27T15:00:00.000Z",
        },
      ],
      contacts: [
        {
          contactId: "c1",
          normalizedEmail: "alex.fixture@clients.example.test",
          normalizedPhone: "7045551212",
          firstName: "Alex",
          lastName: "Rivera",
        },
      ],
    });
    assert.equal(result.status, "ok");
    assert.equal(result.submissions.length, 1);
    assert.equal(result.submissions[0].submissionId, "sub-abc-123");
    assert.equal(result.submissions[0].normalizedEmail, "alex.fixture@clients.example.test");
    assert.equal(result.submissions[0].hubspotDealId, "d1");
    assert.equal(result.submissions[0].projectType, "Engagement Ring");
    assert.equal(result.submissions[0].originatingTool, "Diamond Studio");
    assert.equal(result.submissions[0].lastCtaLocation, "engagement_rings:hero");
    assert.equal(result.submissions[0].utmMedium, "cpc");
    assert.equal(result.submissions[0].referrerHost, "google.com");
  });

  it("does not treat every HubSpot deal as a Concierge inquiry", () => {
    const result = reconstructConciergeFromHubSpot({
      nowIso: "2026-07-28T12:00:00.000Z",
      maxSubmissions: 10,
      dealDescriptions: { "other": "Internal wholesale conversation" },
      deals: [
        {
          dealId: "other",
          contactIds: ["c1"],
          dealName: "Trade account — restock",
          createdAt: "2026-07-27T15:00:00.000Z",
        },
      ],
      contacts: [{ contactId: "c1" }],
    });
    assert.equal(result.submissions.length, 0);
    assert.equal(result.status, "empty");
  });

  it("documents ledger gaps without building a ledger", () => {
    const report = conciergeReconstructionQualityReport();
    assert.ok(report.reconstructableFromHubSpot.length >= 5);
    assert.ok(
      report.requiresFutureSubmissionLedger.some((g) =>
        g.includes("soft-accepted"),
      ),
    );
  });
});

describe("gmail live readiness boundary", () => {
  it("stops until gmail.readonly and mailbox env exist", () => {
    const readiness = gmailLiveReadiness({});
    assert.equal(readiness.ready, false);
    assert.ok(
      readiness.missingConfiguration.some((m) => m.includes("gmail.readonly")),
    );
    assert.ok(readiness.missingConfiguration.includes("AGENT_OS_GMAIL_USER"));
  });
});

describe("hubspot live fetch (mocked)", () => {
  it("returns not-configured without token", async () => {
    const priorAccess = process.env.HUBSPOT_ACCESS_TOKEN;
    const priorPrivate = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    delete process.env.HUBSPOT_ACCESS_TOKEN;
    delete process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    try {
      const bundle = await fetchHubSpotClientAttentionLive({
        nowIso: "2026-07-28T12:00:00.000Z",
      });
      assert.equal(bundle.hubspot.status, "not-configured");
      assert.equal(bundle.hubspot.recordCount, 0);
    } finally {
      if (priorAccess !== undefined) process.env.HUBSPOT_ACCESS_TOKEN = priorAccess;
      if (priorPrivate !== undefined) {
        process.env.HUBSPOT_PRIVATE_APP_TOKEN = priorPrivate;
      }
    }
  });

  it("normalizes contacts and deals from search responses", async () => {
    const fetchJson = async (path: string) => {
      if (path.includes("/contacts/search")) {
        return {
          results: [
            {
              id: "c1",
              properties: {
                email: "Casey.Client@clients.example.test",
                firstname: "Casey",
                lastname: "Lee",
                phone: "+15555550100",
                lastmodifieddate: String(Date.now()),
              },
            },
          ],
        };
      }
      if (path.includes("/deals/search")) {
        return {
          results: [
            {
              id: "d1",
              properties: {
                dealname: "Casey Lee – Engagement Ring",
                dealstage: "appointmentscheduled",
                description: SAMPLE_DESCRIPTION,
                createdate: String(Date.now() - 36 * 3600_000),
                hs_lastmodifieddate: String(Date.now() - 30 * 3600_000),
              },
            },
          ],
        };
      }
      if (path.includes("/tasks/search")) {
        return { results: [] };
      }
      if (path.includes("/associations/")) {
        return {
          results: [
            {
              from: { id: "d1" },
              to: [{ toObjectId: "c1" }],
            },
          ],
        };
      }
      if (path.includes("/contacts/batch/read")) {
        return { results: [] };
      }
      return { results: [] };
    };

    const bundle = await fetchHubSpotClientAttentionLive({
      nowIso: "2026-07-28T12:00:00.000Z",
      token: "pat-test-token",
      fetchJson: fetchJson as never,
    });

    assert.equal(bundle.hubspot.status, "ok");
    assert.equal(bundle.hubspot.contacts[0]?.normalizedEmail, "casey.client@clients.example.test");
    assert.equal(bundle.hubspot.deals[0]?.contactIds.includes("c1"), true);
    assert.equal(bundle.concierge.status, "ok");
    assert.equal(bundle.concierge.submissions[0]?.submissionId, "sub-abc-123");
  });

  it("treats 403 as missing read scopes without fabricating records", async () => {
    const fetchJson = async () => {
      throw new HubSpotRequestError(403, "/crm/v3/objects/contacts/search", "missing scopes");
    };

    const bundle = await fetchHubSpotClientAttentionLive({
      token: "pat-test-token",
      fetchJson: fetchJson as never,
    });
    assert.equal(bundle.hubspot.status, "not-configured");
    assert.equal(bundle.hubspot.recordCount, 0);
    assert.ok(
      bundle.hubspot.missingConfiguration?.includes("crm.objects.contacts.read"),
    );
  });

  it("treats 429 as a failed CRM read without fabricating records", async () => {
    const fetchJson = async (path: string) => {
      throw new HubSpotRequestError(429, path, "secondly limit", 1);
    };

    const bundle = await fetchHubSpotClientAttentionLive({
      token: "pat-test-token",
      fetchJson: fetchJson as never,
    });
    assert.equal(bundle.hubspot.status, "failed");
    assert.equal(bundle.hubspot.recordCount, 0);
    assert.equal(bundle.concierge.submissions.length, 0);
  });
});

describe("sliceHubSpotLiveBundleForLookback", () => {
  const nowIso = "2026-08-15T16:00:00.000Z";

  it("derives a 30-day Client Attention view without HubSpot calls and keeps deal-linked contacts", () => {
    const sliced = sliceHubSpotLiveBundleForLookback(
      {
        hubspot: {
          sourceType: "hubspot",
          status: "ok",
          collectedAt: nowIso,
          recordCount: 3,
          contacts: [
            {
              contactId: "c-recent",
              lastModifiedAt: "2026-08-03T16:00:00.000Z",
            },
            {
              contactId: "c-linked-older",
              lastModifiedAt: "2026-06-21T16:00:00.000Z",
            },
            {
              contactId: "c-unlinked-older",
              lastModifiedAt: "2026-06-21T16:00:00.000Z",
            },
          ],
          deals: [
            {
              dealId: "d-recent",
              contactIds: ["c-recent", "c-linked-older"],
              lastModifiedAt: "2026-08-03T16:00:00.000Z",
              createdAt: "2026-08-03T16:00:00.000Z",
            },
            {
              dealId: "d-older",
              contactIds: ["c-unlinked-older"],
              lastModifiedAt: "2026-06-21T16:00:00.000Z",
              createdAt: "2026-06-21T16:00:00.000Z",
            },
          ],
          tasks: [],
        },
        concierge: {
          sourceType: "concierge",
          status: "ok",
          collectedAt: nowIso,
          recordCount: 0,
          submissions: [],
        },
        dealDescriptions: {
          "d-recent": SAMPLE_DESCRIPTION,
          "d-older": SAMPLE_DESCRIPTION.replace("sub-abc-123", "sub-older"),
        },
      },
      { lookbackDays: 30, nowIso },
    );

    assert.deepEqual(
      sliced.hubspot.deals.map((d) => d.dealId),
      ["d-recent"],
    );
    assert.deepEqual(
      sliced.hubspot.contacts.map((c) => c.contactId).sort(),
      ["c-linked-older", "c-recent"],
    );
    assert.equal(
      sliced.hubspot.contacts.some((c) => c.contactId === "c-unlinked-older"),
      false,
    );
    assert.equal(sliced.concierge.submissions.length, 1);
    assert.equal(sliced.concierge.submissions[0]?.submissionId, "sub-abc-123");
  });
});
