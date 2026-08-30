/**
 * Generic Project-scoped artifact candidate discovery.
 * Metadata/provenance only. Does not fetch Gmail bodies or attachment bytes.
 * Does not write Person, Project, Open Jobs, or CoS records.
 * automaticAttach: false. canonical: false. automaticApply: false.
 */

import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import {
  extractCadJobIdentifiers,
  hasBoundedIdentifierToken,
  isGenericHexadecimalCadFragment,
  isStrongStructuredCadIdentifier,
} from "./cad-job-identifier";
import {
  classifyIdentifierSpecificity,
  isStrongStructuredIdentifier,
  isWeakIdentifierSpecificity,
} from "./identifier-specificity";
import {
  extractOrderIdentifiers,
  isStrongStructuredOrderIdentifier,
} from "./order-identifier";
import {
  personDiscoverySeedHashes,
  threadTouchesPersonDiscoverySeed,
} from "./participant-retrieval-role";
import {
  CONTAINMENT_MUTATION_BOUNDARY,
  EVIDENCE_ATTRIBUTION_RESOLUTIONS,
  type ExistingProjectBook,
  type EvidenceAttributionResolution,
} from "./project-book-containment";
import {
  isDiscardedIndexedMessage,
  type ProjectLifecycleCandidate,
} from "./project-reconstruction";
import type { GmailAttachmentMeta } from "./types";

export const ARTIFACT_HUNT_EXACT_LIMIT = 20 as const;
export const ARTIFACT_HUNT_AMBIGUOUS_LIMIT = 10 as const;
export const ARTIFACT_HUNT_UNASSIGNED_LIMIT = 10 as const;
export const ARTIFACT_HUNT_FILENAME_TOKEN_LIMIT = 24 as const;
export const ARTIFACT_HUNT_THREAD_HYDRATE_CAP = 80 as const;
export const ARTIFACT_HUNT_PERSON_THREAD_CAP = 40 as const;

export const ARTIFACT_HUNT_WARNING =
  "Artifact discovery only — metadata index, not opened. No changes will be applied." as const;

export const ARTIFACT_HUNT_ERROR_CODES = [
  "unauthorized",
  "project-not-found",
  "index-unavailable",
] as const;

export type ArtifactHuntSafeErrorCode =
  (typeof ARTIFACT_HUNT_ERROR_CODES)[number];

export const ARTIFACT_METADATA_CLASSES = [
  "cad_render",
  "jewelry_image",
  "diamond_certificate",
  "appraisal",
  "invoice",
  "receipt",
  "order_document",
  "shipping_document",
  "design_reference",
  "generic_document",
  "other",
  "unknown",
] as const;

export type ArtifactMetadataClass = (typeof ARTIFACT_METADATA_CLASSES)[number];

export type ArtifactHuntAttribution = EvidenceAttributionResolution;

export const ARTIFACT_HUNT_ATTRIBUTIONS = EVIDENCE_ATTRIBUTION_RESOLUTIONS;

export type ArtifactHuntReason = {
  kind: string;
  value: string;
  detail: string;
};

export type ArtifactHuntClassification = {
  class: ArtifactMetadataClass;
  basis: "metadata-derived";
  visual: false;
  ocr: false;
  contentInspected: false;
  label: string;
};

export type ProjectArtifactCandidate = {
  candidateId: string;
  projectId: string;
  source: {
    threadId: string;
    messageId: string;
    attachmentId: string;
    filename: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    indexedAt: string;
  };
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sentAt: string | null;
  subject: string | null;
  direction: GmailIndexedMessage["direction"] | null;
  classification: ArtifactHuntClassification;
  attribution: ArtifactHuntAttribution;
  attachedProjectId: string | null;
  spanningProjectIds: readonly string[];
  evidenceReasons: ArtifactHuntReason[];
  reviewState: "candidate" | "needs_review" | "unassigned" | "rejected";
  requiresFounderReview: true;
  requiresFounderApproval: boolean;
  possibleNewProject: boolean;
  duplicateGroup: string | null;
  revisionHint: boolean;
  automaticAttach: false;
  canonical: false;
  opened: false;
  metadataOnly: true;
  bytesFetched: false;
};

export const ARTIFACT_HUNT_MUTATION_BOUNDARY = {
  ...CONTAINMENT_MUTATION_BOUNDARY,
  fetchesGmail: false,
  fetchesAttachmentBytes: false,
  fetchesRelatedThreads: false,
  automaticAttach: false,
  canonical: false,
  refreshesGmailToken: false,
  persistsArtifacts: false,
} as const;

export type ArtifactHuntQueryShape = {
  storedThreadQueries: number;
  filenameTokenQueries: number;
  filenameTokenCount: number;
  subjectTokenQueries: number;
  personHashQueries: number;
  threadHydrations: number;
  scannedAttachmentCount: number;
  fullTableScan: false;
};

export type ArtifactHuntFailure = {
  ok: false;
  safeErrorCode: ArtifactHuntSafeErrorCode;
};

export type ArtifactHuntSuccess = {
  ok: true;
  safeErrorCode: null;
  projectId: string;
  projectTitle: string;
  lifecycle: ProjectLifecycleCandidate;
  warning: typeof ARTIFACT_HUNT_WARNING;
  likely: ProjectArtifactCandidate[];
  ambiguous: ProjectArtifactCandidate[];
  unassigned: ProjectArtifactCandidate[];
  exactLimit: typeof ARTIFACT_HUNT_EXACT_LIMIT;
  ambiguousLimit: typeof ARTIFACT_HUNT_AMBIGUOUS_LIMIT;
  unassignedLimit: typeof ARTIFACT_HUNT_UNASSIGNED_LIMIT;
  resultsLimited: boolean;
  duplicateGroups: readonly { filename: string; candidateIds: readonly string[] }[];
  queryShape: ArtifactHuntQueryShape;
  historicalSafety: {
    remainsHistorical: boolean;
    createsOpenJobs: false;
    createsToday5: false;
    writesChiefOfStaff: false;
    becomesActive: false;
  };
  automaticAttach: false;
  canonical: false;
  fetchesGmail: false;
  fetchesAttachmentBytes: false;
  refreshesGmailToken: false;
  mutationBoundary: typeof ARTIFACT_HUNT_MUTATION_BOUNDARY;
};

export type ArtifactHuntState = ArtifactHuntFailure | ArtifactHuntSuccess;

export type ArtifactHuntProject = {
  projectId: string;
  title: string;
  gmailThreadId: string | null;
  cadJobNumber: string | null;
  orderNumber: string | null;
  fingerSize: string | null;
  metal: string | null;
  centerStone: string | null;
  personId: string | null;
  personEmailHash: string | null;
  personEmailHashes?: readonly string[];
  lifecycle: ProjectLifecycleCandidate;
};

export type ArtifactHuntCatalog = {
  getProject(projectId: string): Promise<ArtifactHuntProject | null>;
  listProjectBooks(): Promise<readonly ExistingProjectBook[]>;
};

export type ArtifactHuntIndex = {
  listMessagesByThread(threadId: string): Promise<GmailIndexedMessage[]>;
  listMessagesMatchingSubjectTokens(
    tokens: readonly string[],
  ): Promise<GmailIndexedMessage[]>;
  listMessagesTouchingEmailHash(emailHash: string): Promise<GmailIndexedMessage[]>;
};

export type ArtifactHuntAttachments = {
  listByThread(threadId: string): Promise<GmailAttachmentMeta[]>;
  listByThreadIds(threadIds: readonly string[]): Promise<GmailAttachmentMeta[]>;
  listByFilenameTokens(tokens: readonly string[]): Promise<GmailAttachmentMeta[]>;
};

export type ArtifactHuntInput = {
  founderSessionOk: boolean;
  projectId: string;
  requestedProjectId?: string | null;
  requestedThreadId?: string | null;
  requestedQuery?: string | null;
  catalog: ArtifactHuntCatalog;
  index: ArtifactHuntIndex;
  attachments: ArtifactHuntAttachments;
  internalEmailHashes?: readonly string[];
};

const GENERIC_CAPTURE_FILENAME =
  /^(image|img|photo|scan|attachment|file)[-_]?\d+\.(jpe?g|png|gif|webp|bmp|heic)$/i;

const JEWELRY_FILENAME_TERMS =
  /\b(ring|bracelet|necklace|earring|earrings|pendant|bangle|band)\b/i;

function isHuntErrorCode(
  value: string | null,
): value is ArtifactHuntSafeErrorCode {
  return (
    typeof value === "string" &&
    (ARTIFACT_HUNT_ERROR_CODES as readonly string[]).includes(value)
  );
}

export function failedArtifactHunt(
  code: ArtifactHuntSafeErrorCode,
): ArtifactHuntFailure {
  return { ok: false, safeErrorCode: code };
}

export function sanitizeArtifactHuntFailure(
  raw: ArtifactHuntFailure,
): ArtifactHuntFailure {
  const code = isHuntErrorCode(raw.safeErrorCode)
    ? raw.safeErrorCode
    : "index-unavailable";
  return { ok: false, safeErrorCode: code };
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function candidateIdOf(row: GmailAttachmentMeta): string {
  return `${row.messageId}:${row.attachmentId}`;
}

function isImageMime(mime: string | null): boolean {
  return (mime ?? "").trim().toLowerCase().startsWith("image/");
}

function isPdfMime(filename: string | null, mime: string | null): boolean {
  const type = (mime ?? "").trim().toLowerCase();
  const name = (filename ?? "").trim().toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

function filenameHasRevisionHint(filename: string | null): boolean {
  const name = filename ?? "";
  return /(?:^|[^A-Za-z0-9])(?:v|rev(?:ision)?)[-_]?\d+(?:$|[^A-Za-z0-9])/i.test(
    name,
  );
}

function classificationLabel(cls: ArtifactMetadataClass): string {
  switch (cls) {
    case "cad_render":
      return "CAD/render candidate";
    case "jewelry_image":
      return "Jewelry image candidate";
    case "diamond_certificate":
      return "Diamond certificate candidate";
    case "appraisal":
      return "Appraisal candidate";
    case "invoice":
      return "Invoice candidate";
    case "receipt":
      return "Receipt candidate";
    case "order_document":
      return "Order document candidate";
    case "shipping_document":
      return "Shipping document candidate";
    case "design_reference":
      return "Design reference candidate";
    case "generic_document":
      return "Generic document candidate";
    case "other":
      return "Other metadata candidate";
    default:
      return "Unknown metadata candidate";
  }
}

export function classifyArtifactMetadata(input: {
  filename: string | null;
  mimeType: string | null;
  strongFilenameIdentifiers: readonly string[];
}): ArtifactHuntClassification {
  const filename = input.filename ?? "";
  const mime = input.mimeType;
  const image = isImageMime(mime);
  const pdf = isPdfMime(filename, mime);
  let cls: ArtifactMetadataClass = "unknown";

  if (GENERIC_CAPTURE_FILENAME.test(filename.trim())) {
    cls = "unknown";
  } else if (input.strongFilenameIdentifiers.length > 0 && image) {
    cls = "cad_render";
  } else if (
    input.strongFilenameIdentifiers.length > 0 &&
    pdf &&
    /\b(cad|render|design)\b/i.test(filename)
  ) {
    cls = "cad_render";
  } else if (pdf && /\bgia[-_]?\d{7,}\b/i.test(filename)) {
    cls = "diamond_certificate";
  } else if (pdf && /\bcertificate\b/i.test(filename)) {
    cls = "diamond_certificate";
  } else if (/\bappraisal\b/i.test(filename)) {
    cls = "appraisal";
  } else if (/\binvoice\b/i.test(filename)) {
    cls = "invoice";
  } else if (/\breceipt\b/i.test(filename)) {
    cls = "receipt";
  } else if (
    /\b(packing|shipping|tracking|waybill|bol)\b/i.test(filename)
  ) {
    cls = "shipping_document";
  } else if (pdf && /\border\b/i.test(filename)) {
    cls = "order_document";
  } else if (input.strongFilenameIdentifiers.length > 0 && pdf) {
    cls = "design_reference";
  } else if (/\b(sketch|moodboard|inspiration|reference)\b/i.test(filename)) {
    cls = "design_reference";
  } else if (image && JEWELRY_FILENAME_TERMS.test(filename)) {
    cls = "jewelry_image";
  } else if (pdf) {
    cls = "generic_document";
  } else {
    cls = "unknown";
  }

  return {
    class: cls,
    basis: "metadata-derived",
    visual: false,
    ocr: false,
    contentInspected: false,
    label: classificationLabel(cls),
  };
}

function uniqueTokens(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const token = raw.trim();
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}

export function collectStrongIdentifierTokens(
  values: readonly (string | null | undefined)[],
): string[] {
  const found: string[] = [];
  for (const raw of values) {
    if (!raw?.trim()) continue;
    const hay = raw.trim();
    for (const cad of extractCadJobIdentifiers(hay)) {
      if (
        isStrongStructuredCadIdentifier(cad) ||
        isStrongStructuredIdentifier(cad)
      ) {
        found.push(cad);
      }
    }
    for (const order of extractOrderIdentifiers(hay)) {
      if (isStrongStructuredOrderIdentifier(order)) found.push(order);
    }
    if (
      isStrongStructuredIdentifier(hay) &&
      !isGenericHexadecimalCadFragment(hay)
    ) {
      found.push(hay);
    }
  }
  return uniqueTokens(found);
}

function boundedHits(haystack: string, tokens: readonly string[]): string[] {
  return uniqueTokens(
    tokens.filter((token) => hasBoundedIdentifierToken(haystack, token)),
  );
}

function catalogStrongIdentifiers(
  books: readonly ExistingProjectBook[],
): string[] {
  return uniqueTokens(
    books.flatMap((book) => [...book.cadJobNumbers, ...book.orderNumbers]),
  ).filter(
    (token) =>
      isStrongStructuredIdentifier(token) || isStrongStructuredCadIdentifier(token),
  );
}

function catalogHits(
  haystack: string,
  books: readonly ExistingProjectBook[],
): { token: string; owners: string[] }[] {
  return catalogStrongIdentifiers(books)
    .filter((token) => hasBoundedIdentifierToken(haystack, token))
    .map((token) => ({ token, owners: identifierOwners(token, books) }));
}

function identifierOwners(
  token: string,
  books: readonly ExistingProjectBook[],
): string[] {
  const needle = norm(token);
  const owners = new Set<string>();
  for (const book of books) {
    const owned = [...book.cadJobNumbers, ...book.orderNumbers];
    if (owned.some((value) => norm(value) === needle)) {
      owners.add(book.projectId);
    }
  }
  return [...owners].sort();
}

function threadOwners(
  threadId: string,
  books: readonly ExistingProjectBook[],
): string[] {
  return books
    .filter((book) => book.gmailThreadIds.includes(threadId))
    .map((book) => book.projectId)
    .sort();
}

function pushReason(
  into: ArtifactHuntReason[],
  kind: string,
  value: string,
  detail: string,
): void {
  const key = `${kind}:${norm(value)}:${detail}`;
  if (into.some((row) => `${row.kind}:${norm(row.value)}:${row.detail}` === key)) {
    return;
  }
  into.push({ kind, value, detail });
}

function rankCandidate(row: ProjectArtifactCandidate): number {
  let score = 0;
  if (row.evidenceReasons.some((reason) => reason.kind === "exact_gmail_thread_anchor")) {
    score += 100;
  }
  if (
    row.evidenceReasons.some(
      (reason) =>
        reason.kind === "bounded_filename_identifier" ||
        reason.kind === "exact_cad_job_identifier",
    )
  ) {
    score += 80;
  }
  if (row.evidenceReasons.some((reason) => reason.kind === "bounded_subject_identifier")) {
    score += 40;
  }
  if (row.classification.class === "cad_render") score += 10;
  if (row.classification.class === "unknown") score -= 5;
  const sent = row.sentAt ? Date.parse(row.sentAt) : 0;
  if (Number.isFinite(sent) && sent > 0) score += Math.min(9, Math.floor(sent / 1e12));
  return score;
}

function sortCandidates(
  rows: ProjectArtifactCandidate[],
): ProjectArtifactCandidate[] {
  return [...rows].sort((left, right) => {
    const delta = rankCandidate(right) - rankCandidate(left);
    if (delta !== 0) return delta;
    const leftDate = left.sentAt ?? "";
    const rightDate = right.sentAt ?? "";
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);
    return left.candidateId.localeCompare(right.candidateId);
  });
}

function targetStrongIdentifiers(
  project: ArtifactHuntProject,
  storedMessages: readonly GmailIndexedMessage[],
  storedAttachments: readonly GmailAttachmentMeta[],
): string[] {
  return collectStrongIdentifierTokens([
    project.cadJobNumber,
    project.orderNumber,
    ...storedMessages.map((row) => row.subject),
    ...storedAttachments.map((row) => row.filename),
  ]);
}

function attributeCandidate(input: {
  project: ArtifactHuntProject;
  books: readonly ExistingProjectBook[];
  row: GmailAttachmentMeta;
  message: GmailIndexedMessage | null;
  seedHashes: readonly string[];
  targetIdentifiers: readonly string[];
}): ProjectArtifactCandidate {
  const filename = input.row.filename;
  const subject = input.message?.subject ?? null;
  const filenameHay = filename ?? "";
  const subjectHay = subject ?? "";
  const reasons: ArtifactHuntReason[] = [];
  const storedThread = Boolean(
    input.project.gmailThreadId &&
      input.row.threadId === input.project.gmailThreadId,
  );

  const filenameCads = extractCadJobIdentifiers(filenameHay).filter((cad) =>
    hasBoundedIdentifierToken(filenameHay, cad),
  );
  const filenameOrders = extractOrderIdentifiers(filenameHay).filter((order) =>
    hasBoundedIdentifierToken(filenameHay, order),
  );
  const subjectCads = extractCadJobIdentifiers(subjectHay).filter((cad) =>
    hasBoundedIdentifierToken(subjectHay, cad),
  );
  const subjectOrders = extractOrderIdentifiers(subjectHay).filter((order) =>
    hasBoundedIdentifierToken(subjectHay, order),
  );

  const filenameCatalog = catalogHits(filenameHay, input.books);
  const subjectCatalog = catalogHits(subjectHay, input.books);
  const targetFilenameHits = boundedHits(filenameHay, input.targetIdentifiers);
  const targetSubjectHits = boundedHits(subjectHay, input.targetIdentifiers);

  const strongFilename = uniqueTokens([
    ...[...filenameCads, ...filenameOrders].filter(
      (token) =>
        isStrongStructuredCadIdentifier(token) ||
        (isStrongStructuredIdentifier(token) &&
          !isGenericHexadecimalCadFragment(token)),
    ),
    ...filenameCatalog.map((row) => row.token),
    ...targetFilenameHits,
  ]);
  const ownerSets = [...filenameCatalog, ...subjectCatalog];
  const colliding = ownerSets.filter((row) => row.owners.length > 1);
  const foreignOwned = ownerSets.filter(
    (row) =>
      row.owners.length === 1 && row.owners[0] !== input.project.projectId,
  );
  const targetOwned = ownerSets.filter((row) =>
    row.owners.includes(input.project.projectId),
  );
  const catalogTokenKeys = new Set(ownerSets.map((row) => norm(row.token)));
  const unownedStrong = uniqueTokens(
    [...filenameCads, ...filenameOrders, ...subjectCads, ...subjectOrders].filter(
      (token) =>
        (isStrongStructuredCadIdentifier(token) ||
          isStrongStructuredIdentifier(token)) &&
        !catalogTokenKeys.has(norm(token)) &&
        identifierOwners(token, input.books).length === 0,
    ),
  );

  const threadOwnerIds = threadOwners(input.row.threadId, input.books);
  const personSupport =
    input.message != null &&
    threadTouchesPersonDiscoverySeed([input.message], input.seedHashes);

  const weakFilename = [...filenameCads, ...filenameOrders].filter((token) =>
    isWeakIdentifierSpecificity(classifyIdentifierSpecificity(token)),
  );
  const weakSubject = [...subjectCads, ...subjectOrders].filter((token) =>
    isWeakIdentifierSpecificity(classifyIdentifierSpecificity(token)),
  );

  if (storedThread) {
    pushReason(
      reasons,
      "exact_gmail_thread_anchor",
      input.row.threadId,
      "Indexed attachment belongs to this Project Book's stored Gmail thread. Thread ownership is provenance, not content interpretation.",
    );
  }
  for (const token of targetFilenameHits) {
    pushReason(
      reasons,
      "bounded_filename_identifier",
      token,
      "Filename contains an exact bounded strong Project identifier.",
    );
    const owners = identifierOwners(token, input.books);
    if (owners.length === 1 && owners[0] === input.project.projectId) {
    const cadHit =
      isStrongStructuredCadIdentifier(token) ||
      filenameCads.some((cad) => norm(cad) === norm(token));
      pushReason(
        reasons,
        cadHit ? "exact_cad_job_identifier" : "exact_order_identifier",
        token,
        "Strong identifier is uniquely owned by this Project Book.",
      );
    }
  }
  for (const token of targetSubjectHits) {
    pushReason(
      reasons,
      "bounded_subject_identifier",
      token,
      "Message subject contains an exact bounded strong Project identifier. Subject tokens do not lower identifier specificity.",
    );
  }
  for (const token of weakFilename) {
    pushReason(
      reasons,
      classifyIdentifierSpecificity(token) === "weak_numeric"
        ? "cad_identifier_weak_numeric"
        : "cad_identifier_weak_short_structured",
      token,
      "Weak identifier is supporting only and cannot independently attach an artifact.",
    );
  }
  for (const token of weakSubject) {
    pushReason(
      reasons,
      classifyIdentifierSpecificity(token) === "weak_numeric"
        ? "cad_identifier_weak_numeric"
        : "cad_identifier_weak_short_structured",
      token,
      "Weak identifier in the subject is supporting only and cannot independently attach an artifact.",
    );
  }
  if (personSupport) {
    pushReason(
      reasons,
      "person_identity_only",
      "canonical-person",
      "Canonical Person identity is supporting context only and does not assign the artifact to a Project Book.",
    );
  }

  let attribution: ArtifactHuntAttribution = "unrelated_rejected";
  let attachedProjectId: string | null = null;
  let spanningProjectIds: string[] = [];
  let possibleNewProject = false;
  let requiresFounderApproval = true;

  const hasTargetProjectEvidence =
    storedThread ||
    targetFilenameHits.length > 0 ||
    targetSubjectHits.length > 0 ||
    targetOwned.length > 0;

  if (colliding.length > 0) {
    attribution = "ambiguous_between_projects";
    attachedProjectId = null;
    spanningProjectIds = uniqueTokens(colliding.flatMap((row) => row.owners));
    for (const row of colliding) {
      pushReason(
        reasons,
        "spans_multiple_projects",
        row.token,
        "Strong identifier belongs to more than one Project Book. Ambiguous. Not attached.",
      );
    }
  } else if (foreignOwned.length > 0 && !storedThread && targetOwned.length === 0) {
    attribution = "unrelated_rejected";
    attachedProjectId = null;
    spanningProjectIds = uniqueTokens(foreignOwned.flatMap((row) => row.owners));
    pushReason(
      reasons,
      "foreign_item_id",
      foreignOwned[0]?.token ?? "",
      "Strong identifier is owned by a different Project Book. Not attached to the inspected project.",
    );
  } else if (hasTargetProjectEvidence && colliding.length === 0) {
    attribution = "exact_project";
    attachedProjectId = null;
    requiresFounderApproval = true;
  } else if (!hasTargetProjectEvidence && unownedStrong.length > 0 && personSupport) {
    attribution = "person_related_unassigned";
    possibleNewProject = true;
    pushReason(
      reasons,
      "possible_new_project",
      unownedStrong[0] ?? "",
      "Person-related artifact with a strong identifier not owned by the current catalog. Possible other Project. Founder approval required. Not created.",
    );
  } else if (!hasTargetProjectEvidence && personSupport) {
    attribution = "person_related_unassigned";
  } else {
    attribution = "unrelated_rejected";
  }

  if (threadOwnerIds.length > 1 && !storedThread) {
    attribution = "ambiguous_between_projects";
    attachedProjectId = null;
    spanningProjectIds = uniqueTokens([...spanningProjectIds, ...threadOwnerIds]);
    pushReason(
      reasons,
      "spans_multiple_projects",
      input.row.threadId,
      "Stored thread pointer is owned by more than one Project Book. Ambiguous. Not attached.",
    );
  }

  const classification = classifyArtifactMetadata({
    filename,
    mimeType: input.row.mimeType,
    strongFilenameIdentifiers: strongFilename,
  });

  let reviewState: ProjectArtifactCandidate["reviewState"] = "rejected";
  if (attribution === "exact_project") reviewState = "candidate";
  else if (attribution === "ambiguous_between_projects") reviewState = "needs_review";
  else if (attribution === "person_related_unassigned") reviewState = "unassigned";

  return {
    candidateId: candidateIdOf(input.row),
    projectId: input.project.projectId,
    source: {
      threadId: input.row.threadId,
      messageId: input.row.messageId,
      attachmentId: input.row.attachmentId,
      filename: input.row.filename,
      mimeType: input.row.mimeType,
      sizeBytes: input.row.sizeBytes,
      indexedAt: input.row.indexedAt,
    },
    filename: input.row.filename,
    mimeType: input.row.mimeType,
    sizeBytes: input.row.sizeBytes,
    sentAt: input.message?.sentAt ?? null,
    subject,
    direction: input.message?.direction ?? null,
    classification,
    attribution,
    attachedProjectId,
    spanningProjectIds,
    evidenceReasons: reasons,
    reviewState,
    requiresFounderReview: true,
    requiresFounderApproval,
    possibleNewProject,
    duplicateGroup: filename ? norm(filename) : null,
    revisionHint: filenameHasRevisionHint(filename),
    automaticAttach: false,
    canonical: false,
    opened: false,
    metadataOnly: true,
    bytesFetched: false,
  };
}

function mergeAttachments(
  groups: readonly GmailAttachmentMeta[][],
): GmailAttachmentMeta[] {
  const byId = new Map<string, GmailAttachmentMeta>();
  for (const group of groups) {
    for (const row of group) {
      byId.set(candidateIdOf(row), row);
    }
  }
  return [...byId.values()];
}

function duplicateGroupsOf(
  rows: readonly ProjectArtifactCandidate[],
): { filename: string; candidateIds: readonly string[] }[] {
  const byName = new Map<string, string[]>();
  for (const row of rows) {
    const name = (row.filename ?? "").trim();
    if (!name) continue;
    const key = norm(name);
    const existing = byName.get(key) ?? [];
    existing.push(row.candidateId);
    byName.set(key, existing);
  }
  return [...byName.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([filename, candidateIds]) => ({ filename, candidateIds }));
}

export async function executeProjectArtifactHunt(
  input: ArtifactHuntInput,
): Promise<ArtifactHuntState> {
  if (!input.founderSessionOk) {
    return failedArtifactHunt("unauthorized");
  }
  void input.requestedProjectId;
  void input.requestedThreadId;
  void input.requestedQuery;

  const projectId = input.projectId.trim();
  if (!projectId) return failedArtifactHunt("project-not-found");

  let project: ArtifactHuntProject | null;
  try {
    project = await input.catalog.getProject(projectId);
  } catch {
    return failedArtifactHunt("index-unavailable");
  }
  if (!project || project.projectId !== projectId) {
    return failedArtifactHunt("project-not-found");
  }

  const storedThreadId = project.gmailThreadId?.trim() ?? "";
  const queryShape: ArtifactHuntQueryShape = {
    storedThreadQueries: 0,
    filenameTokenQueries: 0,
    filenameTokenCount: 0,
    subjectTokenQueries: 0,
    personHashQueries: 0,
    threadHydrations: 0,
    scannedAttachmentCount: 0,
    fullTableScan: false,
  };

  let storedMessages: GmailIndexedMessage[] = [];
  let storedAttachments: GmailAttachmentMeta[] = [];
  try {
    if (storedThreadId) {
      storedMessages = (await input.index.listMessagesByThread(storedThreadId)).filter(
        (row) => !isDiscardedIndexedMessage(row),
      );
      queryShape.threadHydrations += 1;
      storedAttachments = await input.attachments.listByThread(storedThreadId);
      queryShape.storedThreadQueries += 1;
    }
  } catch {
    return failedArtifactHunt("index-unavailable");
  }

  const seedHashes = personDiscoverySeedHashes({
    canonicalPersonEmailHashes: [
      project.personEmailHash,
      ...(project.personEmailHashes ?? []),
    ].filter((value): value is string => Boolean(value)),
    internalEmailHashes: input.internalEmailHashes,
  });
  const targetIdentifiers = targetStrongIdentifiers(
    project,
    storedMessages,
    storedAttachments,
  ).slice(0, ARTIFACT_HUNT_FILENAME_TOKEN_LIMIT);

  let filenameHits: GmailAttachmentMeta[] = [];
  let subjectHits: GmailIndexedMessage[] = [];
  let personMessages: GmailIndexedMessage[] = [];
  try {
    if (targetIdentifiers.length > 0) {
      filenameHits = await input.attachments.listByFilenameTokens(targetIdentifiers);
      queryShape.filenameTokenQueries += 1;
      queryShape.filenameTokenCount = targetIdentifiers.length;
      subjectHits = await input.index.listMessagesMatchingSubjectTokens(
        targetIdentifiers,
      );
      queryShape.subjectTokenQueries += 1;
    }
    for (const hash of seedHashes) {
      const rows = await input.index.listMessagesTouchingEmailHash(hash);
      queryShape.personHashQueries += 1;
      personMessages.push(...rows.filter((row) => !isDiscardedIndexedMessage(row)));
    }
  } catch {
    return failedArtifactHunt("index-unavailable");
  }

  const personThreadIds = [
    ...new Set(
      personMessages
        .map((row) => row.threadId)
        .filter((threadId) => threadId && threadId !== storedThreadId),
    ),
  ].slice(0, ARTIFACT_HUNT_PERSON_THREAD_CAP);
  const subjectThreadIds = [
    ...new Set(
      subjectHits
        .filter((row) => !isDiscardedIndexedMessage(row))
        .map((row) => row.threadId)
        .filter(Boolean),
    ),
  ];
  const extraThreadIds = [
    ...new Set([...subjectThreadIds, ...personThreadIds, ...filenameHits.map((row) => row.threadId)]),
  ]
    .filter((threadId) => threadId && threadId !== storedThreadId)
    .slice(0, ARTIFACT_HUNT_THREAD_HYDRATE_CAP);

  let extraAttachments: GmailAttachmentMeta[] = [];
  let extraMessages = new Map<string, GmailIndexedMessage[]>();
  try {
    extraAttachments = await input.attachments.listByThreadIds(extraThreadIds);
    for (const threadId of extraThreadIds) {
      const rows = (await input.index.listMessagesByThread(threadId)).filter(
        (row) => !isDiscardedIndexedMessage(row),
      );
      queryShape.threadHydrations += 1;
      extraMessages.set(threadId, rows);
    }
  } catch {
    return failedArtifactHunt("index-unavailable");
  }

  const attachments = mergeAttachments([
    storedAttachments,
    filenameHits,
    extraAttachments,
  ]);
  queryShape.scannedAttachmentCount = attachments.length;

  const messagesById = new Map<string, GmailIndexedMessage>();
  for (const row of storedMessages) messagesById.set(row.messageId, row);
  for (const rows of extraMessages.values()) {
    for (const row of rows) messagesById.set(row.messageId, row);
  }
  for (const row of subjectHits) {
    if (!isDiscardedIndexedMessage(row)) messagesById.set(row.messageId, row);
  }
  for (const row of personMessages) messagesById.set(row.messageId, row);

  let books: readonly ExistingProjectBook[] = [];
  try {
    books = await input.catalog.listProjectBooks();
  } catch {
    return failedArtifactHunt("index-unavailable");
  }

  const attributed = attachments.map((row) =>
    attributeCandidate({
      project,
      books,
      row,
      message: messagesById.get(row.messageId) ?? null,
      seedHashes,
      targetIdentifiers,
    }),
  );

  const likely = sortCandidates(
    attributed.filter((row) => row.attribution === "exact_project"),
  ).slice(0, ARTIFACT_HUNT_EXACT_LIMIT);
  const ambiguous = sortCandidates(
    attributed.filter((row) => row.attribution === "ambiguous_between_projects"),
  ).slice(0, ARTIFACT_HUNT_AMBIGUOUS_LIMIT);
  const unassigned = sortCandidates(
    attributed.filter((row) => row.attribution === "person_related_unassigned"),
  ).slice(0, ARTIFACT_HUNT_UNASSIGNED_LIMIT);

  const presented = [...likely, ...ambiguous, ...unassigned];
  const historical =
    project.lifecycle === "historical_closed" || project.lifecycle === "unknown";

  return {
    ok: true,
    safeErrorCode: null,
    projectId: project.projectId,
    projectTitle: project.title,
    lifecycle: project.lifecycle,
    warning: ARTIFACT_HUNT_WARNING,
    likely,
    ambiguous,
    unassigned,
    exactLimit: ARTIFACT_HUNT_EXACT_LIMIT,
    ambiguousLimit: ARTIFACT_HUNT_AMBIGUOUS_LIMIT,
    unassignedLimit: ARTIFACT_HUNT_UNASSIGNED_LIMIT,
    resultsLimited:
      attributed.filter((row) => row.attribution === "exact_project").length >
        ARTIFACT_HUNT_EXACT_LIMIT ||
      attributed.filter((row) => row.attribution === "ambiguous_between_projects")
        .length > ARTIFACT_HUNT_AMBIGUOUS_LIMIT ||
      attributed.filter((row) => row.attribution === "person_related_unassigned")
        .length > ARTIFACT_HUNT_UNASSIGNED_LIMIT,
    duplicateGroups: duplicateGroupsOf(presented),
    queryShape,
    historicalSafety: {
      remainsHistorical: historical,
      createsOpenJobs: false,
      createsToday5: false,
      writesChiefOfStaff: false,
      becomesActive: false,
    },
    automaticAttach: false,
    canonical: false,
    fetchesGmail: false,
    fetchesAttachmentBytes: false,
    refreshesGmailToken: false,
    mutationBoundary: ARTIFACT_HUNT_MUTATION_BOUNDARY,
  };
}
