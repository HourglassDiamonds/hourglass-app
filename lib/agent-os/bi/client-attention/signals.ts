/**
 * Generate actionable ClientAttentionSignal records from resolved identities + sources.
 *
 * Reply-state authority:
 * - Gmail (ok/fixture/empty) is required to assert reply-overdue / unanswered-inbound.
 * - HubSpot/Concierge alone never claims “you have not replied.”
 * - Recent unhandled Concierge may become new-inquiry-needs-review (unknown response state).
 */

import type {
  ClientAttentionSourceBundle,
  NormalizedHubSpotDeal,
} from "./adapters/types";
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

export type ResponseState = ClientAttentionSignal["responseState"];

/** True when Gmail adapter ran and can confirm inbound/outbound ordering. */
export function gmailCanConfirmReplyState(
  bundle: ClientAttentionSourceBundle,
): boolean {
  const status = bundle.gmail.status;
  return status === "ok" || status === "fixture" || status === "empty";
}

export function isTerminalDeal(deal: NormalizedHubSpotDeal): boolean {
  if (deal.closed || deal.deferred) return true;
  const stage = (deal.stage || "").toLowerCase();
  // Token-bounded: do not treat "appointmentscheduled" / similar as inactive.
  if (/(^|[^a-z0-9])inactive([^a-z0-9]|$)/.test(stage)) return true;
  return /closedwon|closedlost|closed.?won|closed.?lost|lost|cancelled|canceled|disqualified|spam|test|archived|junk/.test(
    stage,
  );
}

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
  const gmailReplyAuthority = gmailCanConfirmReplyState(input.bundle);

  const identityForEmail = (email?: string) =>
    input.identities.find(
      (i) => i.normalizedEmail && email && i.normalizedEmail === email,
    );
  const identityForContact = (contactId?: string) =>
    input.identities.find((i) => contactId && i.contactIds.includes(contactId));

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
    const dedupeKey = `${signal.signalType}:${signal.subjectKey}`;
    if (signals.some((s) => `${s.signalType}:${s.subjectKey}` === dedupeKey)) {
      suppressedCount += 1;
      return;
    }
    signals.push(signal);
  };

  const contactHasOnlyTerminalDeals = (contactId: string): boolean => {
    const deals = dealsByContact.get(contactId) ?? [];
    if (!deals.length) return false;
    return deals.every(isTerminalDeal);
  };

  // A. Concierge — never assert reply-overdue without Gmail confirmation.
  for (const sub of input.bundle.concierge.submissions) {
    if (!sub.accepted) continue;
    const identity =
      (sub.hubspotContactId && identityForContact(sub.hubspotContactId)) ||
      identityForEmail(sub.normalizedEmail) ||
      input.identities.find((i) => i.submissionIds.includes(sub.submissionId));
    if (!identity) continue;

    const hours = (now - Date.parse(sub.submittedAt)) / 3600_000;
    const deals = identity.contactIds.flatMap(
      (id) => dealsByContact.get(id) ?? [],
    );
    const openDeals = deals.filter((d) => !isTerminalDeal(d));
    const terminalOnly = deals.length > 0 && openDeals.length === 0;
    const tasks = identity.contactIds.flatMap(
      (id) => tasksByContact.get(id) ?? [],
    );
    const completedFollowUp = tasks.some((t) => t.status === "completed");
    const openOverdueTask = tasks.some(
      (t) =>
        t.status === "open" && t.dueAt && Date.parse(t.dueAt) <= now,
    );
    const futureNext = openDeals.some(
      (d) => d.nextActivityAt && Date.parse(d.nextActivityAt) > now,
    );

    if (terminalOnly || completedFollowUp) {
      suppressedCount += 1;
      continue;
    }

    const threads = sub.normalizedEmail
      ? threadsByEmail.get(sub.normalizedEmail) ?? []
      : [];
    const gmailConfirmedUnreplied = threads.some(
      (t) =>
        t.businessRelevant &&
        !t.automated &&
        t.latestDirection === "inbound" &&
        !t.hasLaterOutboundReply &&
        Boolean(t.lastInboundAt),
    );

    // Gmail path owns reply-overdue; Concierge does not invent it.
    if (gmailReplyAuthority && gmailConfirmedUnreplied) {
      suppressedCount += 1;
      continue;
    }

    if (hours < thresholds.newInquiryMediumHours) {
      suppressedCount += 1;
      continue;
    }

    // Without Gmail reply authority: only a recent, unhandled review item.
    if (!gmailReplyAuthority) {
      if (hours > thresholds.conciergeReviewMaxAgeHoursWithoutGmail) {
        // Stale open inquiry — do not claim awaiting email reply.
        // Explicit CRM anchors (overdue task / future next) are handled elsewhere.
            if (!openOverdueTask && !futureNext) {
              suppressedCount += 1;
              continue;
            }
            // Explicit CRM anchors still should not invent reply-overdue here;
            // overdue tasks / next steps are emitted from HubSpot loops below.
            suppressedCount += 1;
            continue;
      }

      let urgency: Urgency = "medium";
      if (hours >= thresholds.newInquiryCriticalHours) urgency = "high";
      else if (hours >= thresholds.newInquiryHighHours) urgency = "high";

      push(
        buildSignal({
          identity,
          signalType: "new-inquiry-needs-review",
          urgency,
          confidence: "low",
          responseState: "unknown",
          summary: `Recent Concierge inquiry (~${Math.round(hours)}h) has no Gmail confirmation of reply status.`,
          whyItMatters:
            "Worth a calm CRM check — HubSpot alone cannot prove whether an email reply is still owed.",
          recommendedAction: `Review this recent Concierge inquiry for ${identity.displayName} and confirm the next step.`,
          firstSeenAt: sub.submittedAt,
          evidence: [
            evidence("concierge", "concierge-submission", sub.submissionId, {
              observation: `Accepted Concierge submission age ~${Math.round(hours)}h; response state unknown without Gmail.`,
              reliability: "unverified",
            }),
            evidence("derived", "source-gap", "gmail-reply-state", {
              observation: "Gmail reply authority unavailable this run.",
              reliability: "unavailable",
            }),
          ],
        }),
      );
      continue;
    }

    // Gmail available but no confirming unreplied thread yet — still not reply-overdue.
    if (hours <= thresholds.conciergeReviewMaxAgeHoursWithoutGmail) {
      push(
        buildSignal({
          identity,
          signalType: "new-inquiry-needs-review",
          urgency: hours >= thresholds.newInquiryHighHours ? "medium" : "low",
          confidence: "medium",
          responseState: "unknown",
          summary: `Recent Concierge inquiry (~${Math.round(hours)}h) needs review; no matching unreplied Gmail thread confirmed.`,
          whyItMatters:
            "Keep the Concierge response promise without inventing an unanswered-email claim.",
          recommendedAction: `Review this recent Concierge inquiry for ${identity.displayName}.`,
          firstSeenAt: sub.submittedAt,
          evidence: [
            evidence("concierge", "concierge-submission", sub.submissionId, {
              observation: `Submission age ~${Math.round(hours)}h without Gmail-confirmed unreplied inbound.`,
              reliability: "degraded",
            }),
          ],
        }),
      );
    } else {
      suppressedCount += 1;
    }
  }

  // B. Unanswered inbound / reply-overdue — Gmail authority only.
  if (gmailReplyAuthority) {
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

      const deals = identity.contactIds.flatMap(
        (id) => dealsByContact.get(id) ?? [],
      );
      if (deals.length > 0 && deals.every(isTerminalDeal)) {
        suppressedCount += 1;
        continue;
      }

      const isOverdue = hours >= thresholds.newInquiryHighHours;
      const signalType = isOverdue ? "reply-overdue" : "unanswered-inbound";
      let urgency: Urgency = "medium";
      if (hours >= thresholds.newInquiryCriticalHours) urgency = "critical";
      else if (hours >= thresholds.newInquiryHighHours) urgency = "high";

      push(
        buildSignal({
          identity,
          signalType,
          urgency,
          confidence: identity.contactIds.length ? "high" : "medium",
          responseState: "confirmed-awaiting-reply",
          summary: isOverdue
            ? `Inbound email has been waiting about ${Math.round(hours)} hours without a reply.`
            : `Inbound email has been waiting about ${Math.round(hours)} hours without a reply.`,
          whyItMatters: isOverdue
            ? "Hourglass aims to respond within about 24 hours; delay risks losing a warm conversation."
            : "An unanswered client thread can stall a live conversation.",
          recommendedAction: isOverdue
            ? `Reply this morning and confirm ${identity.displayName.split(" ")[0]}'s preferred next step.`
            : `Reply today with a calm next step for ${identity.displayName}.`,
          lastInboundAt: thread.lastInboundAt,
          evidence: [
            evidence("gmail", "gmail-thread-meta", thread.threadId, {
              observation: `Gmail-confirmed inbound unreplied ~${Math.round(hours)}h.`,
            }),
          ],
        }),
      );
    }
  }

  // C. Follow-up due (explicit next activity / open tasks) — HubSpot OK without Gmail.
  for (const contact of input.bundle.hubspot.contacts) {
    const identity = identityForContact(contact.contactId);
    if (!identity) continue;
    if (contactHasOnlyTerminalDeals(contact.contactId)) {
      suppressedCount += 1;
      continue;
    }

    const nextAt = contact.nextActivityAt;
    if (nextAt) {
      const dueMs = Date.parse(nextAt);
      if (dueMs <= now) {
        push(
          buildSignal({
            identity,
            signalType: "follow-up-due",
            urgency: dueMs < now - 86400_000 ? "high" : "medium",
            confidence: gmailReplyAuthority ? "high" : "medium",
            responseState: "not-applicable",
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
          responseState: "not-applicable",
          summary: "An open HubSpot task is overdue.",
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

  // D/E/F/G. Deal-based HubSpot signals (open deals only).
  for (const deal of input.bundle.hubspot.deals) {
    if (isTerminalDeal(deal)) continue;
    const contactId = deal.contactIds[0];
    const identity = identityForContact(contactId);
    if (!identity) continue;
    const contact = contactId ? contactById.get(contactId) : undefined;
    const lastActivity = deal.lastActivityAt || contact?.lastActivityAt;
    const hasNext =
      Boolean(deal.nextActivityAt && Date.parse(deal.nextActivityAt) > now) ||
      Boolean(
        contact?.nextActivityAt && Date.parse(contact.nextActivityAt) > now,
      ) ||
      (tasksByContact.get(contactId ?? "") ?? []).some(
        (t) => t.status === "open" && t.dueAt && Date.parse(t.dueAt) > now,
      );

    const advanced = isAdvancedStage(deal.stage);
    const stallDays = advanced
      ? thresholds.stalledAdvancedDays
      : thresholds.stalledEarlyDays;
    const hubspotConfidence: ClientAttentionConfidence = gmailReplyAuthority
      ? "medium"
      : "low";

    if (!hasNext && lastActivity) {
      const days = (now - Date.parse(lastActivity)) / 86400_000;
      if (days >= stallDays) {
        push(
          buildSignal({
            identity,
            signalType: "stalled-conversation",
            urgency: advanced ? "high" : "medium",
            confidence: hubspotConfidence,
            responseState: "not-applicable",
            summary: `CRM shows about ${Math.round(days)} days of quiet with no recorded next action.`,
            whyItMatters: advanced
              ? "An advanced open opportunity without a next move can cool quickly."
              : "Open inquiries still need a clear, low-pressure next step in CRM.",
            recommendedAction: `Confirm the next step on this open opportunity with ${identity.displayName}.`,
            lastActivityAt: lastActivity,
            evidence: [
              evidence("hubspot", "hubspot-deal", deal.dealId, {
                observation: `Open deal inactive ~${Math.round(days)}d without future step.`,
              }),
            ],
          }),
        );
      } else if (
        (advanced || days >= thresholds.missingNextStepMinIdleDays) &&
        days >= 1
      ) {
        push(
          buildSignal({
            identity,
            signalType: "missing-next-step",
            urgency: "medium",
            confidence: hubspotConfidence,
            responseState: "not-applicable",
            summary: "CRM shows no recorded next action on an open opportunity.",
            whyItMatters:
              "Without a next move in CRM, even healthy conversations drift.",
            recommendedAction: `Set one clear next step with ${identity.displayName} today.`,
            lastActivityAt: lastActivity,
            evidence: [
              evidence("hubspot", "hubspot-deal", deal.dealId, {
                observation: "No future activity on an active open deal.",
              }),
            ],
          }),
        );
      }
    }

    const approachingUrgency = (daysUntil: number): Urgency => {
      if (daysUntil <= 3) return "critical";
      if (daysUntil <= 7) return "high";
      return "low";
    };

    const appointment = deal.appointmentDate;
    if (appointment && advanced) {
      const daysUntil = (Date.parse(appointment) - now) / 86400_000;
      if (daysUntil >= 0 && daysUntil <= thresholds.proposalApproachingDays) {
        push(
          buildSignal({
            identity,
            signalType: "appointment-approaching",
            urgency: approachingUrgency(daysUntil),
            confidence: "high",
            responseState: "not-applicable",
            summary: `An appointment date is about ${Math.round(daysUntil)} days away.`,
            whyItMatters:
              "Upcoming appointments need a confirmed next step before the window closes.",
            recommendedAction: `Confirm the appointment and outstanding decisions with ${identity.displayName}.`,
            targetDate: appointment,
            evidence: [
              evidence("hubspot", "hubspot-deal", deal.dealId, {
                observation: `Appointment date within ${thresholds.proposalApproachingDays}d.`,
              }),
            ],
          }),
        );
      }
    }

    const target = deal.proposalDate || deal.targetDate;
    if (target && target !== appointment) {
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
            urgency: approachingUrgency(daysUntil),
            confidence: "high",
            responseState: "not-applicable",
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

      if (advanced && lastActivity) {
        const idleDays = (now - Date.parse(lastActivity)) / 86400_000;
        if (idleDays >= thresholds.stalledAdvancedDays && daysUntil <= 7) {
          push(
            buildSignal({
              identity,
              signalType: "deal-stage-risk",
              urgency: "high",
              confidence: hubspotConfidence,
              responseState: "not-applicable",
              summary:
                "Advanced-stage open deal is near a deadline with prolonged CRM inactivity.",
              whyItMatters:
                "Structured risk — not an asserted unanswered email — when stage and deadline both press.",
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

  // H. Material data discrepancies (require Gmail for reply-status class)
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

    if (
      gmailReplyAuthority &&
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
          responseState: "confirmed-awaiting-reply",
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

    if (
      gmailReplyAuthority &&
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
          responseState: "not-applicable",
          discrepancyClass: "last-activity-timestamp-mismatch",
          summary:
            "Gmail shows a newer outbound reply than HubSpot last activity.",
          whyItMatters: "Stale CRM activity can hide completed follow-ups.",
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
      suppressedCount += 1;
    }
  }

  const buyerConcerns = aggregateBuyerConcerns(
    input.bundle,
    thresholds.buyerConcernMinEvidence,
  );

  const topConcern = buyerConcerns[0];
  if (
    topConcern &&
    topConcern.evidenceCount >= thresholds.buyerConcernMinEvidence
  ) {
    push({
      id: `${CLIENT_ATTENTION_RECOMMENDATION_PREFIX}:buyer-concern-pattern:${slug(topConcern.concern)}`,
      subjectKey: hashPatternKey(topConcern.concern),
      sourceTypes: topConcern.sourceTypes,
      signalType: "buyer-concern-pattern",
      urgency: "low",
      confidence: topConcern.confidence,
      responseState: "not-applicable",
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
  responseState: ResponseState;
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
    responseState: input.responseState,
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
  opts: {
    observation: string;
    reliability?: ClientSignalEvidence["reliability"];
  },
): ClientSignalEvidence {
  return {
    id: `ev:${kind}:${sourceObjectId}`.slice(0, 120),
    sourceType,
    kind,
    observation: opts.observation,
    sourceObjectId,
    reliability: opts.reliability ?? "reliable",
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
    .sort(
      (a, b) =>
        b.evidenceCount - a.evidenceCount || b.recencyScore - a.recencyScore,
    );
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
