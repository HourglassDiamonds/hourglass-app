/**
 * P1-CLIENT-1 — Client Ops exception specialist under BI / Client Attention.
 * GREEN / HubSpot-only. No send, CRM mutation, calendar, or sixth executive.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import { loadAllSources } from "./adapters/load";
import {
  CLIENT_ATTENTION_RECOMMENDATION_PREFIX,
  CLIENT_OPS_GREEN_CAPABILITIES,
  CLIENT_OPS_RED_CAPABILITIES,
  GMAIL_DEPENDENT_CLIENT_OPS_SIGNAL_TYPES,
  HUBSPOT_V1_CLIENT_OPS_SIGNAL_TYPES,
  MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES,
  classifyClientOpsPermissionTier,
  clientOpsMayExecute,
  founderFacingContainsDisallowedAmount,
  founderFacingTextsAreSafe,
  gmailLiveReadiness,
  hubSpotLiveCanProveInboundWithoutLaterReply,
  isGmailDependentClientOpsSignalType,
  isHubSpotV1ClientOpsSignalType,
  isTerminalDeal,
  runClientAttentionAnalysis,
  CLIENT_ATTENTION_FIXTURE_NOW,
} from "./bi/client-attention";
import { rankClientAttentionSignals } from "./bi/client-attention/ranking";
import type { ClientAttentionSourceBundle } from "./bi/client-attention/adapters/types";
import type { ClientAttentionSignal } from "./bi/client-attention/types";
import { emptyContentExecutiveOutput } from "./executives/content";
import { emptyOpportunityExecutiveOutput } from "./executives/opportunity";
import { emptySearchStrategyOutput } from "./executives/search-strategy";
import { runBusinessIntelligence } from "./executives/business-intelligence";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import {
  isExecutiveOperational,
  listExecutives,
  operationalExecutives,
  scaffoldExecutives,
} from "./index";
import { CURRENT_OPERATING_BACKLOG } from "./operating-backlog";
import { isWatchItem } from "./operating-backlog/surface-policy";
import { isCaseStudyProductionFounderNow } from "./content/authority";
import { runAgentOsBrief } from "./run";
import { WEBSITE_QA_ROOT_EXCEPTION_ID } from "./bi/website-qa";

const PERIOD = { ...FIXTURE_REPORTING_PERIOD };
const NOW = CLIENT_ATTENTION_FIXTURE_NOW;
const ROOT = resolve(process.cwd());

function hoursAgo(hours: number): string {
  return new Date(Date.parse(NOW) - hours * 3600_000).toISOString();
}
function daysAgo(days: number): string {
  return hoursAgo(days * 24);
}
function daysFromNow(days: number): string {
  return new Date(Date.parse(NOW) + days * 86400_000).toISOString().slice(0, 10);
}

function emptyGmailNotConfigured() {
  return {
    sourceType: "gmail" as const,
    status: "not-configured" as const,
    collectedAt: NOW,
    recordCount: 0,
    threads: [],
    missingConfiguration: ["scope:gmail.readonly"],
  };
}

function emptyConcierge() {
  return {
    sourceType: "concierge" as const,
    status: "empty" as const,
    collectedAt: NOW,
    recordCount: 0,
    submissions: [],
  };
}

function hubspotBundle(over: {
  contacts?: ClientAttentionSourceBundle["hubspot"]["contacts"];
  deals?: ClientAttentionSourceBundle["hubspot"]["deals"];
  tasks?: ClientAttentionSourceBundle["hubspot"]["tasks"];
  status?: ClientAttentionSourceBundle["hubspot"]["status"];
  gmail?: ClientAttentionSourceBundle["gmail"];
  concierge?: ClientAttentionSourceBundle["concierge"];
}): ClientAttentionSourceBundle {
  const contacts = over.contacts ?? [];
  const deals = over.deals ?? [];
  const tasks = over.tasks ?? [];
  return {
    gmail: over.gmail ?? emptyGmailNotConfigured(),
    hubspot: {
      sourceType: "hubspot",
      status: over.status ?? "ok",
      collectedAt: NOW,
      recordCount: contacts.length + deals.length + tasks.length,
      contacts,
      deals,
      tasks,
    },
    concierge: over.concierge ?? emptyConcierge(),
  };
}

function analyze(
  bundle: ClientAttentionSourceBundle,
  extra?: {
    conciergeSlaOverdueIdentities?: Parameters<
      typeof runClientAttentionAnalysis
    >[0]["conciergeSlaOverdueIdentities"];
  },
) {
  return runClientAttentionAnalysis({
    mode: "fixture",
    nowIso: NOW,
    reportingPeriod: PERIOD,
    prefetchedSources: bundle,
    conciergeSlaOverdueIdentities: extra?.conciergeSlaOverdueIdentities,
  });
}

function baseSignal(
  over: Partial<ClientAttentionSignal> &
    Pick<ClientAttentionSignal, "id" | "subjectKey">,
): ClientAttentionSignal {
  return {
    sourceTypes: ["hubspot"],
    signalType: "follow-up-due",
    urgency: "high",
    confidence: "high",
    responseState: "not-applicable",
    summary: "A scheduled HubSpot follow-up is due or overdue.",
    whyItMatters: "A promised next step loses trust when it slips.",
    recommendedAction: "Complete today's follow-up with a client.",
    evidence: [],
    founderRankable: true,
    ...over,
  };
}

describe("P1-CLIENT-1 signal provenance", () => {
  it("A — HubSpot-only cannot emit reply-overdue without inbound-without-later-reply evidence", () => {
    assert.equal(hubSpotLiveCanProveInboundWithoutLaterReply(), false);
    const result = analyze(
      hubspotBundle({
        contacts: [
          {
            contactId: "c-age",
            firstName: "Aged",
            lastName: "Client",
            lastActivityAt: daysAgo(10),
            lastModifiedAt: daysAgo(10),
          },
        ],
        deals: [
          {
            dealId: "d-age",
            contactIds: ["c-age"],
            stage: "appointmentscheduled",
            lastActivityAt: daysAgo(10),
            lastModifiedAt: daysAgo(10),
            createdAt: daysAgo(12),
          },
        ],
      }),
    );
    assert.equal(
      result.audit.signals.some((s) => s.signalType === "reply-overdue"),
      false,
    );
    assert.equal(
      result.recommendations.some((r) =>
        r.recommendationId.includes("reply-overdue"),
      ),
      false,
    );
  });

  it("B — HubSpot-only cannot emit unanswered-inbound from fixture-only message state", () => {
    const result = analyze(
      hubspotBundle({
        contacts: [
          {
            contactId: "c-msg",
            normalizedEmail: "msg.client@clients.example.test",
            firstName: "Msg",
            lastName: "Client",
          },
        ],
        deals: [
          {
            dealId: "d-msg",
            contactIds: ["c-msg"],
            stage: "appointmentscheduled",
            lastActivityAt: daysAgo(1),
            nextActivityAt: daysFromNow(5),
          },
        ],
        gmail: {
          sourceType: "gmail",
          status: "not-configured",
          collectedAt: NOW,
          recordCount: 1,
          threads: [
            {
              threadId: "th-fixture-only",
              normalizedParticipants: ["msg.client@clients.example.test"],
              normalizedPrimaryEmail: "msg.client@clients.example.test",
              latestDirection: "inbound",
              lastInboundAt: hoursAgo(30),
              hasLaterOutboundReply: false,
              automated: false,
              businessRelevant: true,
              contextTags: [],
            },
          ],
          missingConfiguration: ["scope:gmail.readonly"],
        },
      }),
    );
    assert.equal(
      result.audit.signals.some((s) => s.signalType === "unanswered-inbound"),
      false,
    );
    assert.equal(
      result.audit.signals.some((s) => s.signalType === "reply-overdue"),
      false,
    );
    assert.equal(result.audit.sourceAvailability.gmail, "not-configured");
  });

  it("C — Gmail unavailable does not create false reply-state exceptions", () => {
    const result = analyze(
      hubspotBundle({
        contacts: [
          {
            contactId: "c-quiet-reply",
            firstName: "Quiet",
            lastName: "Reply",
            lastActivityAt: daysAgo(2),
            nextActivityAt: daysFromNow(8),
          },
        ],
        deals: [
          {
            dealId: "d-quiet-reply",
            contactIds: ["c-quiet-reply"],
            stage: "appointmentscheduled",
            lastActivityAt: daysAgo(2),
            nextActivityAt: daysFromNow(8),
          },
        ],
      }),
    );
    assert.equal(result.audit.sourceAvailability.gmail, "not-configured");
    assert.equal(result.audit.clientOpsHealth, "healthy");
    assert.equal(
      result.audit.signals.some(
        (s) =>
          s.signalType === "reply-overdue" ||
          s.signalType === "unanswered-inbound",
      ),
      false,
    );
    assert.equal(result.recommendations.length, 0);
  });

  it("D — HubSpot live path has no inbound/outbound engagement evidence", () => {
    assert.equal(hubSpotLiveCanProveInboundWithoutLaterReply(), false);
    const live = readFileSync(
      resolve(ROOT, "lib/agent-os/bi/client-attention/adapters/hubspot-live.ts"),
      "utf8",
    );
    assert.match(live, /notes_last_contacted/);
    assert.match(live, /searchObjects\(fetchJson, token, "contacts"/);
    assert.match(live, /searchObjects\(fetchJson, token, "deals"/);
    assert.match(live, /searchObjects\(fetchJson, token, "tasks"/);
    assert.doesNotMatch(live, /crm\/v3\/objects\/emails/);
    assert.doesNotMatch(live, /\/engagements/);
    assert.ok(
      GMAIL_DEPENDENT_CLIENT_OPS_SIGNAL_TYPES.includes("reply-overdue"),
    );
    assert.ok(
      GMAIL_DEPENDENT_CLIENT_OPS_SIGNAL_TYPES.includes("unanswered-inbound"),
    );
    assert.equal(isHubSpotV1ClientOpsSignalType("reply-overdue"), false);
    assert.equal(isHubSpotV1ClientOpsSignalType("unanswered-inbound"), false);
    assert.equal(isGmailDependentClientOpsSignalType("follow-up-due"), false);
  });

  it("E — follow-up-due and other HubSpot-supported signals remain functional", () => {
    const follow = analyze(
      hubspotBundle({
        contacts: [
          {
            contactId: "c-e-task",
            firstName: "Task",
            lastName: "Client",
          },
        ],
        deals: [
          {
            dealId: "d-e-task",
            contactIds: ["c-e-task"],
            stage: "appointmentscheduled",
            lastActivityAt: daysAgo(2),
          },
        ],
        tasks: [
          {
            taskId: "t-e-open",
            contactId: "c-e-task",
            dealId: "d-e-task",
            status: "open",
            dueAt: daysAgo(1),
            subject: "Call client",
          },
        ],
      }),
    );
    assert.equal(
      follow.recommendations.filter((r) =>
        r.recommendationId.includes("follow-up-due"),
      ).length,
      1,
    );
    assert.equal(follow.audit.clientOpsHealth, "exceptions");
    for (const type of HUBSPOT_V1_CLIENT_OPS_SIGNAL_TYPES) {
      assert.equal(isHubSpotV1ClientOpsSignalType(type), true);
    }
  });

  it("F — unsupported reply-state does not make Client Ops UNKNOWN globally", () => {
    const result = analyze(
      hubspotBundle({
        contacts: [
          {
            contactId: "c-f-task",
            firstName: "Keep",
            lastName: "Healthy",
          },
        ],
        deals: [
          {
            dealId: "d-f-task",
            contactIds: ["c-f-task"],
            stage: "appointmentscheduled",
            lastActivityAt: daysAgo(1),
          },
        ],
        tasks: [
          {
            taskId: "t-f-open",
            contactId: "c-f-task",
            status: "open",
            dueAt: daysAgo(1),
          },
        ],
      }),
    );
    assert.equal(result.audit.sourceAvailability.gmail, "not-configured");
    assert.equal(result.audit.clientOpsHealth, "exceptions");
    assert.equal(
      result.audit.signals.some((s) =>
        isGmailDependentClientOpsSignalType(s.signalType),
      ),
      false,
    );
    assert.ok(
      result.recommendations.some((r) =>
        r.recommendationId.includes("follow-up-due"),
      ),
    );
  });

  it("G — terminal inactive matching cannot suppress an unrelated active stage via substring", () => {
    assert.equal(
      isTerminalDeal({
        dealId: "d-appt",
        contactIds: [],
        stage: "appointmentscheduled",
      }),
      false,
    );
    assert.equal(
      isTerminalDeal({
        dealId: "d-qualified",
        contactIds: [],
        stage: "qualifiedtobuy",
      }),
      false,
    );
    assert.equal(
      isTerminalDeal({
        dealId: "d-preinactive",
        contactIds: [],
        stage: "preinactivehold",
      }),
      false,
    );
    assert.equal(
      isTerminalDeal({
        dealId: "d-inactive",
        contactIds: [],
        stage: "inactive",
      }),
      true,
    );
    assert.equal(
      isTerminalDeal({
        dealId: "d-inactive-hyphen",
        contactIds: [],
        stage: "closed-inactive",
      }),
      true,
    );
    const result = analyze(
      hubspotBundle({
        contacts: [
          {
            contactId: "c-active-stage",
            firstName: "Active",
            lastName: "Stage",
          },
        ],
        deals: [
          {
            dealId: "d-active-stage",
            contactIds: ["c-active-stage"],
            stage: "appointmentscheduled",
            lastActivityAt: daysAgo(2),
          },
        ],
        tasks: [
          {
            taskId: "t-active-stage",
            contactId: "c-active-stage",
            status: "open",
            dueAt: daysAgo(1),
          },
        ],
      }),
    );
    assert.ok(result.recommendations.length >= 1);
  });

  it("H — Concierge SLA timing/escalation constants and identity helper are additive", () => {
    const slaTypes = readFileSync(
      resolve(ROOT, "lib/concierge/sla/types.ts"),
      "utf8",
    );
    const slaWatchdog = readFileSync(
      resolve(ROOT, "lib/concierge/sla/watchdog.ts"),
      "utf8",
    );
    assert.match(slaTypes, /CONCIERGE_SLA_DUE_SOON_HOURS = 20/);
    assert.match(slaTypes, /CONCIERGE_SLA_DUE_HOURS = 24/);
    assert.match(slaWatchdog, /listOverdueConciergeSlaIdentities/);
    assert.match(slaWatchdog, /countOverdueConciergeSla/);
    assert.match(slaWatchdog, /isOverdueWindow\(current\.submittedAt/);
    assert.match(slaWatchdog, /sendConciergeSlaAlert/);
  });

  it("I — no duplicate SLA + Client Ops founder action", () => {
    const bundle = hubspotBundle({
      contacts: [
        {
          contactId: "c-sla-i",
          firstName: "Sla",
          lastName: "Overlap",
        },
      ],
      deals: [
        {
          dealId: "d-sla-i",
          contactIds: ["c-sla-i"],
          stage: "appointmentscheduled",
          lastActivityAt: daysAgo(2),
        },
      ],
      tasks: [
        {
          taskId: "t-sla-i",
          contactId: "c-sla-i",
          dealId: "d-sla-i",
          status: "open",
          dueAt: daysAgo(1),
        },
      ],
    });
    const overlapping = analyze(bundle, {
      conciergeSlaOverdueIdentities: [
        { dealId: "d-sla-i", contactId: "c-sla-i", submissionId: "sub-i" },
      ],
    });
    assert.equal(overlapping.recommendations.length, 0);
    const alone = analyze(bundle);
    assert.ok(alone.recommendations.length >= 1);
  });

  it("J — Client Ops does not perform an additional HubSpot read", () => {
    const clientOps = readFileSync(
      resolve(ROOT, "lib/agent-os/bi/client-attention/client-ops.ts"),
      "utf8",
    );
    assert.doesNotMatch(clientOps, /fetchHubSpotClientAttentionLive/);
    assert.doesNotMatch(clientOps, /hubspotFetchJson/);
    assert.doesNotMatch(clientOps, /loadSharedLiveCrmForAgentOs/);
  });

  it("K — no Gmail / Calendar connection in Client Ops", () => {
    const gmail = gmailLiveReadiness();
    assert.equal(gmail.ready, false);
    const clientOps = readFileSync(
      resolve(ROOT, "lib/agent-os/bi/client-attention/client-ops.ts"),
      "utf8",
    );
    assert.doesNotMatch(clientOps, /gmail\.googleapis|calendar\.googleapis/i);
  });

  it("L — no CRM writes", () => {
    assert.equal(
      classifyClientOpsPermissionTier("Update the HubSpot deal stage"),
      "red",
    );
    assert.equal(clientOpsMayExecute("Create a HubSpot contact"), false);
  });

  it("M — five executives unchanged", () => {
    assert.deepEqual(listExecutives().map((e) => e.id), [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ]);
  });
});

describe("P1-CLIENT-1 registry", () => {
  it("A — keeps exactly five executives and does not add Client Ops as an executive", () => {
    assert.deepEqual(listExecutives().map((e) => e.id), [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ]);
    assert.equal(operationalExecutives().length, 5);
    assert.deepEqual(scaffoldExecutives(), []);
    assert.equal(isExecutiveOperational("business-intelligence"), true);
    const bi = listExecutives().find((e) => e.id === "business-intelligence");
    assert.ok(bi?.ownedDomains.includes("client attention intelligence"));
    assert.ok(bi?.ownedDomains.includes("client ops"));
  });
});

describe("P1-CLIENT-1 shared HubSpot evidence", () => {
  it("B — Client Ops consumes shared CRM evidence and does not fetch HubSpot itself", () => {
    const clientOps = readFileSync(
      resolve(ROOT, "lib/agent-os/bi/client-attention/client-ops.ts"),
      "utf8",
    );
    const permissions = readFileSync(
      resolve(ROOT, "lib/agent-os/bi/client-attention/permissions.ts"),
      "utf8",
    );
    const cosEscalation = readFileSync(
      resolve(ROOT, "lib/agent-os/bi/client-attention/cos-escalation.ts"),
      "utf8",
    );
    for (const src of [clientOps, permissions, cosEscalation]) {
      assert.doesNotMatch(src, /fetchHubSpotClientAttentionLive/);
      assert.doesNotMatch(src, /hubspotFetchJson/);
      assert.doesNotMatch(src, /loadSharedLiveCrmForAgentOs/);
    }
    assert.ok(
      CLIENT_OPS_GREEN_CAPABILITIES.includes("read-shared-hubspot-evidence"),
    );
  });
});

describe("P1-CLIENT-1 silent / bounded exceptions", () => {
  it("C — no actionable client exceptions → Client Attention omitted", async () => {
    const sources = hubspotBundle({
      contacts: [
        {
          contactId: "c-quiet",
          firstName: "Quiet",
          lastName: "Client",
          lastActivityAt: daysAgo(1),
          nextActivityAt: daysFromNow(10),
        },
      ],
      deals: [
        {
          dealId: "d-quiet",
          contactIds: ["c-quiet"],
          stage: "appointmentscheduled",
          lastActivityAt: daysAgo(1),
          nextActivityAt: daysFromNow(10),
        },
      ],
    });
    const result = analyze(sources);
    assert.equal(result.audit.clientOpsHealth, "healthy");
    assert.equal(result.recommendations.length, 0);

    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD, {
      mode: "fixture",
      clientAttentionSources: sources,
    });
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.equal(cos.brief.clientAttentionItems, null);
    assert.doesNotMatch(cos.brief.markdown, /## Client Attention/);
    assert.doesNotMatch(cos.brief.markdown, /review CRM/i);
  });

  it("D — future Gmail live authority can still generate reply-overdue (not HubSpot-only V1)", () => {
    const result = analyze(
      hubspotBundle({
        contacts: [
          {
            contactId: "c-reply",
            normalizedEmail: "reply.client@clients.example.test",
            firstName: "Reply",
            lastName: "Client",
          },
        ],
        gmail: {
          sourceType: "gmail",
          status: "ok",
          collectedAt: NOW,
          recordCount: 1,
          threads: [
            {
              threadId: "th-reply",
              normalizedParticipants: ["reply.client@clients.example.test"],
              normalizedPrimaryEmail: "reply.client@clients.example.test",
              latestDirection: "inbound",
              lastInboundAt: hoursAgo(30),
              hasLaterOutboundReply: false,
              automated: false,
              businessRelevant: true,
              contextTags: [],
              safeParticipantLabel: "Reply C.",
            },
          ],
        },
      }),
    );
    const overdue = result.recommendations.filter((r) =>
      r.recommendationId.includes("reply-overdue"),
    );
    assert.equal(overdue.length, 1);
    assert.equal(result.audit.clientOpsHealth, "exceptions");
  });

  it("E — follow-up due → one bounded client exception", () => {
    const result = analyze(
      hubspotBundle({
        contacts: [
          {
            contactId: "c-task",
            firstName: "Task",
            lastName: "Client",
          },
        ],
        deals: [
          {
            dealId: "d-task",
            contactIds: ["c-task"],
            stage: "appointmentscheduled",
            lastActivityAt: daysAgo(2),
          },
        ],
        tasks: [
          {
            taskId: "t-open",
            contactId: "c-task",
            dealId: "d-task",
            status: "open",
            dueAt: daysAgo(1),
            subject: "Call client",
          },
        ],
      }),
    );
    const follow = result.recommendations.filter((r) =>
      r.recommendationId.includes("follow-up-due"),
    );
    assert.equal(follow.length, 1);
    assert.match(follow[0]!.proposedAction, /follow-up/i);
    assert.equal(result.audit.clientOpsHealth, "exceptions");
  });

  it("F — approaching real date uses existing threshold (watch vs action)", () => {
    const action = analyze(
      hubspotBundle({
        contacts: [
          {
            contactId: "c-soon",
            firstName: "Soon",
            lastName: "Client",
            lastActivityAt: daysAgo(1),
          },
        ],
        deals: [
          {
            dealId: "d-soon",
            contactIds: ["c-soon"],
            stage: "presentationscheduled",
            lastActivityAt: daysAgo(1),
            proposalDate: daysFromNow(3),
            nextActivityAt: daysFromNow(2),
          },
        ],
      }),
    );
    assert.ok(
      action.recommendations.some((r) =>
        r.recommendationId.includes("proposal-date-approaching"),
      ),
    );

    const watch = analyze(
      hubspotBundle({
        contacts: [
          {
            contactId: "c-later",
            firstName: "Later",
            lastName: "Client",
            lastActivityAt: daysAgo(1),
          },
        ],
        deals: [
          {
            dealId: "d-later",
            contactIds: ["c-later"],
            stage: "presentationscheduled",
            lastActivityAt: daysAgo(1),
            proposalDate: daysFromNow(10),
            nextActivityAt: daysFromNow(5),
          },
        ],
      }),
    );
    assert.ok(
      watch.audit.signals.some(
        (s) => s.signalType === "proposal-date-approaching",
      ),
    );
    assert.equal(
      watch.recommendations.filter((r) =>
        r.recommendationId.includes("proposal-date-approaching"),
      ).length,
      0,
    );
    assert.equal(watch.audit.clientOpsSeverityCounts.watch >= 1, true);
  });

  it("G — terminal deal (closed / cancelled) is suppressed", () => {
    for (const stage of ["closedwon", "closedlost", "cancelled"] as const) {
      const result = analyze(
        hubspotBundle({
          contacts: [
            {
              contactId: `c-${stage}`,
              firstName: "Done",
              lastName: "Client",
              nextActivityAt: daysAgo(1),
            },
          ],
          deals: [
            {
              dealId: `d-${stage}`,
              contactIds: [`c-${stage}`],
              stage,
              closed: stage.startsWith("closed"),
              lastActivityAt: daysAgo(10),
            },
          ],
          tasks: [
            {
              taskId: `t-${stage}`,
              contactId: `c-${stage}`,
              status: "open",
              dueAt: daysAgo(1),
            },
          ],
        }),
      );
      assert.equal(
        result.recommendations.length,
        0,
        `${stage} must not surface`,
      );
      assert.equal(
        isTerminalDeal({
          dealId: `d-${stage}`,
          contactIds: [],
          stage,
          closed: stage.startsWith("closed"),
        }),
        true,
      );
    }
  });

  it("H — stale record with no current obligation is suppressed", () => {
    const result = analyze(
      hubspotBundle({
        contacts: [
          {
            contactId: "c-old",
            firstName: "Old",
            lastName: "Client",
            lastActivityAt: daysAgo(2),
          },
        ],
        deals: [
          {
            dealId: "d-old",
            contactIds: ["c-old"],
            stage: "lead",
            createdAt: daysAgo(30),
            lastActivityAt: daysAgo(2),
          },
        ],
        concierge: {
          sourceType: "concierge",
          status: "ok",
          collectedAt: NOW,
          recordCount: 1,
          submissions: [
            {
              submissionId: "sub-old",
              accepted: true,
              submittedAt: daysAgo(30),
              firstName: "Old",
              lastName: "Client",
              hubspotContactId: "c-old",
              hubspotDealId: "d-old",
            },
          ],
        },
      }),
    );
    assert.ok(
      !result.audit.signals.some((s) => s.signalType === "reply-overdue"),
    );
    assert.equal(result.recommendations.length, 0);
  });

  it("I — many exceptions are ranked and capped (no CRM dump)", async () => {
    const contacts = Array.from({ length: 8 }, (_, i) => ({
      contactId: `c-many-${i}`,
      firstName: `Client${i}`,
      lastName: "Many",
    }));
    const deals = contacts.map((c, i) => ({
      dealId: `d-many-${i}`,
      contactIds: [c.contactId],
      stage: "appointmentscheduled",
      lastActivityAt: daysAgo(2),
    }));
    const tasks = contacts.map((c, i) => ({
      taskId: `t-many-${i}`,
      contactId: c.contactId,
      dealId: `d-many-${i}`,
      status: "open" as const,
      dueAt: daysAgo(1),
      subject: "Follow up",
    }));
    const sources = hubspotBundle({ contacts, deals, tasks });
    const result = analyze(sources);
    assert.ok(result.audit.signals.length >= 4);
    assert.ok(
      result.recommendations.length <= MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES,
    );
    assert.equal(MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES, 3);

    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD, {
      mode: "fixture",
      clientAttentionSources: sources,
    });
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.ok((cos.brief.clientAttentionItems?.length ?? 0) <= 3);
    assert.doesNotMatch(
      cos.brief.markdown,
      /CRM dump|all contacts|entire pipeline/i,
    );
  });
});

describe("P1-CLIENT-1 privacy, ranking, source-health, dedupe", () => {
  it("J — founder output has no email, phone, HubSpot ids, or raw notes", () => {
    const result = analyze(
      hubspotBundle({
        contacts: [
          {
            contactId: "fixture-contact-secret",
            normalizedEmail: "secret.client@clients.example.test",
            normalizedPhone: "7045550199",
            firstName: "Secret",
            lastName: "Client",
            notesSummary: "Wants a 3ct oval, budget $40k, lives at 12 Main St",
          },
        ],
        deals: [
          {
            dealId: "fixture-deal-secret",
            contactIds: ["fixture-contact-secret"],
            stage: "appointmentscheduled",
            lastActivityAt: daysAgo(2),
          },
        ],
        tasks: [
          {
            taskId: "fixture-task-secret",
            contactId: "fixture-contact-secret",
            status: "open",
            dueAt: daysAgo(1),
          },
        ],
      }),
    );
    const texts = result.recommendations.flatMap((r) => [
      r.title,
      r.proposedAction,
      r.plainLanguageExplanation,
    ]);
    const founderBlob = texts.join("\n") + JSON.stringify(result.recommendations);
    assert.doesNotMatch(founderBlob, /secret\.client@clients\.example\.test/i);
    assert.doesNotMatch(founderBlob, /7045550199/);
    assert.doesNotMatch(founderBlob, /fixture-contact-secret/);
    assert.doesNotMatch(founderBlob, /fixture-deal-secret/);
    assert.doesNotMatch(founderBlob, /12 Main St/);
    assert.doesNotMatch(founderBlob, /budget \$40k/i);
    assert.ok(founderFacingTextsAreSafe(texts));
    assert.ok(!texts.some((t) => founderFacingContainsDisallowedAmount(t)));
  });

  it("K — deal amount does not affect client-attention ranking", () => {
    const low = rankClientAttentionSignals([
      baseSignal({
        id: `${CLIENT_ATTENTION_RECOMMENDATION_PREFIX}:follow-up-due:low`,
        subjectKey: "subj_contact_low",
        displayName: "Low A.",
      }),
    ]);
    const high = rankClientAttentionSignals([
      baseSignal({
        id: `${CLIENT_ATTENTION_RECOMMENDATION_PREFIX}:follow-up-due:high`,
        subjectKey: "subj_contact_high",
        displayName: "High A.",
      }),
    ]);
    assert.equal(low[0]!.totalScore, high[0]!.totalScore);
    assert.equal("amount" in low[0]!.dimensions, false);
    const rankingSrc = readFileSync(
      resolve(ROOT, "lib/agent-os/bi/client-attention/ranking.ts"),
      "utf8",
    );
    assert.match(rankingSrc, /amount is intentionally absent/i);
  });

  it("L — HubSpot unavailable → UNKNOWN, not false zero clients", async () => {
    const result = analyze(
      hubspotBundle({
        status: "failed",
        gmail: {
          sourceType: "gmail",
          status: "ok",
          collectedAt: NOW,
          recordCount: 1,
          threads: [
            {
              threadId: "th-ignored",
              normalizedParticipants: ["ignored@clients.example.test"],
              normalizedPrimaryEmail: "ignored@clients.example.test",
              latestDirection: "inbound",
              lastInboundAt: hoursAgo(40),
              hasLaterOutboundReply: false,
              automated: false,
              businessRelevant: true,
              contextTags: [],
            },
          ],
        },
      }),
    );
    assert.equal(result.audit.clientOpsHealth, "unknown");
    assert.equal(result.recommendations.length, 0);
    assert.match(result.audit.inferences.join(" "), /UNKNOWN/i);
    assert.doesNotMatch(
      result.audit.facts.join(" "),
      /zero client|no clients need attention/i,
    );

    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD, {
      mode: "fixture",
      clientAttentionSources: hubspotBundle({ status: "failed" }),
    });
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.equal(cos.brief.clientAttentionItems, null);
    assert.doesNotMatch(cos.brief.markdown, /## Client Attention/);
    assert.doesNotMatch(cos.brief.markdown, /no clients need attention/i);
    assert.doesNotMatch(cos.brief.markdown, /CRM broken/i);
    assert.doesNotMatch(cos.brief.markdown, /review CRM/i);
  });

  it("M — Concierge SLA + Client Ops same inquiry → one founder action", () => {
    const bundle = hubspotBundle({
      contacts: [
        {
          contactId: "c-sla",
          firstName: "Sla",
          lastName: "Client",
        },
      ],
      deals: [
        {
          dealId: "d-sla",
          contactIds: ["c-sla"],
          stage: "appointmentscheduled",
          lastActivityAt: daysAgo(2),
        },
      ],
      tasks: [
        {
          taskId: "t-sla",
          contactId: "c-sla",
          dealId: "d-sla",
          status: "open",
          dueAt: daysAgo(1),
          subject: "Respond to Concierge inquiry — Deal d-sla",
        },
      ],
    });
    const overlapping = analyze(bundle, {
      conciergeSlaOverdueIdentities: [
        { dealId: "d-sla", contactId: "c-sla", submissionId: "sub-sla" },
      ],
    });
    assert.equal(overlapping.recommendations.length, 0);
    const alone = analyze(bundle);
    assert.ok(alone.recommendations.length >= 1);
  });
});

describe("P1-CLIENT-1 permissions and out of scope", () => {
  it("N — no send", () => {
    assert.equal(
      classifyClientOpsPermissionTier("Send a reply email to the client"),
      "red",
    );
    assert.equal(clientOpsMayExecute("Send a reply email to the client"), false);
    assert.ok(CLIENT_OPS_RED_CAPABILITIES.includes("send-client-email"));
  });

  it("O — no CRM mutation", () => {
    assert.equal(
      classifyClientOpsPermissionTier(
        "Update the HubSpot deal stage to qualified",
      ),
      "red",
    );
    assert.equal(
      classifyClientOpsPermissionTier("Mark the CRM task complete"),
      "red",
    );
    assert.equal(
      classifyClientOpsPermissionTier("Create a HubSpot contact for this inquiry"),
      "red",
    );
  });

  it("P — no calendar mutation", () => {
    assert.equal(
      classifyClientOpsPermissionTier(
        "Schedule a calendar appointment for Tuesday",
      ),
      "red",
    );
  });

  it("Q — no new external connection (Gmail / Calendar remain off)", () => {
    const gmail = gmailLiveReadiness();
    assert.equal(gmail.ready, false);
    const clientOps = readFileSync(
      resolve(ROOT, "lib/agent-os/bi/client-attention/client-ops.ts"),
      "utf8",
    );
    assert.doesNotMatch(clientOps, /gmail\.googleapis|calendar\.googleapis/i);
    assert.doesNotMatch(clientOps, /GOOGLE_CALENDAR|GMAIL_USER/);
  });

  it("R — Case Studies remain Watch", () => {
    assert.equal(
      isCaseStudyProductionFounderNow(CURRENT_OPERATING_BACKLOG),
      false,
    );
    const caseStudy = CURRENT_OPERATING_BACKLOG.masterSprint.items.find(
      (i) => i.id === "sprint-case-study-production",
    );
    assert.ok(caseStudy);
    assert.ok(isWatchItem(caseStudy));
    assert.ok(
      !CURRENT_OPERATING_BACKLOG.masterSprint.items.some((i) =>
        /activate client ops/i.test(i.title),
      ),
    );
  });

  it("S — QA remains unaffected", async () => {
    const run = await runAgentOsBrief({
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.equal(
      run.recommendations.some(
        (r) => r.recommendationId === WEBSITE_QA_ROOT_EXCEPTION_ID,
      ),
      false,
    );
    assert.equal(run.executivesInvoked.length, 5);
  });
});

describe("P1-CLIENT-1 CoS surfacing", () => {
  it("omits Client Attention when healthy and does not invent a review-CRM task", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD, {
      mode: "fixture",
      clientAttentionSources: hubspotBundle({}),
    });
    assert.equal(bi.clientAttentionAudit.clientOpsHealth, "healthy");
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.equal(cos.brief.clientAttentionItems, null);
    assert.doesNotMatch(cos.brief.markdown, /review CRM/i);
  });

  it("surfaces one follow-up exception in Client Attention without a CRM dump", async () => {
    const sources = hubspotBundle({
      contacts: [
        {
          contactId: "c-brief",
          firstName: "Brief",
          lastName: "Client",
        },
      ],
      deals: [
        {
          dealId: "d-brief",
          contactIds: ["c-brief"],
          stage: "appointmentscheduled",
          lastActivityAt: daysAgo(2),
        },
      ],
      tasks: [
        {
          taskId: "t-brief",
          contactId: "c-brief",
          status: "open",
          dueAt: daysAgo(1),
        },
      ],
    });
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD, {
      mode: "fixture",
      clientAttentionSources: sources,
    });
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.ok(cos.brief.clientAttentionItems);
    assert.equal(cos.brief.clientAttentionItems!.length, 1);
    assert.match(cos.brief.markdown, /## Client Attention/);
    assert.match(cos.brief.clientAttentionItems![0]!.title, /Brief/);
    assert.doesNotMatch(JSON.stringify(cos.brief.clientAttentionItems), /@/);
    assert.doesNotMatch(
      JSON.stringify(cos.brief.clientAttentionItems),
      /c-brief/,
    );
  });
});
