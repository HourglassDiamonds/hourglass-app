/**
 * Read-only New Inquiry intake alert.
 * Does not mint a Person or a Project. Does not rank Up Next.
 * Review opens existing Gmail evidence. No new dismiss workflow.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type {
  TodayGmailThreadContext,
  TodayKnownPerson,
} from "@/lib/continuum/candidates/founder-attention";
import { collectTodayFounderEmailHashes } from "@/lib/continuum/candidates/founder-attention";
import { isCandidateQuietForToday } from "./quiet";
import { gmailEvidenceHrefFromSourceRef } from "./evidence";
import { NEW_PROJECT_CONTEXT_TOPIC } from "@/lib/continuum/gmail/candidates/new-project";
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import { projectGmailSourceEvents } from "@/lib/continuum/source-events/gmail";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import type { CosProjectContext } from "./types";

export const NEW_INQUIRY_STATUS = "New contact · No client or project match" as const;
export const NEW_INQUIRY_REVIEW_LABEL = "Review inquiry" as const;

const BULK_LABELS = new Set([
  "CATEGORY_PROMOTIONS",
  "CATEGORY_UPDATES",
  "CATEGORY_SOCIAL",
  "CATEGORY_FORUMS",
]);

const UNSUPPORTED_TITLES = new Set([
  "new custom piece",
  "payment received",
  "unassigned",
]);

export type NewInquiryCard = {
  id: string;
  threadId: string;
  title: string;
  detail: string | null;
  status: typeof NEW_INQUIRY_STATUS;
  receivedAt: string;
  receivedLabel: string;
  reviewHref: string | null;
  reviewLabel: typeof NEW_INQUIRY_REVIEW_LABEL;
  candidateIds: readonly string[];
};

export type NewInquirySurface = {
  heading: string;
  count: number;
  featured: NewInquiryCard | null;
  moreCount: number;
  moreLabel: string | null;
  threadIds: readonly string[];
  candidateIds: readonly string[];
};

export const EMPTY_NEW_INQUIRY_SURFACE: NewInquirySurface = {
  heading: "NEW INQUIRY",
  count: 0,
  featured: null,
  moreCount: 0,
  moreLabel: null,
  threadIds: [],
  candidateIds: [],
};

export function newInquiryReceivedLabel(sentAt: string, nowIso: string): string {
  const delta = Date.parse(nowIso) - Date.parse(sentAt);
  if (!Number.isFinite(delta) || delta < 60_000) return "Received just now";
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `Received ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return hours === 1 ? "Received 1 hr ago" : `Received ${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Received 1 day ago" : `Received ${days} days ago`;
}

export function minimizeInquirySubjectTitle(subject: string): string {
  const head = subject.split(/\s+[-–—]\s+/)[0] ?? subject;
  const title = head.replace(/\binquiry\b/gi, "").replace(/\s+/g, " ").trim();
  return title;
}

export function inquiryDetailFromSubject(subject: string | null): string | null {
  if (!subject) return null;
  const parts = subject.split(/\s+[-–—]\s+/);
  if (parts.length < 2) return null;
  const detail = parts
    .slice(1)
    .join(", ")
    .replace(/\b(\d+(?:\.\d+)?)\s*ct\b/gi, "$1 ct")
    .replace(/,/g, " ·")
    .replace(/\s*·\s*/g, " · ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return detail || null;
}

function inquiryTitle(proposed: string | null, subject: string | null): string {
  const value = proposed?.replace(/\s+/g, " ").trim() ?? "";
  if (value && !UNSUPPORTED_TITLES.has(value.toLowerCase())) return value;
  const minimized = subject ? minimizeInquirySubjectTitle(subject) : "";
  if (minimized && !UNSUPPORTED_TITLES.has(minimized.toLowerCase())) return minimized;
  return "New inquiry";
}

function threadOf(row: ContinuumCandidate): string | null {
  return parseGmailCandidateSourceRef(row.sourceRef)?.threadId ?? null;
}

function candidatesForThread(
  candidates: readonly ContinuumCandidate[],
  threadId: string,
): ContinuumCandidate[] {
  return candidates.filter((row) => threadOf(row) === threadId);
}

function proposedProjectTitle(rows: readonly ContinuumCandidate[]): string | null {
  for (const row of rows) {
    if (row.payload.kind !== "project_context") continue;
    if (row.payload.topic !== NEW_PROJECT_CONTEXT_TOPIC) continue;
    const value = row.payload.value.replace(/\s+/g, " ").trim();
    if (!value || UNSUPPORTED_TITLES.has(value.toLowerCase())) continue;
    return value;
  }
  return null;
}

function projectResolved(
  threadId: string,
  event: SourceCommunicationEvent,
  rows: readonly ContinuumCandidate[],
  projects: ReadonlyMap<string, CosProjectContext> | undefined,
): boolean {
  if (event.projectId) return true;
  for (const project of projects?.values() ?? []) {
    if (project.gmailThreadId === threadId) return true;
  }
  return rows.some((row) => {
    const target = row.proposedTarget;
    if (target.kind === "project" || target.kind === "project_spec" || target.kind === "open_job") {
      return Boolean(target.projectId);
    }
    return false;
  });
}

function personResolved(
  hash: string,
  rows: readonly ContinuumCandidate[],
  knownPeople: readonly TodayKnownPerson[],
): boolean {
  if (hash && knownPeople.some((person) => person.emailHash.toLowerCase() === hash)) {
    return true;
  }
  return rows.some(
    (row) => row.proposedTarget.kind === "person" && Boolean(row.proposedTarget.personId),
  );
}

function vendorSender(
  hash: string,
  knownPeople: readonly TodayKnownPerson[],
): boolean {
  if (!hash) return false;
  return knownPeople.some(
    (person) =>
      person.emailHash.toLowerCase() === hash &&
      (person.roles ?? []).includes("vendor-contact"),
  );
}

function bulkLabels(labels: readonly string[] | undefined): boolean {
  return (labels ?? []).some((label) => BULK_LABELS.has(label));
}

function dismissed(
  rows: readonly ContinuumCandidate[],
  nowIso: string,
): boolean {
  const inquiryRows = rows.filter(
    (row) =>
      row.payload.kind === "project_context" &&
      row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
  );
  if (inquiryRows.length === 0) return false;
  return inquiryRows.every((row) => isCandidateQuietForToday(row, nowIso));
}

function messageLabels(
  thread: TodayGmailThreadContext | undefined,
  messageId: string | null,
): readonly string[] | undefined {
  const message = thread?.messages?.find((row) => row.messageId === messageId);
  return message?.labelIds ?? thread?.messages?.[0]?.labelIds;
}

export function selectNewInquirySurface(input: {
  nowIso: string;
  candidates?: readonly ContinuumCandidate[];
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null;
  knownPeople?: readonly TodayKnownPerson[];
  projects?: ReadonlyMap<string, CosProjectContext>;
  founderEmailHashes?: ReadonlySet<string> | readonly string[];
}): NewInquirySurface {
  const candidates = input.candidates ?? [];
  const knownPeople = input.knownPeople ?? [];
  const founderHashes = new Set(
    [...(input.founderEmailHashes ?? collectTodayFounderEmailHashes(knownPeople))].map((row) =>
      row.toLowerCase(),
    ),
  );
  const events = projectGmailSourceEvents({
    threadContext: input.threadContext,
    knownPeople,
    founderEmailHashes: founderHashes,
    candidates,
  }).filter((event) => event.semanticClass === "new_commercial_inquiry");

  const byThread = new Map<string, SourceCommunicationEvent>();
  for (const event of events) {
    const threadId = event.threadId?.trim() ?? "";
    if (!threadId || event.direction !== "inbound" || event.actor !== "client") continue;
    const prior = byThread.get(threadId);
    if (!prior || Date.parse(event.timestamp) < Date.parse(prior.timestamp)) {
      byThread.set(threadId, event);
    }
  }

  const cards: NewInquiryCard[] = [];
  for (const [threadId, event] of byThread) {
    const thread = input.threadContext?.get(threadId);
    const rows = candidatesForThread(candidates, threadId);
    const hash = (
      thread?.messages?.find((row) => row.messageId === event.messageId)?.fromEmailHash ??
      thread?.messages?.find((row) => row.direction === "inbound")?.fromEmailHash ??
      ""
    )
      .trim()
      .toLowerCase();
    if (hash && founderHashes.has(hash)) continue;
    if (vendorSender(hash, knownPeople)) continue;
    if (personResolved(hash, rows, knownPeople.filter((person) => !(person.roles ?? []).includes("vendor-contact")))) {
      continue;
    }
    if (projectResolved(threadId, event, rows, input.projects)) continue;
    if (bulkLabels(messageLabels(thread, event.messageId))) continue;
    if (dismissed(rows, input.nowIso)) continue;
    const subject = event.subject ?? thread?.subject ?? null;
    const candidateIds = rows.map((row) => row.candidateId);
    const sourceRef = event.sourceRef;
    cards.push({
      id: `inquiry:${threadId}`,
      threadId,
      title: inquiryTitle(proposedProjectTitle(rows), subject),
      detail: inquiryDetailFromSubject(subject),
      status: NEW_INQUIRY_STATUS,
      receivedAt: event.timestamp,
      receivedLabel: newInquiryReceivedLabel(event.timestamp, input.nowIso),
      reviewHref: gmailEvidenceHrefFromSourceRef(sourceRef),
      reviewLabel: NEW_INQUIRY_REVIEW_LABEL,
      candidateIds,
    });
  }

  cards.sort((left, right) => {
    const delta = Date.parse(left.receivedAt) - Date.parse(right.receivedAt);
    if (delta !== 0) return delta;
    return left.threadId.localeCompare(right.threadId);
  });
  if (cards.length === 0) return EMPTY_NEW_INQUIRY_SURFACE;
  const featured = cards[0]!;
  const moreCount = cards.length - 1;
  return {
    heading: cards.length === 1 ? "NEW INQUIRY" : `NEW INQUIRIES · ${cards.length}`,
    count: cards.length,
    featured,
    moreCount,
    moreLabel: moreCount > 0 ? `+${moreCount} more` : null,
    threadIds: cards.map((row) => row.threadId),
    candidateIds: cards.flatMap((row) => row.candidateIds),
  };
}

export function isDocketItemNewInquiry(
  item: {
    brief?: {
      recoveredGmailThreadId?: string | null;
      canonicalGmailThreadId?: string | null;
      candidateIds?: readonly string[];
    } | null;
  },
  surface: NewInquirySurface | null | undefined,
): boolean {
  if (!surface || surface.count === 0) return false;
  const threads = new Set(surface.threadIds);
  const threadId = item.brief?.recoveredGmailThreadId || item.brief?.canonicalGmailThreadId;
  if (threadId && threads.has(threadId)) return true;
  const candidates = new Set(surface.candidateIds);
  return (item.brief?.candidateIds ?? []).some((id) => candidates.has(id));
}
