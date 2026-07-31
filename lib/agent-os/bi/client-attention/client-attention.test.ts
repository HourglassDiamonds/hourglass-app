import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadClientAttentionSources } from "./adapters/load";
import { buildSuccessFixtureSources, FIXTURE_EMAILS } from "./fixtures";
import { normalizeEmail, subjectKeyFromEmail } from "./hash";
import { resolveClientIdentities } from "./identity";
import {
  CLIENT_ATTENTION_SOURCE_OWNERSHIP,
  ownerForClientAttentionDomain,
  runClientAttentionAnalysis,
  founderFacingTextsAreSafe,
  MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES,
} from "./index";

describe("client-attention source-of-truth", () => {
  it("assigns ownership domains", () => {
    assert.equal(ownerForClientAttentionDomain("whether-justin-replied"), "gmail");
    assert.equal(ownerForClientAttentionDomain("lifecycle-stage"), "hubspot");
    assert.equal(ownerForClientAttentionDomain("initial-intent"), "concierge");
    assert.ok(CLIENT_ATTENTION_SOURCE_OWNERSHIP.gmail.length > 0);
  });
});

describe("client-attention identity resolution", () => {
  it("merges exact and case-insensitive emails; keeps same-name different emails separate", () => {
    const success = buildSuccessFixtureSources();
    const bundle = loadClientAttentionSources({
      mode: "fixture",
      gmail: {
        threads: [
          ...success.threads,
          {
            threadId: "fixture-thread-case",
            normalizedParticipants: [FIXTURE_EMAILS.sarah.toUpperCase()],
            normalizedPrimaryEmail: normalizeEmail(FIXTURE_EMAILS.sarah.toUpperCase())!,
            latestDirection: "inbound",
            latestMessageAt: "2026-07-28T12:00:00.000Z",
            lastInboundAt: "2026-07-28T12:00:00.000Z",
            hasLaterOutboundReply: false,
            automated: false,
            businessRelevant: true,
            contextTags: [],
            safeParticipantLabel: "Sarah M.",
          },
        ],
      },
      hubspot: {
        contacts: success.contacts,
        deals: success.deals,
        tasks: success.tasks,
      },
      concierge: { submissions: success.submissions },
    });

    const result = resolveClientIdentities(bundle);
    const sarahKey = subjectKeyFromEmail(FIXTURE_EMAILS.sarah);
    const sarah = result.identities.find((i) => i.subjectKey === sarahKey);
    assert.ok(sarah);
    assert.ok(sarah.sourceTypes.includes("gmail"));
    assert.ok(sarah.sourceTypes.includes("hubspot"));
    assert.ok(sarah.sourceTypes.includes("concierge"));
    assert.ok(sarah.threadIds.length >= 1);

    const alexA = result.identities.find((i) =>
      i.normalizedEmail === FIXTURE_EMAILS.alexA,
    );
    const alexB = result.identities.find((i) =>
      i.normalizedEmail === FIXTURE_EMAILS.alexB,
    );
    assert.ok(alexA && alexB);
    assert.notEqual(alexA.subjectKey, alexB.subjectKey);

    const michael = result.identities.find(
      (i) => i.normalizedEmail === FIXTURE_EMAILS.michael,
    );
    assert.ok(michael);
    assert.ok(michael.threadIds.length >= 2);
  });

  it("leaves unresolved gmail-only contacts source-specific with lower confidence", () => {
    const bundle = loadClientAttentionSources({
      mode: "fixture",
      gmail: {
        threads: [
          {
            threadId: "fixture-thread-orphan",
            normalizedParticipants: ["orphan.fixture@clients.example.test"],
            normalizedPrimaryEmail: "orphan.fixture@clients.example.test",
            latestDirection: "inbound",
            latestMessageAt: "2026-07-28T12:00:00.000Z",
            lastInboundAt: "2026-07-28T12:00:00.000Z",
            hasLaterOutboundReply: false,
            automated: false,
            businessRelevant: true,
            contextTags: [],
          },
        ],
      },
      hubspot: { contacts: [], deals: [], tasks: [] },
      concierge: { submissions: [] },
    });
    const result = resolveClientIdentities(bundle);
    assert.equal(result.identities.length, 1);
    assert.equal(result.identities[0].confidence, "medium");
    assert.deepEqual(result.identities[0].sourceTypes, ["gmail"]);
  });
});

describe("client-attention adapters", () => {
  it("returns not-configured for live Gmail and sync HubSpot without prefetch", () => {
    const bundle = loadClientAttentionSources({ mode: "live" });
    assert.equal(bundle.gmail.status, "not-configured");
    assert.equal(bundle.hubspot.status, "not-configured");
    assert.ok(
      bundle.gmail.missingConfiguration?.some((m) =>
        m.includes("gmail.readonly"),
      ),
    );
  });

  it("accepts prefetched live HubSpot snapshot without fixtures", () => {
    const result = runClientAttentionAnalysis({
      mode: "live",
      reportingPeriod: { start: "2026-07-22", end: "2026-07-28" },
      prefetchedSources: {
        gmail: {
          sourceType: "gmail",
          status: "not-configured",
          collectedAt: "2026-07-28T12:00:00.000Z",
          recordCount: 0,
          threads: [],
          missingConfiguration: ["scope:gmail.readonly"],
        },
        hubspot: {
          sourceType: "hubspot",
          status: "ok",
          collectedAt: "2026-07-28T12:00:00.000Z",
          recordCount: 1,
          contacts: [
            {
              contactId: "c-live-1",
              normalizedEmail: "live.client@clients.example.test",
              firstName: "Live",
              lastName: "Client",
              lastActivityAt: "2026-07-20T12:00:00.000Z",
            },
          ],
          deals: [
            {
              dealId: "d-live-1",
              contactIds: ["c-live-1"],
              dealName: "Live Client – Engagement Ring",
              stage: "appointmentscheduled",
              createdAt: "2026-07-20T10:00:00.000Z",
              lastActivityAt: "2026-07-20T12:00:00.000Z",
            },
          ],
          tasks: [],
        },
        concierge: {
          sourceType: "concierge",
          status: "ok",
          collectedAt: "2026-07-28T12:00:00.000Z",
          recordCount: 1,
          submissions: [
            {
              submissionId: "sub-live-1",
              accepted: true,
              submittedAt: "2026-07-20T10:00:00.000Z",
              normalizedEmail: "live.client@clients.example.test",
              firstName: "Live",
              lastName: "Client",
              projectType: "Engagement Ring",
              timeline: "1-3 months",
              budgetRange: "$5k-$8k",
              hubspotContactId: "c-live-1",
              hubspotDealId: "d-live-1",
            },
          ],
        },
      },
    });
    assert.equal(result.audit.mode, "live");
    assert.equal(result.audit.sourceAvailability.hubspot, "ok");
    assert.equal(result.audit.sourceAvailability.gmail, "not-configured");
    assert.ok(result.audit.counts.contactsInspected >= 1);
    assert.ok(
      !JSON.stringify(result.audit).includes("fixture@") &&
        result.audit.mode === "live",
    );
  });

  it("excludes automated newsletter threads from success fixtures", () => {
    const result = runClientAttentionAnalysis({
      mode: "fixture",
      reportingPeriod: { start: "2026-07-22", end: "2026-07-28" },
      fixturePreset: "success",
    });
    assert.ok(
      !result.audit.signals.some((s) =>
        s.evidence.some((e) => e.sourceObjectId?.includes("newsletter")),
      ),
    );
  });
});

describe("client-attention signals and ranking", () => {
  it("flags overdue Concierge inquiry and caps founder priorities", () => {
    const result = runClientAttentionAnalysis({
      mode: "fixture",
      reportingPeriod: { start: "2026-07-22", end: "2026-07-28" },
      fixturePreset: "success",
    });
    assert.ok(result.audit.signals.some((s) => s.signalType === "reply-overdue"));
    assert.ok(result.audit.signals.some((s) => s.signalType === "follow-up-due" || s.signalType === "stalled-conversation" || s.signalType === "missing-next-step"));
    assert.ok(result.recommendations.length <= MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES || result.audit.rankedSignals.length >= 1);
    assert.ok(result.audit.redacted);
    assert.ok(result.backlogCandidates.every((c) => c.dedupeKey.includes("client-action")));
    const texts = result.recommendations.flatMap((r) => [
      r.title,
      r.proposedAction,
      r.plainLanguageExplanation,
    ]);
    assert.ok(founderFacingTextsAreSafe(texts));
  });

  it("does not alert Concierge inquiries under 12 hours", () => {
    const result = runClientAttentionAnalysis({
      mode: "fixture",
      reportingPeriod: { start: "2026-07-22", end: "2026-07-28" },
      fixturePreset: "success",
    });
    // Casey fresh submission (~4h) should not produce reply-overdue
    assert.ok(
      !result.audit.signals.some(
        (s) =>
          s.displayName?.includes("Casey") &&
          (s.signalType === "reply-overdue" || s.signalType === "new-inquiry"),
      ),
    );
  });

  it("survives gmail / hubspot / both failures without aborting", () => {
    for (const preset of [
      "gmail-failure",
      "hubspot-failure",
      "both-failure",
      "recovery",
    ] as const) {
      const result = runClientAttentionAnalysis({
        mode: "fixture",
        reportingPeriod: { start: "2026-07-22", end: "2026-07-28" },
        fixturePreset: preset,
      });
      assert.ok(result.audit);
      assert.equal(result.audit.redacted, true);
      if (preset === "both-failure") {
        assert.ok(
          result.audit.dataGaps.some((g) => g.id.includes("pipeline-incomplete")),
        );
      }
      if (preset === "recovery") {
        assert.ok(result.audit.facts.some((f) => /recovered/i.test(f)));
      }
    }
  });

  it("keeps ranking stable for unchanged inputs", () => {
    const a = runClientAttentionAnalysis({
      mode: "fixture",
      reportingPeriod: { start: "2026-07-22", end: "2026-07-28" },
      fixturePreset: "success",
    });
    const b = runClientAttentionAnalysis({
      mode: "fixture",
      reportingPeriod: { start: "2026-07-22", end: "2026-07-28" },
      fixturePreset: "success",
    });
    assert.deepEqual(
      a.audit.rankedSignals.map((r) => r.signal.id),
      b.audit.rankedSignals.map((r) => r.signal.id),
    );
    assert.deepEqual(
      a.audit.rankedSignals.map((r) => r.totalScore),
      b.audit.rankedSignals.map((r) => r.totalScore),
    );
  });
});

describe("client-attention privacy", () => {
  it("redacts emails and CRM ids from audit serialization", () => {
    const result = runClientAttentionAnalysis({
      mode: "fixture",
      reportingPeriod: { start: "2026-07-22", end: "2026-07-28" },
      fixturePreset: "success",
    });
    const serialized = JSON.stringify(result.audit);
    assert.doesNotMatch(serialized, /@clients\.example\.test/i);
    assert.doesNotMatch(serialized, /fixture-contact-sarah/);
    assert.doesNotMatch(serialized, /Dear Sarah,/i);
  });
});
