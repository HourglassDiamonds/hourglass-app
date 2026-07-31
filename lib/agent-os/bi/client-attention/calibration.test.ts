/**
 * Calibration regressions: Gmail authority for reply state;
 * HubSpot-only must not invent unanswered-email claims.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientAttentionSourceBundle } from "./adapters/types";
import { resolveClientIdentities } from "./identity";
import {
  founderFacingOverstatesUnknownReply,
  founderFacingTextsAreSafe,
} from "./redaction";
import { generateClientAttentionSignals } from "./signals";
import { CLIENT_ATTENTION_FIXTURE_NOW, FIXTURE_EMAILS } from "./fixtures";

const NOW = CLIENT_ATTENTION_FIXTURE_NOW;

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

function runSignals(bundle: ClientAttentionSourceBundle) {
  const identities = resolveClientIdentities(bundle).identities;
  return generateClientAttentionSignals({
    bundle,
    identities,
    nowIso: NOW,
  });
}

describe("client-attention reply-state calibration", () => {
  it("1. 30-day-old Concierge submission with no Gmail does not become reply-overdue", () => {
    const bundle: ClientAttentionSourceBundle = {
      gmail: emptyGmailNotConfigured(),
      hubspot: {
        sourceType: "hubspot",
        status: "ok",
        collectedAt: NOW,
        recordCount: 2,
        contacts: [
          {
            contactId: "c-old",
            normalizedEmail: "old.client@example.test",
            firstName: "Old",
            lastName: "Client",
            lastActivityAt: daysAgo(30),
          },
        ],
        deals: [
          {
            dealId: "d-old",
            contactIds: ["c-old"],
            dealName: "Old Client – Engagement Ring",
            stage: "appointmentscheduled",
            createdAt: daysAgo(30),
            lastActivityAt: daysAgo(30),
            closed: false,
          },
        ],
        tasks: [],
      },
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
            normalizedEmail: "old.client@example.test",
            firstName: "Old",
            lastName: "Client",
            projectType: "Engagement Ring",
            hubspotContactId: "c-old",
            hubspotDealId: "d-old",
          },
        ],
      },
    };

    const result = runSignals(bundle);
    assert.ok(
      !result.signals.some((s) => s.signalType === "reply-overdue"),
      "must not invent reply-overdue without Gmail",
    );
    assert.ok(
      !result.signals.some((s) => s.signalType === "unanswered-inbound"),
    );
    assert.ok(
      !result.signals.some(
        (s) =>
          s.signalType === "new-inquiry-needs-review" &&
          s.firstSeenAt === daysAgo(30),
      ),
      "month-old inquiry must not surface as review solely for age",
    );
  });

  it("2. recent Concierge with no Gmail becomes review item, not unanswered-email", () => {
    const bundle: ClientAttentionSourceBundle = {
      gmail: emptyGmailNotConfigured(),
      hubspot: {
        sourceType: "hubspot",
        status: "ok",
        collectedAt: NOW,
        recordCount: 2,
        contacts: [
          {
            contactId: "c-new",
            normalizedEmail: "new.client@example.test",
            firstName: "New",
            lastName: "Client",
            lastActivityAt: hoursAgo(30),
          },
        ],
        deals: [
          {
            dealId: "d-new",
            contactIds: ["c-new"],
            stage: "appointmentscheduled",
            createdAt: hoursAgo(30),
            lastActivityAt: hoursAgo(30),
          },
        ],
        tasks: [],
      },
      concierge: {
        sourceType: "concierge",
        status: "ok",
        collectedAt: NOW,
        recordCount: 1,
        submissions: [
          {
            submissionId: "sub-new",
            accepted: true,
            submittedAt: hoursAgo(30),
            normalizedEmail: "new.client@example.test",
            firstName: "New",
            lastName: "Client",
            hubspotContactId: "c-new",
            hubspotDealId: "d-new",
          },
        ],
      },
    };

    const result = runSignals(bundle);
    const review = result.signals.find(
      (s) => s.signalType === "new-inquiry-needs-review",
    );
    assert.ok(review);
    assert.equal(review!.responseState, "unknown");
    assert.ok(!result.signals.some((s) => s.signalType === "reply-overdue"));
    assert.ok(!result.signals.some((s) => s.signalType === "unanswered-inbound"));
    assert.equal(founderFacingOverstatesUnknownReply(review!), false);
    assert.ok(founderFacingTextsAreSafe([review!.summary, review!.recommendedAction]));
    assert.match(review!.recommendedAction, /Review this recent Concierge inquiry/i);
  });

  it("3. Gmail-confirmed inbound with no later outbound can become reply-overdue", () => {
    const bundle: ClientAttentionSourceBundle = {
      gmail: {
        sourceType: "gmail",
        status: "ok",
        collectedAt: NOW,
        recordCount: 1,
        threads: [
          {
            threadId: "th-1",
            normalizedParticipants: [FIXTURE_EMAILS.sarah],
            normalizedPrimaryEmail: FIXTURE_EMAILS.sarah,
            latestDirection: "inbound",
            lastInboundAt: hoursAgo(27),
            hasLaterOutboundReply: false,
            automated: false,
            businessRelevant: true,
            contextTags: [],
            safeParticipantLabel: "Sarah M.",
          },
        ],
      },
      hubspot: {
        sourceType: "hubspot",
        status: "ok",
        collectedAt: NOW,
        recordCount: 1,
        contacts: [
          {
            contactId: "c-sarah",
            normalizedEmail: FIXTURE_EMAILS.sarah,
            firstName: "Sarah",
            lastName: "Mill",
          },
        ],
        deals: [],
        tasks: [],
      },
      concierge: {
        sourceType: "concierge",
        status: "empty",
        collectedAt: NOW,
        recordCount: 0,
        submissions: [],
      },
    };

    const result = runSignals(bundle);
    const overdue = result.signals.find((s) => s.signalType === "reply-overdue");
    assert.ok(overdue);
    assert.equal(overdue!.responseState, "confirmed-awaiting-reply");
    assert.match(overdue!.summary, /without a reply/i);
  });

  it("4. closed-won deal does not generate a generic follow-up alert", () => {
    const bundle: ClientAttentionSourceBundle = {
      gmail: emptyGmailNotConfigured(),
      hubspot: {
        sourceType: "hubspot",
        status: "ok",
        collectedAt: NOW,
        recordCount: 3,
        contacts: [
          {
            contactId: "c-won",
            normalizedEmail: "won.client@example.test",
            firstName: "Won",
            lastName: "Client",
            nextActivityAt: daysAgo(1),
            lastActivityAt: daysAgo(10),
          },
        ],
        deals: [
          {
            dealId: "d-won",
            contactIds: ["c-won"],
            stage: "closedwon",
            closed: true,
            lastActivityAt: daysAgo(10),
          },
        ],
        tasks: [
          {
            taskId: "t-won",
            contactId: "c-won",
            dealId: "d-won",
            status: "open",
            dueAt: daysAgo(1),
            subject: "Legacy task",
          },
        ],
      },
      concierge: {
        sourceType: "concierge",
        status: "empty",
        collectedAt: NOW,
        recordCount: 0,
        submissions: [],
      },
    };

    const result = runSignals(bundle);
    assert.ok(
      !result.signals.some((s) => s.signalType === "follow-up-due"),
      "closed-won must not get generic follow-up",
    );
    assert.ok(!result.signals.some((s) => s.signalType === "stalled-conversation"));
    assert.ok(!result.signals.some((s) => s.signalType === "missing-next-step"));
  });

  it("5. open deal with approaching proposal date still surfaces from HubSpot alone", () => {
    const bundle: ClientAttentionSourceBundle = {
      gmail: emptyGmailNotConfigured(),
      hubspot: {
        sourceType: "hubspot",
        status: "ok",
        collectedAt: NOW,
        recordCount: 2,
        contacts: [
          {
            contactId: "c-prop",
            normalizedEmail: "prop.client@example.test",
            firstName: "Prop",
            lastName: "Client",
            lastActivityAt: daysAgo(1),
          },
        ],
        deals: [
          {
            dealId: "d-prop",
            contactIds: ["c-prop"],
            stage: "presentationscheduled",
            lastActivityAt: daysAgo(1),
            proposalDate: daysFromNow(3),
            nextActivityAt: daysFromNow(2),
          },
        ],
        tasks: [],
      },
      concierge: {
        sourceType: "concierge",
        status: "empty",
        collectedAt: NOW,
        recordCount: 0,
        submissions: [],
      },
    };

    const result = runSignals(bundle);
    assert.ok(
      result.signals.some((s) => s.signalType === "proposal-date-approaching"),
    );
  });

  it("6. explicit overdue HubSpot task can surface without Gmail", () => {
    const bundle: ClientAttentionSourceBundle = {
      gmail: emptyGmailNotConfigured(),
      hubspot: {
        sourceType: "hubspot",
        status: "ok",
        collectedAt: NOW,
        recordCount: 3,
        contacts: [
          {
            contactId: "c-task",
            normalizedEmail: "task.client@example.test",
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
      },
      concierge: {
        sourceType: "concierge",
        status: "empty",
        collectedAt: NOW,
        recordCount: 0,
        submissions: [],
      },
    };

    const result = runSignals(bundle);
    const followUp = result.signals.find((s) => s.signalType === "follow-up-due");
    assert.ok(followUp);
    assert.equal(followUp!.responseState, "not-applicable");
    assert.ok(
      followUp!.evidence.some((e) => e.kind === "hubspot-task"),
    );
  });

  it("7. founder output never overstates unknown response status", () => {
    const bundle: ClientAttentionSourceBundle = {
      gmail: emptyGmailNotConfigured(),
      hubspot: {
        sourceType: "hubspot",
        status: "ok",
        collectedAt: NOW,
        recordCount: 1,
        contacts: [
          {
            contactId: "c-rev",
            normalizedEmail: "rev.client@example.test",
            firstName: "Rev",
            lastName: "Client",
            lastActivityAt: hoursAgo(36),
          },
        ],
        deals: [
          {
            dealId: "d-rev",
            contactIds: ["c-rev"],
            stage: "appointmentscheduled",
            createdAt: hoursAgo(36),
            lastActivityAt: hoursAgo(36),
          },
        ],
        tasks: [],
      },
      concierge: {
        sourceType: "concierge",
        status: "ok",
        collectedAt: NOW,
        recordCount: 1,
        submissions: [
          {
            submissionId: "sub-rev",
            accepted: true,
            submittedAt: hoursAgo(36),
            normalizedEmail: "rev.client@example.test",
            firstName: "Rev",
            hubspotContactId: "c-rev",
            hubspotDealId: "d-rev",
          },
        ],
      },
    };

    const result = runSignals(bundle);
    for (const signal of result.signals) {
      assert.equal(
        founderFacingOverstatesUnknownReply(signal),
        false,
        `${signal.signalType} overstated unknown reply`,
      );
      if (signal.responseState === "unknown") {
        assert.doesNotMatch(signal.summary, /reply overdue|unanswered|waiting for your reply/i);
        assert.doesNotMatch(
          signal.recommendedAction,
          /reply overdue|unanswered|waiting for your reply/i,
        );
      }
    }
  });
});
