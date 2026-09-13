/**
 * In-app source / email viewer presentation.
 * Read-only. Does not fetch Gmail, persist bodies, or change provenance rules.
 * Full message content stays off Today cards.
 */

import { CONTINUUM_FOUNDER_TIME_ZONE } from "@/lib/continuum/dashboard/compose";
import { parseGmailFromHeader } from "@/lib/continuum/gmail/payload";
import { parseGmailWebHref } from "./evidence";
import type { CosOpenEmailSource } from "./email-source";
import type { CosFounderActionSource } from "./founder-actions";
import type { CosEvidenceBeat } from "./types";

export const VIEW_EMAIL_LABEL = "View email" as const;
export const OPEN_IN_GMAIL_LABEL = "Open in Gmail" as const;
export const RELATED_EMAIL_LABEL = "Related email" as const;
export const SOURCE_MESSAGE_UNVERIFIED_LABEL =
  "Source message could not be verified" as const;
export const CONFLICT_SOURCE_UNAVAILABLE_COPY =
  "Continuum could not verify the original Gmail message for this proposed value. Showing indexed evidence instead of another project email.";
export const EMAIL_CARD_EXCERPT_MAX = 160;
export const VIEWER_CONTEXT_EXCERPT_MAX = 280;
export const VIEWER_NEARBY_MESSAGES = 2;

const HASH_LIKE = /^[0-9a-f]{16,}$/i;
const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENERIC_SENDER = /^(the client|the shop|unassigned|unknown)$/i;
const GENERIC_HEADLINE = /^Do this now\.?$/i;

export type CosEmailCardView = {
  senderDisplayName: string | null;
  senderEmail: string | null;
  subject: string | null;
  excerpt: string | null;
  hydrateHref: string | null;
};

export type CosSourceViewerRequest = {
  sources: CosOpenEmailSource[];
  relatedSources?: CosOpenEmailSource[];
  personLabel: string | null;
  projectTitle: string | null;
  why: string | null;
  facts: readonly { label: string; value: string }[];
  beats: readonly CosEvidenceBeat[];
  provenanceLimited?: boolean;
  provenanceLabel?: string | null;
};

export type CosSourceViewerAttachment = {
  filename: string;
  mimeType: string | null;
};

export type CosSourceViewerMessage = {
  messageId: string;
  focused: boolean;
  fromDisplayName: string | null;
  fromEmail: string | null;
  to: readonly string[];
  cc: readonly string[];
  subject: string | null;
  sentAtLabel: string | null;
  body: string | null;
  snippetFallback: boolean;
  attachments: readonly CosSourceViewerAttachment[];
};

export type CosSourceViewerView = {
  threadId: string;
  gmailHref: string;
  sourceRef: string | null;
  personLabel: string | null;
  projectTitle: string | null;
  why: string | null;
  facts: readonly { label: string; value: string }[];
  beats: readonly CosEvidenceBeat[];
  focused: CosSourceViewerMessage;
  earlier: readonly CosSourceViewerMessage[];
  later: readonly CosSourceViewerMessage[];
  hiddenEarlierCount: number;
  readOnly: true;
};

export function founderSafeText(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!trimmed) return null;
  if (HASH_LIKE.test(trimmed) || UUID_LIKE.test(trimmed)) return null;
  if (/^gc1\|/i.test(trimmed)) return null;
  return trimmed;
}

export function clipFounderText(value: string | null | undefined, max: number): string | null {
  const text = founderSafeText(value);
  if (!text) return null;
  if (text.length <= max) return text;
  const sliced = text.slice(0, Math.max(0, max - 1)).replace(/\s+\S*$/, "").trim();
  return `${sliced || text.slice(0, max - 1)}…`;
}

export function usefulSenderName(value: string | null | undefined): string | null {
  const text = founderSafeText(value);
  if (!text || GENERIC_SENDER.test(text)) return null;
  if (text.includes("@") && !/\s/.test(text)) return null;
  return text;
}

export function usefulSenderEmail(value: string | null | undefined): string | null {
  const text = founderSafeText(value);
  if (!text || !text.includes("@")) return null;
  if (HASH_LIKE.test(text)) return null;
  return text;
}

export function parseSenderFromRaw(raw: string | null | undefined): {
  displayName: string | null;
  email: string | null;
} {
  const parsed = parseGmailFromHeader(raw ?? null);
  return {
    displayName: usefulSenderName(parsed.displayName),
    email: usefulSenderEmail(parsed.email),
  };
}

export function isUnassignedSubject(subject: string | null | undefined): boolean {
  const value = subject?.trim() ?? "";
  return !value || value === "Unassigned";
}

function finishImperative(text: string): string {
  const trimmed = text.replace(/\s*\/\s*/g, " and ").replace(/\.$/, "").trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function presentUnassignedHeadline(
  headline: string,
  evidenceSummaries: readonly string[],
): string {
  const current = headline.trim();
  if (!GENERIC_HEADLINE.test(current)) return current;
  for (const summary of evidenceSummaries) {
    const useful = clipFounderText(summary, 88);
    if (useful && useful.length >= 12 && !/isn't attached to a person/i.test(useful)) {
      return finishImperative(useful.replace(/…$/, ""));
    }
  }
  return "Identify who this is from.";
}

function latestUsefulExcerpt(
  beats: readonly CosEvidenceBeat[],
  max = EMAIL_CARD_EXCERPT_MAX,
): string | null {
  for (const beat of [...beats].reverse()) {
    if (beat.generatedSource) continue;
    const excerpt = clipFounderText(beat.summary, max);
    if (excerpt) return excerpt;
  }
  return null;
}

export function composeEmailCard(
  item: CosFounderActionSource,
  sources: readonly CosOpenEmailSource[],
): CosEmailCardView | null {
  if (!isUnassignedSubject(item.subject)) return null;
  const excerpt =
    latestUsefulExcerpt(item.brief?.evidence ?? []) ??
    clipFounderText(item.context, EMAIL_CARD_EXCERPT_MAX);
  const hydrateHref = sources[0]?.href?.trim() || null;
  if (!excerpt && !hydrateHref) return null;
  return {
    senderDisplayName: null,
    senderEmail: null,
    subject: null,
    excerpt,
    hydrateHref,
  };
}

export function mergeEmailCardPreview(
  card: CosEmailCardView,
  preview: Partial<
    Pick<CosEmailCardView, "senderDisplayName" | "senderEmail" | "subject" | "excerpt">
  >,
): CosEmailCardView {
  return {
    senderDisplayName:
      usefulSenderName(preview.senderDisplayName) ?? card.senderDisplayName,
    senderEmail: usefulSenderEmail(preview.senderEmail) ?? card.senderEmail,
    subject: founderSafeText(preview.subject) ?? card.subject,
    excerpt: card.excerpt ?? clipFounderText(preview.excerpt, EMAIL_CARD_EXCERPT_MAX),
    hydrateHref: card.hydrateHref,
  };
}

export function composeSourceViewerRequest(
  item: CosFounderActionSource,
  sources: readonly CosOpenEmailSource[],
  evidence: {
    why: string | null;
    facts: readonly { label: string; value: string }[];
    beats: readonly CosEvidenceBeat[];
  } | null,
  relatedSources: readonly CosOpenEmailSource[] = [],
): CosSourceViewerRequest | null {
  const conflict = item.brief?.specConflict ?? item.decision?.specConflict ?? null;
  const generatedConflict = conflict?.sourceGenerated === true;
  const related = relatedSources.map((source) => ({
    href: source.href,
    label: source.label,
  }));
  const unverified =
    Boolean(conflict) &&
    !generatedConflict &&
    (conflict?.sourceProvenance != null
      ? conflict.sourceProvenance !== "EXACT"
      : sources.length === 0);
  if (sources.length === 0) {
    if (!conflict || generatedConflict) return null;
    return {
      sources: [],
      relatedSources: related,
      provenanceLimited: true,
      provenanceLabel: SOURCE_MESSAGE_UNVERIFIED_LABEL,
      personLabel: founderSafeText(item.brief?.personLabel ?? item.job?.clientLabel) ??
        founderSafeText(item.subject !== "Unassigned" ? item.subject.split("/")[0] : null),
      projectTitle:
        founderSafeText(item.brief?.projectTitle ?? item.job?.projectTitle) ?? null,
      why: [SOURCE_MESSAGE_UNVERIFIED_LABEL, CONFLICT_SOURCE_UNAVAILABLE_COPY, evidence?.why]
        .filter(Boolean)
        .join(" "),
      facts: evidence?.facts ?? [],
      beats: evidence?.beats ?? [],
    };
  }
  return {
    sources: sources.map((source) => ({ href: source.href, label: source.label })),
    relatedSources: related,
    provenanceLimited: unverified,
    provenanceLabel: unverified ? SOURCE_MESSAGE_UNVERIFIED_LABEL : null,
    personLabel: founderSafeText(item.brief?.personLabel ?? item.job?.clientLabel) ??
      founderSafeText(item.subject !== "Unassigned" ? item.subject.split("/")[0] : null),
    projectTitle:
      founderSafeText(item.brief?.projectTitle ?? item.job?.projectTitle) ?? null,
    why: unverified
      ? [SOURCE_MESSAGE_UNVERIFIED_LABEL, evidence?.why].filter(Boolean).join(" ")
      : evidence?.why ?? null,
    facts: evidence?.facts ?? [],
    beats: evidence?.beats ?? [],
  };
}

export function formatViewerTimestamp(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CONTINUUM_FOUNDER_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function usefulRecipients(
  addresses: readonly string[],
  internalEmails: readonly string[],
): string[] {
  const internal = new Set(internalEmails.map(normalizeAddress).filter(Boolean));
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of addresses) {
    const parsed = parseGmailFromHeader(raw);
    const email = usefulSenderEmail(parsed.email ?? raw);
    if (!email) continue;
    const key = normalizeAddress(email);
    if (seen.has(key) || internal.has(key)) continue;
    seen.add(key);
    const name = usefulSenderName(parsed.displayName);
    unique.push(name ? `${name} · ${email}` : email);
  }
  return unique;
}

export function sourceRefFromHref(href: string): string | null {
  const parsed = parseGmailWebHref(href);
  if (!parsed) return null;
  return parsed.messageId
    ? `gc1|${parsed.threadId}|${parsed.messageId}`
    : `gc1|${parsed.threadId}`;
}

export type SourceViewerMessageInput = {
  messageId: string;
  fromRaw: string | null;
  fromEmail: string | null;
  to: readonly string[];
  cc: readonly string[];
  subject: string | null;
  sentAt: string | null;
  plainText: string | null;
  snippet: string | null;
  attachments: readonly { filename: string | null; mimeType: string | null }[];
};

function presentMessage(
  input: SourceViewerMessageInput,
  focused: boolean,
  internalEmails: readonly string[],
  bodyMax: number | null,
): CosSourceViewerMessage {
  const sender = parseSenderFromRaw(input.fromRaw);
  const email = sender.email ?? usefulSenderEmail(input.fromEmail);
  const bodySource = founderSafeText(input.plainText);
  const snippet = founderSafeText(input.snippet);
  const body = bodyMax ? clipFounderText(bodySource ?? snippet, bodyMax) : bodySource ?? snippet;
  return {
    messageId: input.messageId,
    focused,
    fromDisplayName: sender.displayName,
    fromEmail: email,
    to: usefulRecipients(input.to, internalEmails),
    cc: usefulRecipients(input.cc, internalEmails),
    subject: founderSafeText(input.subject),
    sentAtLabel: formatViewerTimestamp(input.sentAt),
    body,
    snippetFallback: !bodySource && Boolean(snippet),
    attachments: input.attachments
      .map((row) => ({
        filename: founderSafeText(row.filename) ?? "",
        mimeType: founderSafeText(row.mimeType),
      }))
      .filter((row) => row.filename.length > 0),
  };
}

export function presentSourceViewer(input: {
  href: string;
  threadId: string;
  messages: readonly SourceViewerMessageInput[];
  request: CosSourceViewerRequest;
  internalEmails?: readonly string[];
}): CosSourceViewerView | null {
  const parsed = parseGmailWebHref(input.href);
  if (!parsed || parsed.threadId.toLowerCase() !== input.threadId.toLowerCase()) {
    return null;
  }
  if (input.messages.length === 0) return null;
  const internalEmails = input.internalEmails ?? [];
  const focusId = parsed.messageId?.toLowerCase() ?? "";
  let focusIndex = input.messages.findIndex(
    (row) => row.messageId.toLowerCase() === focusId,
  );
  if (focusIndex < 0) focusIndex = input.messages.length - 1;
  const start = Math.max(0, focusIndex - VIEWER_NEARBY_MESSAGES);
  const presented = input.messages.map((row, index) =>
    presentMessage(
      row,
      index === focusIndex,
      internalEmails,
      index === focusIndex ? null : VIEWER_CONTEXT_EXCERPT_MAX,
    ),
  );
  const focused = presented[focusIndex]!;
  const earlier = presented.slice(start, focusIndex);
  const later = presented.slice(focusIndex + 1);
  return {
    threadId: input.threadId,
    gmailHref: input.href,
    sourceRef: sourceRefFromHref(input.href),
    personLabel: input.request.personLabel,
    projectTitle: input.request.projectTitle,
    why: input.request.why,
    facts: input.request.facts,
    beats: input.request.beats,
    focused,
    earlier,
    later,
    hiddenEarlierCount: start,
    readOnly: true,
  };
}

export function presentIndexedSourceViewer(input: {
  href: string;
  indexedSubject: string | null;
  request: CosSourceViewerRequest;
}): CosSourceViewerView | null {
  const parsed = parseGmailWebHref(input.href);
  if (!parsed) return null;
  const excerpt = latestUsefulExcerpt(input.request.beats, VIEWER_CONTEXT_EXCERPT_MAX);
  return {
    threadId: parsed.threadId,
    gmailHref: input.href,
    sourceRef: sourceRefFromHref(input.href),
    personLabel: input.request.personLabel,
    projectTitle: input.request.projectTitle,
    why: input.request.why,
    facts: input.request.facts,
    beats: input.request.beats,
    focused: {
      messageId: parsed.messageId ?? parsed.threadId,
      focused: true,
      fromDisplayName: null,
      fromEmail: null,
      to: [],
      cc: [],
      subject: founderSafeText(input.indexedSubject),
      sentAtLabel: null,
      body: excerpt,
      snippetFallback: true,
      attachments: [],
    },
    earlier: [],
    later: [],
    hiddenEarlierCount: 0,
    readOnly: true,
  };
}

export function presentEvidenceOnlySourceViewer(
  request: CosSourceViewerRequest,
): CosSourceViewerView {
  const excerpt = latestUsefulExcerpt(request.beats, VIEWER_CONTEXT_EXCERPT_MAX);
  return {
    threadId: "",
    gmailHref: "",
    sourceRef: null,
    personLabel: request.personLabel,
    projectTitle: request.projectTitle,
    why: request.why,
    facts: request.facts,
    beats: request.beats,
    focused: {
      messageId: "indexed-evidence",
      focused: true,
      fromDisplayName: null,
      fromEmail: null,
      to: [],
      cc: [],
      subject: "Indexed evidence",
      sentAtLabel: null,
      body: excerpt,
      snippetFallback: true,
      attachments: [],
    },
    earlier: [],
    later: [],
    hiddenEarlierCount: 0,
    readOnly: true,
  };
}

export function sourceViewerPreviewFromView(view: CosSourceViewerView): CosEmailCardView {
  return {
    senderDisplayName: view.focused.fromDisplayName,
    senderEmail: view.focused.fromEmail,
    subject: view.focused.subject,
    excerpt: clipFounderText(view.focused.body, EMAIL_CARD_EXCERPT_MAX),
    hydrateHref: view.gmailHref,
  };
}
