/**
 * Normalized read-only source snapshots for Client Attention.
 * Adapters gather only — never emit recommendations.
 */

import type { ClientAttentionSourceType } from "../source-of-truth";

export type ClientSourceStatus =
  | "ok"
  | "empty"
  | "failed"
  | "not-configured"
  | "fixture";

export type ClientSourceSnapshotMeta = {
  sourceType: ClientAttentionSourceType;
  status: ClientSourceStatus;
  collectedAt: string;
  recordCount: number;
  /** Human-safe configuration note — no secrets. */
  configurationNote?: string;
  /** Exact missing env / scopes when not configured (safe names only). */
  missingConfiguration?: string[];
  errorCode?: string;
};

export type NormalizedGmailThread = {
  threadId: string;
  latestMessageId?: string;
  /** Normalized emails only — hashing happens in identity layer. */
  normalizedParticipants: string[];
  normalizedPrimaryEmail?: string;
  subject?: string;
  latestDirection: "inbound" | "outbound" | "unknown";
  latestMessageAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  hasLaterOutboundReply: boolean;
  unread?: boolean;
  automated: boolean;
  businessRelevant: boolean;
  contextTags: string[];
  /** Synthetic safe label for fixtures / internal debug — never a real address. */
  safeParticipantLabel?: string;
};

export type NormalizedHubSpotContact = {
  contactId: string;
  normalizedEmail?: string;
  normalizedPhone?: string;
  firstName?: string;
  lastName?: string;
  lifecycleStage?: string;
  leadStatus?: string;
  lastActivityAt?: string;
  lastModifiedAt?: string;
  nextActivityAt?: string;
  ownerId?: string;
  sourceAttribution?: string;
  conciergeProjectType?: string;
  conciergeTimeline?: string;
  conciergeBudgetRange?: string;
  conciergePreferredContact?: string;
  notesSummary?: string;
};

export type NormalizedHubSpotDeal = {
  dealId: string;
  contactIds: string[];
  dealName?: string;
  stage?: string;
  pipeline?: string;
  ownerId?: string;
  amount?: number | null;
  targetDate?: string;
  proposalDate?: string;
  appointmentDate?: string;
  lastActivityAt?: string;
  lastModifiedAt?: string;
  nextActivityAt?: string;
  createdAt?: string;
  closed?: boolean;
  deferred?: boolean;
};

export type NormalizedHubSpotTask = {
  taskId: string;
  contactId?: string;
  dealId?: string;
  subject?: string;
  dueAt?: string;
  lastModifiedAt?: string;
  status: "open" | "completed" | "unknown";
  completedAt?: string;
};

export type NormalizedConciergeSubmission = {
  submissionId: string;
  accepted: boolean;
  submittedAt: string;
  normalizedEmail?: string;
  normalizedPhone?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  projectType?: string;
  timeline?: string;
  budgetRange?: string;
  preferredContactMethod?: string;
  designDirection?: string;
  ringPresence?: string;
  shapeInterest?: string;
  inspirationNotesSafeSummary?: string;
  originatingTool?: string;
  originatingContent?: string;
  landingPath?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  lastCtaLocation?: string;
  referrerHost?: string;
  hubspotContactId?: string;
  hubspotDealId?: string;
};

export type GmailAdapterResult = ClientSourceSnapshotMeta & {
  threads: NormalizedGmailThread[];
};

export type HubSpotAdapterResult = ClientSourceSnapshotMeta & {
  contacts: NormalizedHubSpotContact[];
  deals: NormalizedHubSpotDeal[];
  tasks: NormalizedHubSpotTask[];
};

export type ConciergeAdapterResult = ClientSourceSnapshotMeta & {
  submissions: NormalizedConciergeSubmission[];
};

export type ClientAttentionSourceBundle = {
  gmail: GmailAdapterResult;
  hubspot: HubSpotAdapterResult;
  concierge: ConciergeAdapterResult;
};
