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
import { fetchHubSpotClientAttentionLive } from "./adapters/hubspot-live";
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
  "Landing path: /engagement-rings",
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
});
