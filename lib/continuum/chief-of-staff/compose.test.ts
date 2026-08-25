import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CURRENT_OPERATING_BACKLOG } from "@/lib/agent-os/operating-backlog";
import type { OperatingBacklog } from "@/lib/agent-os/operating-backlog";
import type { ClientAttentionSignal } from "@/lib/agent-os/bi/client-attention/types";
import { WEBSITE_QA_ROOT_EXCEPTION_ID } from "@/lib/agent-os/bi/website-qa/types";
import { observationsFromOperatingBacklog } from "./adapters/founder-focus";
import { observationsFromUpcomingBirthdays } from "./adapters/birthdays";
import { observationsFromClientAttention } from "./adapters/client-attention";
import { observationsFromWebsiteQa } from "./adapters/website-qa";
import { observationsFromConciergeSla } from "./adapters/concierge-sla";
import { composeChiefOfStaffBrief } from "./compose";
import { SILENCE_REASON } from "./constants";
import { presentCommandCenter } from "./present/command-center";
import { renderMorningEmail } from "./present/email";
import { InMemoryChiefOfStaffStore } from "./persistence/memory";
import type { AttentionItem, SpecialistObservation } from "./types";

const GENERATED_AT = "2026-08-25T11:00:00.000Z";
const LOCAL_DATE = "2026-08-25";
const NOW = new Date("2026-08-25T12:00:00.000Z");

function composeFrom(observations: SpecialistObservation[], existing?: AttentionItem[]) {
  return composeChiefOfStaffBrief({
    localDate: LOCAL_DATE,
    generatedAt: GENERATED_AT,
    nowIso: GENERATED_AT,
    observations,
    existingItems: existing,
  });
}

function charlotteBacklog(): OperatingBacklog {
  return {
    ...CURRENT_OPERATING_BACKLOG,
    masterSprint: {
      ...CURRENT_OPERATING_BACKLOG.masterSprint,
      items: [
        {
          id: "sprint-charlotte-editorial",
          kind: "founder-action",
          title: "Follow up with Charlotte editorial contact today",
          action: "Follow up with Charlotte editorial contact today",
          why: "Third-party Charlotte authority remains the highest-leverage GEO gap.",
          expectedOutcome: "A real follow-up is sent.",
          status: "active",
          urgency: "high",
          rank: 0,
          surfacePolicy: "founder-now",
        },
        ...CURRENT_OPERATING_BACKLOG.masterSprint.items,
      ],
    },
  };
}

function followUpSignal(
  overrides: Partial<ClientAttentionSignal> = {},
): ClientAttentionSignal {
  return {
    id: "sig-follow-up",
    subjectKey: "contact-david",
    displayName: "David",
    sourceTypes: ["hubspot"],
    signalType: "follow-up-due",
    urgency: "high",
    confidence: "high",
    summary: "A scheduled HubSpot follow-up is due or overdue.",
    whyItMatters: "A promised next step loses trust when it slips.",
    recommendedAction: "Complete today's follow-up with David.",
    evidence: [
      {
        id: "ev-follow-up",
        sourceType: "hubspot",
        kind: "hubspot-task",
        observation: "HubSpot follow-up task is overdue.",
        reliability: "reliable",
        redactionStatus: "clean",
      },
    ],
    responseState: "not-applicable",
    founderRankable: true,
    ...overrides,
  };
}

describe("Chief of Staff 2.0 Phase 1A composer", () => {
  it("Watch printer scenario yields ZERO numbered items and no filler", () => {
    const observations = observationsFromOperatingBacklog(
      CURRENT_OPERATING_BACKLOG,
      GENERATED_AT,
    );
    assert.equal(observations.length, 0);

    const result = composeFrom(observations);
    assert.equal(result.items.length, 0);
    assert.deepEqual(result.brief.attentionItemIds, []);
    assert.equal(result.brief.silenceReason, SILENCE_REASON);

    const view = presentCommandCenter(result);
    assert.equal(view.status, "quiet");
    assert.equal(view.items.length, 0);
    assert.equal(view.heading, SILENCE_REASON);

    const email = renderMorningEmail(result);
    assert.match(email.text, /No material founder priorities require action today/);
    assert.doesNotMatch(email.text, /Watch/i);
    assert.doesNotMatch(email.text, /Paid-search readiness/i);
    assert.doesNotMatch(email.text, /measure only/i);
    assert.doesNotMatch(email.text, /waiting for follow-up/i);
    assert.doesNotMatch(email.text, /Weddington/i);
    assert.doesNotMatch(email.text, /Charlotte guide hub/i);
    assert.doesNotMatch(email.text, /Case Study production/i);
  });

  it("one founder-now focus becomes a single numbered founder-action for today", () => {
    const observations = observationsFromOperatingBacklog(
      charlotteBacklog(),
      GENERATED_AT,
    );
    const result = composeFrom(observations);
    assert.equal(result.items.length, 1);
    const item = result.items[0]!;
    assert.equal(item.audience, "founder-action");
    assert.equal(item.urgency, "today");
    assert.match(item.headline, /Follow up with Charlotte editorial contact today/);
    assert.equal(result.brief.attentionItemIds.length, 1);
    assert.equal(result.brief.silenceReason, undefined);

    const email = renderMorningEmail(result);
    assert.doesNotMatch(email.text, /Paid-search readiness/i);
    assert.doesNotMatch(email.text, /Watch/i);
  });

  it("birthday 8 days away is worth-knowing, not a numbered item, with no year", () => {
    const observations = observationsFromUpcomingBirthdays({
      birthdays: [
        {
          factId: "fact-sarah",
          personId: "11111111-1111-4111-8111-111111111111",
          displayName: "Sarah",
          month: 9,
          day: 2,
          year: 1988,
          verification: "manual",
          sourceSystem: "concierge-manual",
        },
      ],
      now: NOW,
      observedAt: GENERATED_AT,
    });
    assert.equal(observations.length, 1);
    const result = composeFrom(observations);
    assert.equal(result.items.length, 0);
    assert.equal(result.brief.attentionItemIds.length, 0);
    assert.equal(result.brief.worthKnowing.length, 1);
    assert.equal(
      result.brief.worthKnowing[0]?.headline,
      "Sarah's birthday is in 8 days.",
    );
    assert.equal(
      result.brief.worthKnowing[0]?.personId,
      "11111111-1111-4111-8111-111111111111",
    );
    assert.doesNotMatch(result.brief.worthKnowing[0]!.headline, /1988|age|years old/i);
    assert.equal(result.brief.silenceReason, SILENCE_REASON);
  });

  it("trusted overdue client follow-up becomes a numbered item", () => {
    const observations = observationsFromClientAttention({
      clientOpsHealth: "exceptions",
      hubspotAvailability: "ok",
      gmailAvailability: "not-configured",
      signals: [followUpSignal()],
      observedAt: GENERATED_AT,
    });
    const result = composeFrom(observations);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]!.kind, "relationship-follow-through");
    assert.match(result.items[0]!.headline, /David/);
    assert.ok(result.items[0]!.reasonCodes.includes("client-follow-up-due"));
  });

  it("unknown Client Ops health does not claim a client is waiting", () => {
    const observations = observationsFromClientAttention({
      clientOpsHealth: "unknown",
      hubspotAvailability: "not-configured",
      gmailAvailability: "not-configured",
      signals: [followUpSignal()],
      observedAt: GENERATED_AT,
    });
    assert.equal(observations.length, 0);
    const result = composeFrom(observations);
    assert.equal(result.items.length, 0);
    assert.doesNotMatch(renderMorningEmail(result).text, /David is waiting/i);
  });

  it("Gmail-dependent reply signals stay suppressed without Gmail", () => {
    const observations = observationsFromClientAttention({
      clientOpsHealth: "exceptions",
      hubspotAvailability: "ok",
      gmailAvailability: "not-configured",
      signals: [
        followUpSignal({
          signalType: "unanswered-inbound",
          responseState: "unknown",
          recommendedAction: "Reply to David.",
        }),
      ],
      observedAt: GENERATED_AT,
    });
    assert.equal(observations.length, 0);
  });

  it("critical website and SLA exceptions become numbered material-risk; healthy is silent", () => {
    assert.equal(
      observationsFromWebsiteQa({ health: "healthy", exception: null }, GENERATED_AT)
        .length,
      0,
    );
    assert.equal(
      observationsFromConciergeSla({ overdueCount: 0, observedAt: GENERATED_AT })
        .length,
      0,
    );

    const qa = observationsFromWebsiteQa(
      {
        health: "critical",
        exception: {
          id: WEBSITE_QA_ROOT_EXCEPTION_ID,
          health: "critical",
          affectedRoutes: ["/concierge"],
          summary: "Production health regression: /concierge (500).",
        },
      },
      GENERATED_AT,
    );
    const sla = observationsFromConciergeSla({
      overdueCount: 1,
      observedAt: GENERATED_AT,
    });
    const result = composeFrom([...qa, ...sla]);
    assert.equal(result.items.length, 2);
    assert.ok(result.items.every((item) => item.kind === "material-risk"));
    assert.ok(result.items.every((item) => item.audience === "urgent-founder-action"));
  });

  it("lifecycle suppresses acknowledged/snoozed/resolved and may reopen when worsened", () => {
    const observations = observationsFromOperatingBacklog(
      charlotteBacklog(),
      GENERATED_AT,
    );
    const first = composeFrom(observations);
    assert.equal(first.items.length, 1);
    const seed = first.items[0]!;

    const acknowledged = composeFrom(observations, [
      { ...seed, status: "acknowledged", acknowledgedAt: GENERATED_AT },
    ]);
    assert.equal(acknowledged.items.length, 0);

    const snoozed = composeFrom(observations, [
      {
        ...seed,
        status: "snoozed",
        snoozedUntil: "2026-08-26T12:00:00.000Z",
      },
    ]);
    assert.equal(snoozed.items.length, 0);

    const resolved = composeFrom(observations, [
      { ...seed, status: "resolved", resolvedAt: GENERATED_AT },
    ]);
    assert.equal(resolved.items.length, 0);

    const worsenedObservation: SpecialistObservation = {
      ...observations[0]!,
      changeClass: "worsened",
    };
    const reopened = composeFrom([worsenedObservation], [
      { ...seed, status: "acknowledged", acknowledgedAt: GENERATED_AT },
    ]);
    assert.equal(reopened.items.length, 1);
    assert.equal(reopened.items[0]!.status, "new");
    assert.ok(reopened.items[0]!.reasonCodes.includes("worsened"));
  });

  it("generic watch/research observations never fill numbered slots", () => {
    const result = composeFrom([
      {
        specialist: "opportunity",
        kind: "geo-authority-opportunity",
        subject: {},
        summary: "Research a GEO opportunity.",
        epistemicClass: "recommendation",
        importanceHint: "medium",
        urgencyHint: "watch",
        audienceHint: "watch",
        confidence: "low",
        evidenceIds: [],
        observationIds: [],
        observedAt: GENERATED_AT,
        dedupeKey: "opportunity:geo",
        changeClass: "novel",
      },
    ]);
    assert.equal(result.items.length, 0);
    assert.equal(result.brief.silenceReason, SILENCE_REASON);
  });

  it("composition is deterministic for the same inputs and local date", () => {
    const observations = observationsFromOperatingBacklog(
      charlotteBacklog(),
      GENERATED_AT,
    );
    const a = composeFrom(observations);
    const b = composeFrom(observations);
    assert.deepEqual(a.brief.attentionItemIds, b.brief.attentionItemIds);
    assert.deepEqual(
      a.items.map((item) => item.dedupeKey),
      b.items.map((item) => item.dedupeKey),
    );
  });

  it("in-memory store keeps one brief per local date", async () => {
    const store = new InMemoryChiefOfStaffStore();
    const first = composeFrom(
      observationsFromOperatingBacklog(charlotteBacklog(), GENERATED_AT),
    );
    await store.upsertItems(first.items);
    await store.putBrief(first.brief);
    const quiet = composeFrom([]);
    await store.putBrief(quiet.brief);
    const loaded = await store.getBriefByLocalDate(LOCAL_DATE);
    assert.equal(loaded?.id, quiet.brief.id);
    assert.equal(loaded?.attentionItemIds.length, 0);
  });
});
