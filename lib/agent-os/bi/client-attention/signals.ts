/**
 * Generate actionable ClientAttentionSignal records from resolved identities + sources.
 */

import type { ClientAttentionSourceBundle } from "./adapters/types";
import type { ResolvedClientIdentity } from "./identity";
import type {
  BuyerConcernSignal,
  ClientAttentionConfidence,
  ClientAttentionSignal,
  ClientSignalEvidence,
} from "./types";
import {
  CLIENT_ATTENTION_RECOMMENDATION_PREFIX,
  MAX_CLIENT_ATTENTION_SIGNALS,
} from "./types";
import type { ClientAttentionThresholds } from "./thresholds";
import { mergeThresholds } from "./thresholds";
import type { Urgency } from "../../types";

export type SignalGenerationResult = {
  signals: ClientAttentionSignal[];
  buyerConcerns: BuyerConcernSignal[];
  suppressedCount: number;
};

export function generateClientAttentionSignals(input: {
  bundle: ClientAttentionSourceBundle;
  identities: ResolvedClientIdentity[];
  nowIso: string;
  thresholds?: Partial<ClientAttentionThresholds>;
}): SignalGenerationResult {
  const thresholds = mergeThresholds(input.thresholds);
  const now = Date.parse(input.nowIso);
  const signals: ClientAttentionSignal[] = [];
  let suppressedCount = 0;

  const bySubject = new Map(
    input.identities.map((i) => [i.subjectKey, i] as const),
  );
  const identityForEmail = (email?: string) =>
    input.identities.find((i) => i.normalizedEmail && email && i.normalizedEmail === email);
  const identityForContact = (contactId?: string) =>
    input.identities.find((i) => contactId && i.contactIds.includes(contactId));

  // Index HubSpot by contact
  const contactById = new Map(
    input.bundle.hubspot.contacts.map((c) => [c.contactId, c] as const),
  );
  const dealsByContact = new Map<string, typeof input.bundle.hubspot.deals>();
  for (const deal of input.bundle.hubspot.deals) {
    for (const cid of deal.contactIds) {
      const list = dealsByContact.get(cid) ?? [];
      list.push(deal);
      dealsByContact.set(cid, list);
    }
  }
  const tasksByContact = new Map<string, typeof input.bundle.hubspot.tasks>();
  for (const task of input.bundle.hubspot.tasks) {
    if (!task.contactId) continue;
    const list = tasksByContact.get(task.contactId) ?? [];
    list.push(task);
    tasksByContact.set(task.contactId, list);
  }

  const threadsByEmail = new Map<string, typeof input.bundle.gmail.threads>();
  for (const thread of input.bundle.gmail.threads) {
    if (!thread.normalizedPrimaryEmail || thread.automated) continue;
    const list = threadsByEmail.get(thread.normalizedPrimaryEmail) ?? [];
    list.push(thread);
    threadsByEmail.set(thread.normalizedPrimaryEmail, list);
  }

  const push = (signal: ClientAttentionSignal | null) => {
    if (!signal) {
      suppressedCount += 1;
      return;
    }
    // Deduplicate by signalType + subjectKey
    const dedupeKey = `${signal.signalType}:${signal.subjectKey}`;
    if (signals.some((s) => `${s.signalType}:${s.subjectKey}` === dedupeKey)) {
      suppressedCount += 1;
      return;
    }
    signals.push(signal);
  };

  // A. New Concierge inquiry / reply overdue
  for (const sub of input.bundle.concierge.submissions) {
    if (!sub.accepted) continue;
    const identity =
      (sub.hubspotContactId && identityForContact(sub.hubspotContactId)) ||
      identityForEmail(sub.normalizedEmail) ||
      input.identities.find((i) => i.submissionIds.includes(sub.submissionId));
    if (!identity) continue;

    const hours =
      (now - Date.parse(sub.submittedAt)) / 3600_000;
    const threads = sub.normalizedEmail
      ? threadsByEmail.get(sub.normalizedEmail) ?? []
      : [];
    const hasOutbound = threads.some((t) => t.hasLaterOutboundReply);
    const deals = identity.contactIds.flatMap(
      (id) => dealsByContact.get(id) ?? [],
    );
    const closedOrDeferred = deals.some((d) => d.closed || d.deferred);
    const completedFollowUp = (tasksByContact.get(identity.contactIds[0] ?? "") ?? []).some(
      (t) => t.status === "completed",
    );

    if (hasOutbound || closedOrDeferred || completedFollowUp) {
      suppressedCount += 1;
      continue;
    }

    if (hours < thresholds.newInquiryMediumHours) {
      suppressedCount += 1;
      continue;
    }

    let urgency: Urgency = "medium";
    if (hours >= thresholds.newInquiryCriticalHours) urgency = "critical";
    else if (hours >= thresholds.newInquiryHighHours) urgency = "high";

    push(
      buildSignal({
        identity,
        signalType: hours >= thresholds.newInquiryHighHours ? "reply-overdue" : "new-inquiry",
        urgency,
        confidence: identity.sourceTypes.length > 1 ? "high" : "medium",
        summary: `A new Concierge inquiry has been waiting ${Math.round(hours)} hours.`,
        whyItMatters:
          "Hourglass aims to respond within about 24 hours; delay risks losing a warm conversation.",
        recommendedAction: `Reply this morning and confirm ${identity.displayName.split(" ")[0]}'s preferred next step.`,
        firstSeenAt: sub.submittedAt,
        lastInboundAt: sub.submittedAt,
        targetDate: deals[0]?.proposalDate ?? deals[0]?.targetDate,
        evidence: [
          evidence("concierge", "concierge-submission", sub.submissionId, {
            observation: `Accepted Concierge submission age ~${Math.round(hours)}h.`,
          }),
          ...threads.slice(0, 1).map((t) =>
            evidence("gmail", "gmail-thread-meta", t.threadId, {
              observation: "No later outbound reply found on related thread.",
            }),
          ),
        ],
      }),
    );
  }

  // B. Unanswered inbound Gmail
  for (const thread of input.bundle.gmail.threads) {
    if (thread.automated || !thread.businessRelevant) continue;
    if (thread.latestDirection !== "inbound") continue;
    if (thread.hasLaterOutboundReply) continue;
    if (!thread.lastInboundAt) continue;

    const hours = (now - Date.parse(thread.lastInboundAt)) / 3600_000;
    if (hours < thresholds.unansweredInboundHours) {
      suppressedCount += 1;
      continue;
    }

    const identity =
      identityForEmail(thread.normalizedPrimaryEmail) ||
      input.identities.find((i) => i.threadIds.includes(thread.threadId));
    if (!identity) continue;

    // Skip if already covered as Concierge reply-overdue for same subject
    if (
      signals.some(
        (s) =>
          s.subjectKey === identity.subjectKey &&
          (s.signalType === "reply-overdue" || s.signalType === "new-inquiry"),
      )
    ) {
      suppressedCount += 1;
      continue;
    }

    push(
      buildSignal({
        identity,
        signalType: "unanswered-inbound",
        urgency: hours >= 48 ? "high" : "medium",
        confidence: identity.contactIds.length ? "high" : "medium",
        summary: `Inbound email has been waiting about ${Math.round(hours)} hours without a reply.`,
        whyItMatters:
          "An unanswered client thread can stall a live conversation.",
        recommendedAction: `Reply today with a calm next step for ${identity.displayName}.`,
        lastInboundAt: thread.lastInboundAt,
        evidence: [
          evidence("gmail", "gmail-thread-meta", thread.threadId, {
            observation: `Inbound unreplied ~${Math.round(hours)}h.`,
          }),
        ],
      }),
    );
  }

  // C. Follow-up due (next activity / open tasks)
  for (const contact of input.bundle.hubspot.contacts) {
    const identity = identityForContact(contact.contactId);
    if (!identity) continue;

    const nextAt = contact.nextActivityAt;
    if (nextAt) {
      const dueMs = Date.parse(nextAt);
      if (dueMs <= now) {
        push(
          buildSignal({
            identity,
            signalType: "follow-up-due",
            urgency: dueMs < now - 86400_000 ? "high" : "medium",
            confidence: "high",
            summary: "A scheduled HubSpot follow-up is due or overdue.",
            whyItMatters:
              "A promised next step loses trust when it slips without notice.",
            recommendedAction: `Complete or reschedule today's follow-up with ${identity.displayName}.`,
            nextActivityAt: nextAt,
            evidence: [
              evidence("hubspot", "hubspot-activity", contact.contactId, {
                observation: "Contact next activity is due or overdue.",
              }),
            ],
          }),
        );
      }
    }

    for (const task of tasksByContact.get(contact.contactId) ?? []) {
      if (task.status !== "open" || !task.dueAt) continue;
      if (Date.parse(task.dueAt) > now) continue;
      push(
        buildSignal({
          identity,
          signalType: "follow-up-due",
          urgency: "high",
          confidence: "high",
          summary: "An open client task is overdue.",
          whyItMatters: "Open CRM tasks that slip become silent relationship risk.",
          recommendedAction: `Clear the overdue follow-up for ${identity.displayName} today.`,
          nextActivityAt: task.dueAt,
          evidence: [
            evidence("hubspot", "hubspot-task", task.taskId, {
              observation: "Open task past due.",
            }),
          ],
        }),
      );
    }
  }

  // D/F/G. Stalled / missing next step / deal-stage risk
  for (const deal of input.bundle.hubspot.deals) {
    if (deal.closed || deal.deferred) continue;
    const contactId = deal.contactIds[0];
    const identity = identityForContact(contactId);
    if (!identity) continue;
    const contact = contactId ? contactById.get(contactId) : undefined;
    const lastActivity = deal.lastActivityAt || contact?.lastActivityAt;
    const hasNext =
      Boolean(deal.nextActivityAt && Date.parse(deal.nextActivityAt) > now) ||
      Boolean(contact?.nextActivityAt && Date.parse(contact.nextActivityAt) > now) ||
      (tasksByContact.get(contactId ?? "") ?? []).some(
        (t) => t.status === "open" && t.dueAt && Date.parse(t.dueAt) > now,
      );

    const advanced = isAdvancedStage(deal.stage);
    const stallDays = advanced
      ? thresholds.stalledAdvancedDays
      : thresholds.stalledEarlyDays;

    if (!hasNext && lastActivity) {
      const days = (now - Date.parse(lastActivity)) / 86400_000;
      if (days >= stallDays) {
        push(
          buildSignal({
            identity,
            signalType: "stalled-conversation",
            urgency: advanced ? "high" : "medium",
            confidence: "medium",
            summary: `No next step after about ${Math.round(days)} days of quiet.`,
            whyItMatters: advanced
              ? "An advanced conversation without a next move can cool quickly."
              : "Early inquiries still need a clear, low-pressure next step.",
            recommendedAction: advanced
              ? `Send a brief confidence-check email to ${identity.displayName}.`
              : `Offer ${identity.displayName} one calm next step (call or Concierge follow-up).`,
            lastActivityAt: lastActivity,
            evidence: [
              evidence("hubspot", "hubspot-deal", deal.dealId, {
                observation: `Deal inactive ~${Math.round(days)}d without future step.`,
              }),
            ],
          }),
        );
      } else if (advanced || days >= 3) {
        // F. Missing next step on qualified deals even before full stall window
        push(
          buildSignal({
            identity,
            signalType: "missing-next-step",
            urgency: "medium",
            confidence: "medium",
            summary:
              "Active inquiry has no recorded future meeting, task, or reply.",
            whyItMatters:
              "Without a next move, even healthy conversations drift.",
            recommendedAction: `Set one clear next step with ${identity.displayName} today.`,
            lastActivityAt: lastActivity,
            evidence: [
              evidence("hubspot", "hubspot-deal", deal.dealId, {
                observation: "No future activity on an active deal.",
              }),
            ],
          }),
        );
      }
    }

    // E. Proposal / deadline approaching
    const target = deal.proposalDate || deal.targetDate || deal.appointmentDate;
    if (target) {
      const daysUntil = (Date.parse(target) - now) / 86400_000;
      if (
        daysUntil >= 0 &&
        daysUntil <= thresholds.proposalApproachingDays &&
        advanced
      ) {
        push(
          buildSignal({
            identity,
            signalType: "proposal-date-approaching",
            urgency: daysUntil <= 3 ? "critical" : daysUntil <= 7 ? "high" : "medium",
            confidence: "high",
            summary: `A target date is about ${Math.round(daysUntil)} days away.`,
            whyItMatters:
              "Proposal and ceremony dates need progress before the window closes.",
            recommendedAction: `Confirm timeline and outstanding decisions with ${identity.displayName}.`,
            targetDate: target,
            evidence: [
              evidence("hubspot", "hubspot-deal", deal.dealId, {
                observation: `Target/proposal date within ${thresholds.proposalApproachingDays}d.`,
              }),
            ],
          }),
        );
      }

      // G. Deal-stage risk: advanced + aging proposal window without progress
      if (advanced && lastActivity) {
        const idleDays = (now - Date.parse(lastActivity)) / 86400_000;
        if (idleDays >= thresholds.stalledAdvancedDays && daysUntil <= 7) {
          push(
            buildSignal({
              identity,
              signalType: "deal-stage-risk",
              urgency: "high",
              confidence: "medium",
              summary:
                "Advanced-stage deal is near a deadline with prolonged inactivity.",
              whyItMatters:
                "Structured risk — not ordinary silence — when stage and deadline both press.",
              recommendedAction: `Prioritize a short check-in with ${identity.displayName} on remaining decisions.`,
              lastActivityAt: lastActivity,
              targetDate: target,
              evidence: [
                evidence("hubspot", "hubspot-deal", deal.dealId, {
                  observation: "Advanced stage + deadline proximity + inactivity.",
                }),
              ],
            }),
          );
        }
      }
    }
  }

  // H. Material data discrepancies
  for (const identity of input.identities) {
    const contact = identity.contactIds
      .map((id) => contactById.get(id))
      .find(Boolean);
    const threads = identity.normalizedEmail
      ? threadsByEmail.get(identity.normalizedEmail) ?? []
      : [];
    const latestOutbound = threads
      .filter((t) => t.lastOutboundAt)
      .sort(
        (a, b) =>
          Date.parse(b.lastOutboundAt!) - Date.parse(a.lastOutboundAt!),
      )[0];
    const unrepliedInbound = threads.some(
      (t) =>
        t.latestDirection === "inbound" &&
        !t.hasLaterOutboundReply &&
        t.businessRelevant,
    );

    // HubSpot "contacted" style lead status but Gmail shows no outbound
    if (
      contact?.leadStatus &&
      /contacted|in_progress/i.test(contact.leadStatus) &&
      unrepliedInbound &&
      !threads.some((t) => t.hasLaterOutboundReply)
    ) {
      push(
        buildSignal({
          identity,
          signalType: "data-discrepancy",
          urgency: "medium",
          confidence: "medium",
          discrepancyClass: "reply-status-gmail-vs-hubspot",
          summary:
            "CRM suggests contact was made, but Gmail shows an unreplied inbound thread.",
          whyItMatters:
            "Acting on the wrong source could leave a client waiting.",
          recommendedAction: `Verify reply status for ${identity.displayName} before relying on CRM.`,
          evidence: [
            evidence("hubspot", "hubspot-contact", contact.contactId, {
              observation: "Lead status implies contacted.",
            }),
            evidence("gmail", "cross-source-compare", "reply-check", {
              observation: "No outbound reply found on related threads.",
            }),
          ],
        }),
      );
    }

    // Gmail recent reply but CRM activity stale
    if (
      latestOutbound?.lastOutboundAt &&
      contact?.lastActivityAt &&
      Date.parse(latestOutbound.lastOutboundAt) >
        Date.parse(contact.lastActivityAt) + 2 * 86400_000
    ) {
      push(
        buildSignal({
          identity,
          signalType: "data-discrepancy",
          urgency: "low",
          confidence: "medium",
          discrepancyClass: "last-activity-timestamp-mismatch",
          summary:
            "Gmail shows a newer outbound reply than HubSpot last activity.",
          whyItMatters:
            "Stale CRM activity can hide completed follow-ups.",
          recommendedAction: `Update CRM activity for ${identity.displayName} or trust Gmail for today's move.`,
          founderRankable: false,
          suppressReason: "Immaterial unless it changes today's action.",
          evidence: [
            evidence("gmail", "gmail-message-meta", latestOutbound.threadId, {
              observation: "Newer outbound than CRM last activity.",
            }),
          ],
        }),
      );
      // Immaterial discrepancy — counted but not founder-rankable
      suppressedCount += 1;
    }
  }

  // Possible duplicates from identity layer — only when actionable
  // (handled as DataGap in audit; optional signal if both are active)
  void bySubject;

  const buyerConcerns = aggregateBuyerConcerns(
    input.bundle,
    thresholds.buyerConcernMinEvidence,
  );

  // I. At most one buyer-concern pattern signal when threshold met
  const topConcern = buyerConcerns[0];
  if (topConcern && topConcern.evidenceCount >= thresholds.buyerConcernMinEvidence) {
    push({
      id: `${CLIENT_ATTENTION_RECOMMENDATION_PREFIX}:buyer-concern-pattern:${slug(topConcern.concern)}`,
      subjectKey: hashPatternKey(topConcern.concern),
      sourceTypes: topConcern.sourceTypes,
      signalType: "buyer-concern-pattern",
      urgency: "low",
      confidence: topConcern.confidence,
      summary: `Recurring buyer concern: ${topConcern.concern}.`,
      whyItMatters:
        "A repeating concern can shape Concierge language and content — without changing Content ROI automatically.",
      recommendedAction:
        "Note the pattern for Concierge tone; do not invent new public content this sprint.",
      evidence: [
        evidence("derived", "derived-pattern", slug(topConcern.concern), {
          observation: `${topConcern.evidenceCount} structured signals in lookback.`,
        }),
      ],
      isPattern: true,
      founderRankable: topConcern.confidence !== "low",
    });
  }

  return {
    signals: signals.slice(0, MAX_CLIENT_ATTENTION_SIGNALS),
    buyerConcerns,
    suppressedCount,
  };
}

function buildSignal(input: {
  identity: ResolvedClientIdentity;
  signalType: ClientAttentionSignal["signalType"];
  urgency: Urgency;
  confidence: ClientAttentionConfidence;
  summary: string;
  whyItMatters: string;
  recommendedAction: string;
  evidence: ClientSignalEvidence[];
  firstSeenAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  lastActivityAt?: string;
  nextActivityAt?: string;
  targetDate?: string;
  discrepancyClass?: ClientAttentionSignal["discrepancyClass"];
  founderRankable?: boolean;
  suppressReason?: string | null;
}): ClientAttentionSignal {
  return {
    id: `${CLIENT_ATTENTION_RECOMMENDATION_PREFIX}:${input.signalType}:${input.identity.subjectKey}`,
    contactId: input.identity.contactIds[0],
    dealId: input.identity.dealIds[0],
    displayName: input.identity.displayName,
    subjectKey: input.identity.subjectKey,
    sourceTypes: input.identity.sourceTypes,
    signalType: input.signalType,
    urgency: input.urgency,
    confidence: input.confidence,
    firstSeenAt: input.firstSeenAt,
    lastInboundAt: input.lastInboundAt,
    lastOutboundAt: input.lastOutboundAt,
    lastActivityAt: input.lastActivityAt,
    nextActivityAt: input.nextActivityAt,
    targetDate: input.targetDate,
    summary: input.summary,
    whyItMatters: input.whyItMatters,
    recommendedAction: input.recommendedAction,
    evidence: input.evidence,
    discrepancyClass: input.discrepancyClass,
    founderRankable: input.founderRankable ?? true,
    suppressReason: input.suppressReason,
  };
}

function evidence(
  sourceType: ClientSignalEvidence["sourceType"],
  kind: ClientSignalEvidence["kind"],
  sourceObjectId: string,
  opts: { observation: string },
): ClientSignalEvidence {
  return {
    id: `ev:${kind}:${sourceObjectId}`.slice(0, 120),
    sourceType,
    kind,
    observation: opts.observation,
    sourceObjectId,
    reliability: "reliable",
    redactionStatus: "clean",
  };
}

function isAdvancedStage(stage?: string): boolean {
  if (!stage) return false;
  return /qualified|presentation|decision|contract|proposal|appointmentscheduled/i.test(
    stage,
  );
}

function aggregateBuyerConcerns(
  bundle: ClientAttentionSourceBundle,
  minEvidence: number,
): BuyerConcernSignal[] {
  const buckets: Record<
    string,
    { count: number; sources: Set<ClientAttentionSignal["sourceTypes"][number]> }
  > = {};

  const bump = (
    concern: string,
    source: ClientAttentionSignal["sourceTypes"][number],
  ) => {
    const key = concern;
    if (!buckets[key]) buckets[key] = { count: 0, sources: new Set() };
    buckets[key].count += 1;
    buckets[key].sources.add(source);
  };

  for (const sub of bundle.concierge.submissions) {
    const text = [
      sub.inspirationNotesSafeSummary,
      sub.budgetRange,
      sub.timeline,
      sub.designDirection,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (/overpay|expensive|cost/.test(text)) bump("fear of overpaying", "concierge");
    if (/where to begin|still exploring|not sure where/.test(text))
      bump("not knowing where to begin", "concierge");
    if (/lab vs|lab versus|natural/.test(text))
      bump("lab versus natural uncertainty", "concierge");
    if (/soon|tight|weeks|timeline/.test(text))
      bump("timeline anxiety", "concierge");
    if (/design|shape|exploring/.test(text))
      bump("design uncertainty", "concierge");
    if (/budget|unsure|prefer to discuss/.test(text))
      bump("budget uncertainty", "concierge");
  }

  return Object.entries(buckets)
    .map(([concern, v]) => ({
      concern,
      count: v.count,
      recencyScore: Math.min(100, v.count * 20),
      sourceTypes: [...v.sources],
      confidence:
        v.count >= minEvidence + 1
          ? ("high" as const)
          : v.count >= minEvidence
            ? ("medium" as const)
            : ("low" as const),
      evidenceCount: v.count,
    }))
    .filter((c) => c.evidenceCount >= minEvidence)
    .sort((a, b) => b.evidenceCount - a.evidenceCount || b.recencyScore - a.recencyScore);
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "concern"
  );
}

function hashPatternKey(concern: string): string {
  return `subj_pattern_${slug(concern)}`;
}
