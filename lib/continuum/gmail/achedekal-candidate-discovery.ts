/**
 * Founder-only Achedekal/Alea Project Book candidate related-thread discovery.
 * Reads the existing Gmail metadata index only. Does not fetch thread bodies,
 * call Gmail, fetch attachment bytes, or mutate Person/Project/CoS/Open Jobs.
 * automaticApply: false. automaticCreate: false.
 */

import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import {
  ACHEDEKAL_DISPLAY_NAME,
  ACHEDEKAL_DISCOVERY_WARNING,
  ACHEDEKAL_LIFECYCLE_LABEL,
  ACHEDEKAL_PROJECT_ID,
  ACHEDEKAL_RELATED_THREAD_CANDIDATE_LIMIT,
  isPermittedAchedekalProjectId,
} from "./achedekal-acceptance";
import type { GmailAttachmentMeta } from "./types";
import {
  classifyCadIdentifierStrength,
  extractCadJobIdentifiers,
} from "./cad-job-identifier";
import {
  classifyOrderIdentifierStrength,
  extractOrderIdentifiers,
} from "./order-identifier";
import type { ExistingProjectBook } from "./project-book-containment";
import {
  discoverRelatedThreadCandidates,
  extractProjectIdentifiersFromIndexedMetadata,
  isDiscardedIndexedMessage,
  personEmailHashesFromIndexedThread,
  RECONSTRUCTION_MUTATION_BOUNDARY,
  type RelatedThreadCandidate,
  type RelatedThreadMatchReason,
  type StrongProjectIdentifier,
} from "./project-reconstruction";
import type { ExactThreadCurrentSpecs } from "./reconstruction-evidence";

export const ACHEDEKAL_DISCOVERY_ERROR_CODES = [
  "unauthorized",
  "project-not-found",
  "index-unavailable",
] as const;

export type AchedekalDiscoverySafeErrorCode =
  (typeof ACHEDEKAL_DISCOVERY_ERROR_CODES)[number];

export const ACHEDEKAL_DISCOVERY_FAILURE_KEYS = ["ok", "safeErrorCode"] as const;

export type AchedekalDiscoveryFailure = {
  ok: false;
  safeErrorCode: AchedekalDiscoverySafeErrorCode;
};

export type AchedekalDiscoveryReviewStatus =
  | "candidate"
  | "ambiguous"
  | "unassigned";

export type AchedekalDiscoveryReason = {
  kind: string;
  value: string;
  detail: string;
};

export type AchedekalKnownThreadSummary = {
  threadId: string;
  subject: string | null;
  earliestDate: string | null;
  latestDate: string | null;
  messageCount: number;
  inboundCount: number;
  outboundCount: number;
  attachmentCount: number;
  source: "indexed-metadata";
};

export type AchedekalDiscoveredThread = {
  threadId: string;
  subject: string | null;
  earliestDate: string | null;
  latestDate: string | null;
  messageCount: number;
  inboundCount: number;
  outboundCount: number;
  attachmentCount: number;
  attachmentTypes: string[];
  score: number;
  strength: RelatedThreadCandidate["strength"];
  reasons: AchedekalDiscoveryReason[];
  reviewStatus: AchedekalDiscoveryReviewStatus;
  requiresFounderReview: true;
  attachedProjectId: null;
  fetchApproved: false;
  opened: false;
  metadataOnly: true;
  automaticCreate: false;
};

export type AchedekalDiscoverySuccess = {
  ok: true;
  safeErrorCode: null;
  projectName: typeof ACHEDEKAL_DISPLAY_NAME;
  lifecycle: typeof ACHEDEKAL_LIFECYCLE_LABEL;
  warning: typeof ACHEDEKAL_DISCOVERY_WARNING;
  knownThread: AchedekalKnownThreadSummary | null;
  related: AchedekalDiscoveredThread[];
  ambiguous: AchedekalDiscoveredThread[];
  unassigned: AchedekalDiscoveredThread[];
  candidateLimit: typeof ACHEDEKAL_RELATED_THREAD_CANDIDATE_LIMIT;
  resultsLimited: boolean;
  scannedMessageCount: number;
  hydratedThreadCount: number;
  automaticApply: false;
  automaticCreate: false;
  fetchesRelatedThreads: false;
  fetchesGmail: false;
  mutationBoundary: typeof RECONSTRUCTION_MUTATION_BOUNDARY;
};

export type AchedekalDiscoveryState =
  | AchedekalDiscoveryFailure
  | AchedekalDiscoverySuccess;

export type AchedekalDiscoveryProject = {
  projectId: string;
  gmailThreadId: string | null;
  cadJobNumber: string | null;
  orderNumber: string | null;
  fingerSize: string | null;
  metal: string | null;
  centerStone: string | null;
  personId: string | null;
  personEmailHash: string | null;
};

export type AchedekalDiscoveryCatalog = {
  getTargetProject(): Promise<AchedekalDiscoveryProject | null>;
  listProjectBooks(): Promise<readonly ExistingProjectBook[]>;
};

export type AchedekalDiscoveryIndex = {
  listMessagesByThread(threadId: string): Promise<GmailIndexedMessage[]>;
  listMessagesMatchingSubjectTokens(
    tokens: readonly string[],
  ): Promise<GmailIndexedMessage[]>;
  listMessagesTouchingEmailHash(
    emailHash: string,
  ): Promise<GmailIndexedMessage[]>;
};

export type AchedekalDiscoveryAttachments = {
  listByThread(threadId: string): Promise<GmailAttachmentMeta[]>;
};

export type AchedekalCandidateDiscoveryInput = {
  founderSessionOk: boolean;
  requestedProjectId?: string | null;
  requestedThreadId?: string | null;
  requestedQuery?: string | null;
  catalog: AchedekalDiscoveryCatalog;
  index: AchedekalDiscoveryIndex;
  attachments: AchedekalDiscoveryAttachments;
  internalEmailHashes?: readonly string[];
};

const HYDRATE_THREAD_CAP = 80;

function isDiscoveryErrorCode(
  value: string | null,
): value is AchedekalDiscoverySafeErrorCode {
  return (
    typeof value === "string" &&
    (ACHEDEKAL_DISCOVERY_ERROR_CODES as readonly string[]).includes(value)
  );
}

export function failedAchedekalDiscovery(
  code: AchedekalDiscoverySafeErrorCode,
): AchedekalDiscoveryFailure {
  return { ok: false, safeErrorCode: code };
}

export function sanitizeAchedekalDiscoveryFailure(
  raw: AchedekalDiscoveryFailure,
): AchedekalDiscoveryFailure {
  const code = isDiscoveryErrorCode(raw.safeErrorCode)
    ? raw.safeErrorCode
    : "index-unavailable";
  return { ok: false, safeErrorCode: code };
}

function specsOf(project: AchedekalDiscoveryProject): ExactThreadCurrentSpecs {
  return {
    fingerSize: project.fingerSize,
    orderNumber: project.orderNumber,
    cadJobNumber: project.cadJobNumber,
    metal: project.metal,
    centerStone: project.centerStone,
  };
}

function identifierSearchTokens(
  identifiers: readonly StrongProjectIdentifier[],
): string[] {
  return [
    ...new Set(
      identifiers
        .filter((row) => row.kind === "cad_job_number" || row.kind === "order_number")
        .map((row) => row.value.trim())
        .filter((value) => value.length >= 2),
    ),
  ].slice(0, 24);
}

function mergeIndexed(
  rows: readonly GmailIndexedMessage[],
): GmailIndexedMessage[] {
  const byId = new Map<string, GmailIndexedMessage>();
  for (const row of rows) {
    if (isDiscardedIndexedMessage(row)) continue;
    byId.set(row.messageId, row);
  }
  return [...byId.values()];
}

function subjectHasStrongIdentifier(subject: string | null): boolean {
  const hay = subject ?? "";
  return (
    extractCadJobIdentifiers(hay).some(
      (cad) => classifyCadIdentifierStrength(cad) === "strong_structured",
    ) ||
    extractOrderIdentifiers(hay).some(
      (order) => classifyOrderIdentifierStrength(order) === "strong_structured",
    )
  );
}

function haystackOf(messages: readonly GmailIndexedMessage[]): string {
  return messages.map((row) => row.subject ?? "").join("\n");
}

function booksOwningStrongIdentity(
  hay: string,
  threadId: string,
  books: readonly ExistingProjectBook[],
): ExistingProjectBook[] {
  const cads = extractCadJobIdentifiers(hay).filter(
    (cad) => classifyCadIdentifierStrength(cad) === "strong_structured",
  );
  const orders = extractOrderIdentifiers(hay).filter(
    (order) => classifyOrderIdentifierStrength(order) === "strong_structured",
  );
  return books.filter((book) => {
    if (book.gmailThreadIds.some((id) => id === threadId)) return true;
    if (
      cads.some((cad) =>
        book.cadJobNumbers.some(
          (owned) => owned.trim().toLowerCase() === cad.toLowerCase(),
        ),
      )
    ) {
      return true;
    }
    if (
      orders.some((order) =>
        book.orderNumbers.some(
          (owned) => owned.trim().toLowerCase() === order.toLowerCase(),
        ),
      )
    ) {
      return true;
    }
    return false;
  });
}

function presentReasons(
  reasons: readonly RelatedThreadMatchReason[],
  extra: readonly AchedekalDiscoveryReason[] = [],
): AchedekalDiscoveryReason[] {
  const rows: AchedekalDiscoveryReason[] = [];
  const seen = new Set<string>();
  for (const reason of [...reasons, ...extra]) {
    const detail =
      "detail" in reason && typeof reason.detail === "string" && reason.detail
        ? reason.detail
        : `${reason.kind}: ${reason.value}`;
    const key = `${reason.kind}:${reason.value.toLowerCase()}:${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ kind: reason.kind, value: reason.value, detail });
  }
  return rows;
}

function attachmentSummary(rows: readonly GmailAttachmentMeta[]): {
  attachmentCount: number;
  attachmentTypes: string[];
} {
  const types = [
    ...new Set(
      rows
        .map((row) => row.mimeType)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  return { attachmentCount: rows.length, attachmentTypes: types };
}

function presentKnownThread(
  threadId: string,
  messages: readonly GmailIndexedMessage[],
  attachments: readonly GmailAttachmentMeta[],
): AchedekalKnownThreadSummary {
  const dates = messages.map((row) => row.sentAt).filter(Boolean).sort();
  const subject =
    messages.find((row) => (row.subject ?? "").trim())?.subject ?? null;
  return {
    threadId,
    subject,
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
    messageCount: messages.length,
    inboundCount: messages.filter((row) => row.direction === "inbound").length,
    outboundCount: messages.filter((row) => row.direction === "outbound").length,
    attachmentCount: attachments.length,
    source: "indexed-metadata",
  };
}

function presentDiscovered(
  candidate: RelatedThreadCandidate,
  attachments: readonly GmailAttachmentMeta[],
  reviewStatus: AchedekalDiscoveryReviewStatus,
  extraReasons: readonly AchedekalDiscoveryReason[] = [],
): AchedekalDiscoveredThread {
  const summary = attachmentSummary(attachments);
  return {
    threadId: candidate.threadId,
    subject: candidate.representativeSubject,
    earliestDate: candidate.earliestDate,
    latestDate: candidate.latestDate,
    messageCount: candidate.messageCount,
    inboundCount: candidate.inboundCount,
    outboundCount: candidate.outboundCount,
    attachmentCount: Math.max(summary.attachmentCount, candidate.attachmentHintCount),
    attachmentTypes: summary.attachmentTypes,
    score: candidate.score,
    strength: candidate.strength,
    reasons: presentReasons(candidate.reasons, extraReasons),
    reviewStatus,
    requiresFounderReview: true,
    attachedProjectId: null,
    fetchApproved: false,
    opened: false,
    metadataOnly: true,
    automaticCreate: false,
  };
}

function unassignedFromMessages(
  threadId: string,
  messages: readonly GmailIndexedMessage[],
  attachments: readonly GmailAttachmentMeta[],
  extraReasons: readonly AchedekalDiscoveryReason[],
  reviewStatus: AchedekalDiscoveryReviewStatus,
): AchedekalDiscoveredThread {
  const dates = messages.map((row) => row.sentAt).filter(Boolean).sort();
  const summary = attachmentSummary(attachments);
  return {
    threadId,
    subject: messages.find((row) => (row.subject ?? "").trim())?.subject ?? null,
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
    messageCount: messages.length,
    inboundCount: messages.filter((row) => row.direction === "inbound").length,
    outboundCount: messages.filter((row) => row.direction === "outbound").length,
    attachmentCount: summary.attachmentCount,
    attachmentTypes: summary.attachmentTypes,
    score: 0,
    strength: "insufficient",
    reasons: presentReasons([], extraReasons),
    reviewStatus,
    requiresFounderReview: true,
    attachedProjectId: null,
    fetchApproved: false,
    opened: false,
    metadataOnly: true,
    automaticCreate: false,
  };
}

async function hydrateThreads(
  index: AchedekalDiscoveryIndex,
  threadIds: readonly string[],
): Promise<Map<string, GmailIndexedMessage[]>> {
  const unique = [...new Set(threadIds.filter(Boolean))].slice(0, HYDRATE_THREAD_CAP);
  const byThread = new Map<string, GmailIndexedMessage[]>();
  for (const threadId of unique) {
    const rows = (await index.listMessagesByThread(threadId)).filter(
      (row) => !isDiscardedIndexedMessage(row),
    );
    if (rows.length > 0) byThread.set(threadId, rows);
  }
  return byThread;
}

async function attachmentsForThreads(
  attachments: AchedekalDiscoveryAttachments,
  threadIds: readonly string[],
): Promise<Map<string, GmailAttachmentMeta[]>> {
  const byThread = new Map<string, GmailAttachmentMeta[]>();
  for (const threadId of threadIds) {
    byThread.set(threadId, await attachments.listByThread(threadId));
  }
  return byThread;
}

export async function executeAchedekalCandidateDiscovery(
  input: AchedekalCandidateDiscoveryInput,
): Promise<AchedekalDiscoveryState> {
  if (!input.founderSessionOk) {
    return failedAchedekalDiscovery("unauthorized");
  }
  if (
    input.requestedProjectId != null &&
    input.requestedProjectId.trim() !== "" &&
    !isPermittedAchedekalProjectId(input.requestedProjectId)
  ) {
    return failedAchedekalDiscovery("project-not-found");
  }
  void input.requestedThreadId;
  void input.requestedQuery;

  let project: AchedekalDiscoveryProject | null;
  try {
    project = await input.catalog.getTargetProject();
  } catch {
    return failedAchedekalDiscovery("index-unavailable");
  }
  if (!project || !isPermittedAchedekalProjectId(project.projectId)) {
    return failedAchedekalDiscovery("project-not-found");
  }

  const anchorThreadId = project.gmailThreadId?.trim() ?? "";
  let knownMessages: GmailIndexedMessage[] = [];
  try {
    if (anchorThreadId) {
      knownMessages = (await input.index.listMessagesByThread(anchorThreadId)).filter(
        (row) => !isDiscardedIndexedMessage(row),
      );
    }
  } catch {
    return failedAchedekalDiscovery("index-unavailable");
  }

  const personHashes = [
    ...new Set(
      [
        project.personEmailHash,
        ...personEmailHashesFromIndexedThread(
          knownMessages,
          input.internalEmailHashes,
        ),
      ].filter((value): value is string => Boolean(value)),
    ),
  ];
  const identifiers = extractProjectIdentifiersFromIndexedMetadata({
    anchorThreadId: anchorThreadId || ACHEDEKAL_PROJECT_ID,
    currentSpecs: specsOf(project),
    personEmailHash: personHashes[0] ?? null,
    personEmailHashes: personHashes,
    indexedMessages: knownMessages,
    internalEmailHashes: input.internalEmailHashes,
  });
  const tokens = identifierSearchTokens(identifiers);

  let tokenHits: GmailIndexedMessage[] = [];
  let personHits: GmailIndexedMessage[] = [];
  try {
    tokenHits = await input.index.listMessagesMatchingSubjectTokens(tokens);
    for (const hash of personHashes) {
      const rows = await input.index.listMessagesTouchingEmailHash(hash);
      personHits.push(
        ...rows.filter((row) => subjectHasStrongIdentifier(row.subject)),
      );
    }
  } catch {
    return failedAchedekalDiscovery("index-unavailable");
  }

  const scanned = mergeIndexed([...tokenHits, ...personHits, ...knownMessages]);
  const threadIds = [
    ...new Set(
      scanned
        .map((row) => row.threadId)
        .filter((threadId) => threadId && threadId !== anchorThreadId),
    ),
  ];
  let hydrated: Map<string, GmailIndexedMessage[]>;
  try {
    hydrated = await hydrateThreads(input.index, threadIds);
  } catch {
    return failedAchedekalDiscovery("index-unavailable");
  }

  const discoveryMessages = [
    ...knownMessages,
    ...[...hydrated.values()].flat(),
  ];
  const discovered = discoverRelatedThreadCandidates({
    anchorThreadId,
    identifiers,
    indexedMessages: discoveryMessages,
    candidateProjectId: ACHEDEKAL_PROJECT_ID,
    internalEmailHashes: input.internalEmailHashes,
  });

  let books: readonly ExistingProjectBook[] = [];
  try {
    books = await input.catalog.listProjectBooks();
  } catch {
    return failedAchedekalDiscovery("index-unavailable");
  }

  const related: AchedekalDiscoveredThread[] = [];
  const ambiguous: AchedekalDiscoveredThread[] = [];
  const unassigned: AchedekalDiscoveredThread[] = [];
  const seenThreads = new Set<string>(anchorThreadId ? [anchorThreadId] : []);

  let attachmentMap: Map<string, GmailAttachmentMeta[]>;
  try {
    attachmentMap = await attachmentsForThreads(input.attachments, [
      ...hydrated.keys(),
      ...(anchorThreadId ? [anchorThreadId] : []),
    ]);
  } catch {
    return failedAchedekalDiscovery("index-unavailable");
  }

  for (const candidate of discovered.candidates) {
    if (candidate.threadId === anchorThreadId) continue;
    seenThreads.add(candidate.threadId);
    const threadMessages = hydrated.get(candidate.threadId) ?? [];
    const hay = haystackOf(threadMessages);
    const owners = booksOwningStrongIdentity(hay, candidate.threadId, books);
    const otherOwners = owners.filter(
      (book) => book.projectId !== ACHEDEKAL_PROJECT_ID,
    );
    const attachments = attachmentMap.get(candidate.threadId) ?? [];
    if (otherOwners.length > 0) {
      const collision: AchedekalDiscoveryReason = {
        kind: "spans_multiple_projects",
        value: [ACHEDEKAL_PROJECT_ID, ...otherOwners.map((book) => book.projectId)].join(
          ",",
        ),
        detail:
          "Ambiguous between Project Books. Requires founder review. Not attached.",
      };
      ambiguous.push(
        presentDiscovered(candidate, attachments, "ambiguous", [collision]),
      );
      continue;
    }
    related.push(presentDiscovered(candidate, attachments, "candidate"));
  }

  for (const [threadId, messages] of hydrated) {
    if (seenThreads.has(threadId)) continue;
    const hay = haystackOf(messages);
    if (!subjectHasStrongIdentifier(hay)) continue;
    const owners = booksOwningStrongIdentity(hay, threadId, books);
    const targetOwned = owners.some((book) => book.projectId === ACHEDEKAL_PROJECT_ID);
    if (targetOwned) continue;
    const otherOwners = owners.filter(
      (book) => book.projectId !== ACHEDEKAL_PROJECT_ID,
    );
    const attachments = attachmentMap.get(threadId) ?? [];
    if (otherOwners.length > 0) {
      unassigned.push(
        unassignedFromMessages(
          threadId,
          messages,
          attachments,
          [
            {
              kind: "spans_multiple_projects",
              value: otherOwners.map((book) => book.projectId).join(","),
              detail:
                "Indexed evidence fits another Project Book. Not attached to this Project Book.",
            },
            {
              kind: "possible_new_project",
              value: threadId,
              detail:
                "Possible separate engagement for the same Person. automaticCreate is false.",
            },
          ],
          otherOwners.length > 1 ? "ambiguous" : "unassigned",
        ),
      );
      continue;
    }
    unassigned.push(
      unassignedFromMessages(
        threadId,
        messages,
        attachments,
        [
          {
            kind: "possible_new_project",
            value: threadId,
            detail:
              "Person-related evidence with a strong identifier that does not fit this Project Book. automaticCreate is false.",
          },
        ],
        "unassigned",
      ),
    );
  }

  related.sort(
    (left, right) =>
      right.score - left.score || left.threadId.localeCompare(right.threadId),
  );
  ambiguous.sort(
    (left, right) =>
      right.score - left.score || left.threadId.localeCompare(right.threadId),
  );
  unassigned.sort((left, right) => left.threadId.localeCompare(right.threadId));

  const limitedRelated = related.slice(0, ACHEDEKAL_RELATED_THREAD_CANDIDATE_LIMIT);
  const remainingSlots = Math.max(
    0,
    ACHEDEKAL_RELATED_THREAD_CANDIDATE_LIMIT - limitedRelated.length,
  );
  const limitedAmbiguous = ambiguous.slice(0, remainingSlots);
  const leftover = Math.max(0, remainingSlots - limitedAmbiguous.length);
  const limitedUnassigned = unassigned.slice(0, leftover);
  const resultsLimited =
    related.length > limitedRelated.length ||
    ambiguous.length > limitedAmbiguous.length ||
    unassigned.length > limitedUnassigned.length;

  let knownAttachments: GmailAttachmentMeta[] = [];
  if (anchorThreadId) {
    knownAttachments = attachmentMap.get(anchorThreadId) ?? [];
  }

  return {
    ok: true,
    safeErrorCode: null,
    projectName: ACHEDEKAL_DISPLAY_NAME,
    lifecycle: ACHEDEKAL_LIFECYCLE_LABEL,
    warning: ACHEDEKAL_DISCOVERY_WARNING,
    knownThread: anchorThreadId
      ? presentKnownThread(anchorThreadId, knownMessages, knownAttachments)
      : null,
    related: limitedRelated,
    ambiguous: limitedAmbiguous,
    unassigned: limitedUnassigned,
    candidateLimit: ACHEDEKAL_RELATED_THREAD_CANDIDATE_LIMIT,
    resultsLimited,
    scannedMessageCount: scanned.length,
    hydratedThreadCount: hydrated.size,
    automaticApply: false,
    automaticCreate: false,
    fetchesRelatedThreads: false,
    fetchesGmail: false,
    mutationBoundary: RECONSTRUCTION_MUTATION_BOUNDARY,
  };
}
