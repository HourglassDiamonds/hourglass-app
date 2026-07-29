/**
 * Deterministic synthetic fixtures for Client Attention.
 * No real names, emails, or phone numbers.
 */

import type {
  NormalizedConciergeSubmission,
  NormalizedGmailThread,
  NormalizedHubSpotContact,
  NormalizedHubSpotDeal,
  NormalizedHubSpotTask,
} from "./adapters/types";

/** Fixed "now" for deterministic hour math in fixtures. */
export const CLIENT_ATTENTION_FIXTURE_NOW = "2026-07-29T15:00:00.000Z";

function hoursAgo(hours: number): string {
  const ms = Date.parse(CLIENT_ATTENTION_FIXTURE_NOW) - hours * 3600_000;
  return new Date(ms).toISOString();
}

function daysAgo(days: number): string {
  return hoursAgo(days * 24);
}

function daysFromNow(days: number): string {
  const ms = Date.parse(CLIENT_ATTENTION_FIXTURE_NOW) + days * 86400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Synthetic emails — clearly fake domains. */
export const FIXTURE_EMAILS = {
  sarah: "sarah.m.fixture@clients.example.test",
  michael: "michael.r.fixture@clients.example.test",
  jordan: "jordan.k.fixture@clients.example.test",
  alexA: "alex.a.fixture@clients.example.test",
  alexB: "alex.b.fixture@clients.example.test",
  newsletter: "noreply@newsletter.example.test",
} as const;

export function buildSuccessFixtureSources(): {
  threads: NormalizedGmailThread[];
  contacts: NormalizedHubSpotContact[];
  deals: NormalizedHubSpotDeal[];
  tasks: NormalizedHubSpotTask[];
  submissions: NormalizedConciergeSubmission[];
} {
  const contacts: NormalizedHubSpotContact[] = [
    {
      contactId: "fixture-contact-sarah",
      normalizedEmail: FIXTURE_EMAILS.sarah,
      firstName: "Sarah",
      lastName: "Mill",
      lifecycleStage: "lead",
      leadStatus: "NEW",
      lastActivityAt: hoursAgo(30),
      nextActivityAt: undefined,
      conciergeProjectType: "Engagement Ring",
      conciergeTimeline: "About 5 weeks",
      conciergeBudgetRange: "Prefer to Discuss",
      conciergePreferredContact: "email",
    },
    {
      contactId: "fixture-contact-michael",
      normalizedEmail: FIXTURE_EMAILS.michael,
      firstName: "Michael",
      lastName: "Reed",
      lifecycleStage: "opportunity",
      leadStatus: "IN_PROGRESS",
      lastActivityAt: daysAgo(6),
      nextActivityAt: undefined,
    },
    {
      contactId: "fixture-contact-jordan",
      normalizedEmail: FIXTURE_EMAILS.jordan,
      firstName: "Jordan",
      lastName: "Kay",
      lifecycleStage: "opportunity",
      lastActivityAt: daysAgo(2),
      nextActivityAt: daysAgo(1),
    },
    {
      contactId: "fixture-contact-alex-a",
      normalizedEmail: FIXTURE_EMAILS.alexA,
      firstName: "Alex",
      lastName: "North",
      lifecycleStage: "lead",
    },
    {
      contactId: "fixture-contact-alex-b",
      normalizedEmail: FIXTURE_EMAILS.alexB,
      firstName: "Alex",
      lastName: "North",
      lifecycleStage: "lead",
    },
  ];

  const deals: NormalizedHubSpotDeal[] = [
    {
      dealId: "fixture-deal-sarah",
      contactIds: ["fixture-contact-sarah"],
      dealName: "Sarah M — Engagement Ring",
      stage: "appointmentscheduled",
      createdAt: hoursAgo(30),
      targetDate: daysFromNow(35),
      proposalDate: daysFromNow(35),
      lastActivityAt: hoursAgo(30),
    },
    {
      dealId: "fixture-deal-michael",
      contactIds: ["fixture-contact-michael"],
      dealName: "Michael R — Shortlist",
      stage: "qualifiedtobuy",
      lastActivityAt: daysAgo(6),
      nextActivityAt: undefined,
    },
    {
      dealId: "fixture-deal-jordan",
      contactIds: ["fixture-contact-jordan"],
      dealName: "Jordan K — Design",
      stage: "presentationscheduled",
      lastActivityAt: daysAgo(2),
      nextActivityAt: daysAgo(1),
      proposalDate: daysFromNow(3),
    },
  ];

  const tasks: NormalizedHubSpotTask[] = [
    {
      taskId: "fixture-task-jordan",
      contactId: "fixture-contact-jordan",
      dealId: "fixture-deal-jordan",
      subject: "Follow up on design preferences",
      dueAt: daysAgo(1),
      status: "open",
    },
  ];

  const threads: NormalizedGmailThread[] = [
    {
      threadId: "fixture-thread-sarah-1",
      normalizedParticipants: [FIXTURE_EMAILS.sarah],
      normalizedPrimaryEmail: FIXTURE_EMAILS.sarah,
      subject: "Engagement ring inquiry",
      latestDirection: "inbound",
      latestMessageAt: hoursAgo(27),
      lastInboundAt: hoursAgo(27),
      hasLaterOutboundReply: false,
      automated: false,
      businessRelevant: true,
      contextTags: ["concierge-follow-up"],
      safeParticipantLabel: "Sarah M.",
    },
    {
      threadId: "fixture-thread-michael-1",
      normalizedParticipants: [FIXTURE_EMAILS.michael],
      normalizedPrimaryEmail: FIXTURE_EMAILS.michael,
      subject: "Diamond shortlist",
      latestDirection: "outbound",
      latestMessageAt: daysAgo(6),
      lastOutboundAt: daysAgo(6),
      lastInboundAt: daysAgo(7),
      hasLaterOutboundReply: true,
      automated: false,
      businessRelevant: true,
      contextTags: ["shortlist"],
      safeParticipantLabel: "Michael R.",
    },
    {
      threadId: "fixture-thread-michael-2",
      normalizedParticipants: [FIXTURE_EMAILS.michael],
      normalizedPrimaryEmail: FIXTURE_EMAILS.michael,
      subject: "Shape preferences",
      latestDirection: "inbound",
      latestMessageAt: daysAgo(5),
      lastInboundAt: daysAgo(5),
      hasLaterOutboundReply: false,
      automated: false,
      businessRelevant: true,
      contextTags: ["design"],
      safeParticipantLabel: "Michael R.",
    },
    {
      threadId: "fixture-thread-newsletter",
      normalizedParticipants: [FIXTURE_EMAILS.newsletter],
      normalizedPrimaryEmail: FIXTURE_EMAILS.newsletter,
      subject: "Weekly diamond deals",
      latestDirection: "inbound",
      latestMessageAt: hoursAgo(2),
      lastInboundAt: hoursAgo(2),
      hasLaterOutboundReply: false,
      automated: true,
      businessRelevant: false,
      contextTags: ["newsletter"],
    },
  ];

  const submissions: NormalizedConciergeSubmission[] = [
    {
      submissionId: "fixture-submission-sarah",
      accepted: true,
      submittedAt: hoursAgo(27),
      normalizedEmail: FIXTURE_EMAILS.sarah,
      firstName: "Sarah",
      lastName: "Mill",
      fullName: "Sarah Mill",
      projectType: "Engagement Ring",
      timeline: "About 5 weeks",
      budgetRange: "Prefer to Discuss",
      preferredContactMethod: "email",
      designDirection: "Quiet Elegance",
      ringPresence: "Balanced",
      shapeInterest: "Oval",
      originatingTool: "diamond-studio",
      hubspotContactId: "fixture-contact-sarah",
      hubspotDealId: "fixture-deal-sarah",
    },
    {
      submissionId: "fixture-submission-fresh",
      accepted: true,
      submittedAt: hoursAgo(4),
      normalizedEmail: "casey.q.fixture@clients.example.test",
      firstName: "Casey",
      lastName: "Quill",
      projectType: "Wedding Band",
      timeline: "Flexible",
      preferredContactMethod: "email",
    },
  ];

  return { threads, contacts, deals, tasks, submissions };
}

export function buildBuyerConcernFixtureSubmissions(): NormalizedConciergeSubmission[] {
  const concerns = [
    "Worried about overpaying for the diamond",
    "Not sure where to begin with shapes",
    "Unsure about lab vs natural",
    "Timeline feels tight for the proposal",
  ];
  return concerns.map((note, i) => ({
    submissionId: `fixture-concern-${i}`,
    accepted: true,
    submittedAt: hoursAgo(20 + i),
    normalizedEmail: `concern.${i}.fixture@clients.example.test`,
    firstName: `Pat${i}`,
    lastName: "Fixture",
    projectType: "Engagement Ring",
    timeline: i === 3 ? "Soon" : "Flexible",
    budgetRange: i === 0 ? "Unsure" : "Prefer to Discuss",
    designDirection: i === 1 ? "Still exploring" : "Quiet Elegance",
    inspirationNotesSafeSummary: note,
  }));
}
