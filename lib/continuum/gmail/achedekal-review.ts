/**
 * Founder-only Achedekal evidence-review view model.
 * Exact stored thread only. Candidate evidence only. No Slice C.
 * Does not serialize the protected thread, tokens, or raw addresses.
 */

import type { ProjectHistory } from "@/lib/continuum/client-memory/types";
import {
  ACHEDEKAL_DISPLAY_NAME,
  ACHEDEKAL_LIFECYCLE_LABEL,
  ACHEDEKAL_PROJECT_ID,
  ACHEDEKAL_REVIEW_WARNING,
  isPermittedAchedekalProjectId,
} from "./achedekal-acceptance";
import type { ExactProjectThreadPointer } from "./exact-thread";
import {
  runExactProjectThreadFetch,
  type ExactProjectThreadFetchErrorCode,
  type ExactProjectThreadFetchInput,
  type ExactProjectThreadFetchResult,
} from "./exact-thread";
import type {
  ExactThreadCurrentSpecs,
  ExactThreadReconstructionHandoff,
  ProposedProjectSpecCorrection,
  ReconstructionEvidenceItem,
  ReconstructionEvidenceKind,
  ReconstructionEvidenceSource,
} from "./reconstruction-evidence";
import { fingerSizeLanguageIsAmbiguous } from "./size-ambiguity";

export const ACHEDEKAL_REVIEW_ERROR_CODES = [
  "unauthorized",
  "project-not-found",
  "blank-pointer",
  "invalid-pointer",
  "connection-unavailable",
  "token-refresh-failure",
  "gmail-thread-unavailable",
  "thread-fetch-failed",
] as const;

export type AchedekalReviewSafeErrorCode =
  (typeof ACHEDEKAL_REVIEW_ERROR_CODES)[number];

export const ACHEDEKAL_REVIEW_FAILURE_KEYS = ["ok", "safeErrorCode"] as const;

export type AchedekalReviewFailure = {
  ok: false;
  safeErrorCode: AchedekalReviewSafeErrorCode;
};

export type AchedekalCurrentSpecRow = {
  field: string;
  label: string;
  value: string;
};

export type AchedekalEvidenceOccurrence = {
  messageDate: string | null;
  sourceRole: string | null;
  direction: string | null;
};

export type AchedekalCandidateRow = {
  field: string;
  label: string;
  candidateValue: string;
  excerpt: string;
  messageDate: string | null;
  sourceRole: string | null;
  direction: string | null;
  status: "candidate" | "ambiguous";
  occurrenceCount: number;
  occurrences: AchedekalEvidenceOccurrence[];
};

export type AchedekalProposedCorrectionRow = {
  field: "finger_size";
  label: "Finger size";
  currentValue: string | null;
  candidateValue: string;
  requiresFounderApproval: true;
  automaticApply: false;
};

export type AchedekalAttachmentRow = {
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type AchedekalThreadSummary = {
  messageCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  attachmentCount: number;
};

export type AchedekalRingSizeStatus = "explicit" | "ambiguous" | "none";

export type AchedekalReviewSuccess = {
  ok: true;
  safeErrorCode: null;
  projectName: string;
  lifecycle: string;
  warning: typeof ACHEDEKAL_REVIEW_WARNING;
  currentSpecs: AchedekalCurrentSpecRow[];
  candidates: AchedekalCandidateRow[];
  proposedCorrections: AchedekalProposedCorrectionRow[];
  ambiguousSizeEvidence: AchedekalCandidateRow[];
  attachments: AchedekalAttachmentRow[];
  threadSummary: AchedekalThreadSummary;
  ringSizeStatus: AchedekalRingSizeStatus;
  automaticApply: false;
};

export type AchedekalReviewState = AchedekalReviewFailure | AchedekalReviewSuccess;

const CANDIDATE_KINDS: readonly ReconstructionEvidenceKind[] = [
  "finger_size",
  "order_number",
  "cad_job_number",
  "metal",
  "center_stone",
  "client_approval",
  "requested_revision",
  "vendor_response",
];

const FIELD_LABELS: Record<string, string> = {
  finger_size: "Finger size",
  order_number: "Order",
  cad_job_number: "CAD",
  metal: "Metal",
  center_stone: "Center stone",
  client_approval: "Client approval",
  requested_revision: "Requested revision",
  vendor_response: "Vendor response",
};

const SOURCE_ROLE: Record<ReconstructionEvidenceSource, string> = {
  "plain-text": "plain text",
  "header-subject": "subject",
  "mime-attachment": "attachment",
  "internal-date": "date",
};

const EXCERPT_MAX = 140;

function isReviewErrorCode(
  value: string | null,
): value is AchedekalReviewSafeErrorCode {
  return (
    typeof value === "string" &&
    (ACHEDEKAL_REVIEW_ERROR_CODES as readonly string[]).includes(value)
  );
}

export function failedAchedekalReview(
  code: AchedekalReviewSafeErrorCode,
): AchedekalReviewFailure {
  return { ok: false, safeErrorCode: code };
}

export function sanitizeAchedekalReviewFailure(
  raw: AchedekalReviewFailure,
): AchedekalReviewFailure {
  const code = isReviewErrorCode(raw.safeErrorCode)
    ? raw.safeErrorCode
    : "thread-fetch-failed";
  return { ok: false, safeErrorCode: code };
}

export function mapExactThreadErrorToAchedekalReview(
  code: ExactProjectThreadFetchErrorCode,
): AchedekalReviewSafeErrorCode {
  switch (code) {
    case "unauthorized":
      return "unauthorized";
    case "project-not-found":
      return "project-not-found";
    case "blank-pointer":
      return "blank-pointer";
    case "invalid-pointer":
      return "invalid-pointer";
    case "thread-fetch-failed":
      return "thread-fetch-failed";
    case "token-refresh-failed":
    case "refresh-token-rotated":
      return "token-refresh-failure";
    case "thread-not-found":
    case "thread-inaccessible":
      return "gmail-thread-unavailable";
    case "unavailable":
    case "gmail-not-connected":
    case "decrypt-failed":
    case "oauth-not-configured":
      return "connection-unavailable";
    default:
      return "thread-fetch-failed";
  }
}

export function pointerFromProjectHistory(
  history: ProjectHistory | null,
): ExactProjectThreadPointer | null {
  if (!history) return null;
  return {
    projectId: history.projectId,
    gmailThreadId: history.gmailThreadId,
    fingerSize: history.fingerSize,
    orderNumber: history.orderNumber,
    cadJobNumber: history.cadJobNumber,
    metal: history.metal,
    centerStone: history.centerStone,
  };
}

export function evidenceExcerpt(text: string, value: string | null): string {
  const redacted = text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  if (!redacted) return "";
  if (!value) {
    return redacted.length > EXCERPT_MAX
      ? `${redacted.slice(0, EXCERPT_MAX)}…`
      : redacted;
  }
  const idx = redacted.toLowerCase().indexOf(value.toLowerCase());
  if (idx < 0) {
    return redacted.length > EXCERPT_MAX
      ? `${redacted.slice(0, EXCERPT_MAX)}…`
      : redacted;
  }
  const start = Math.max(0, idx - 32);
  const slice = redacted.slice(start, start + EXCERPT_MAX);
  const prefix = start > 0 ? "…" : "";
  const suffix = start + EXCERPT_MAX < redacted.length ? "…" : "";
  return `${prefix}${slice}${suffix}`;
}

function messageHaystack(
  handoff: ExactThreadReconstructionHandoff,
  messageId: string | null,
): string {
  if (!messageId) return "";
  const message = handoff.thread.messages.find((row) => row.messageId === messageId);
  if (!message) return "";
  return [message.subject, message.plainText].filter(Boolean).join("\n");
}

function fingerSizeIsAmbiguousForValue(
  handoff: ExactThreadReconstructionHandoff,
  value: string,
): boolean {
  const supporting = handoff.candidateEvidence.filter(
    (item) => item.kind === "finger_size" && item.proposedValue,
  );
  const haystacks = supporting
    .filter((item) => {
      const raw = (item.proposedValue ?? "").trim();
      return raw === value || raw.replace(/\.0+$/, "") === value;
    })
    .map((item) => messageHaystack(handoff, item.messageId))
    .filter(Boolean);
  if (haystacks.length === 0) {
    return supporting.some((item) =>
      fingerSizeLanguageIsAmbiguous(messageHaystack(handoff, item.messageId), value),
    );
  }
  return haystacks.every((hay) => fingerSizeLanguageIsAmbiguous(hay, value));
}

export function applyFingerSizeAmbiguityGuard(
  handoff: ExactThreadReconstructionHandoff,
): ProposedProjectSpecCorrection[] {
  return handoff.proposedCorrections.filter((correction) => {
    if (correction.fieldName !== "finger_size") return false;
    return !fingerSizeIsAmbiguousForValue(handoff, correction.proposedValue);
  });
}

function currentSpecRows(specs: ExactThreadCurrentSpecs): AchedekalCurrentSpecRow[] {
  return [
    { field: "finger_size", label: "Finger size", value: specs.fingerSize ?? "—" },
    { field: "order_number", label: "Order", value: specs.orderNumber ?? "—" },
    { field: "cad_job_number", label: "CAD", value: specs.cadJobNumber ?? "—" },
    { field: "metal", label: "Metal", value: specs.metal ?? "—" },
    { field: "center_stone", label: "Center stone", value: specs.centerStone ?? "—" },
  ];
}

function sourceRoleOf(source: ReconstructionEvidenceSource): string | null {
  return SOURCE_ROLE[source] ?? null;
}

function candidateRow(
  handoff: ExactThreadReconstructionHandoff,
  item: ReconstructionEvidenceItem,
  status: "candidate" | "ambiguous",
): AchedekalCandidateRow | null {
  if (!item.proposedValue) return null;
  const occurrenceSources = item.occurrences?.length
    ? item.occurrences
    : [{ messageId: item.messageId, source: item.source }];
  const occurrences: AchedekalEvidenceOccurrence[] = occurrenceSources.map((row) => {
    const message = row.messageId
      ? handoff.thread.messages.find((entry) => entry.messageId === row.messageId)
      : undefined;
    return {
      messageDate: message?.internalDate ?? null,
      sourceRole: sourceRoleOf(row.source),
      direction: message?.direction ?? null,
    };
  });
  const message = item.messageId
    ? handoff.thread.messages.find((row) => row.messageId === item.messageId)
    : undefined;
  return {
    field: item.kind,
    label: FIELD_LABELS[item.kind] ?? item.kind,
    candidateValue: item.proposedValue,
    excerpt: evidenceExcerpt(messageHaystack(handoff, item.messageId), item.proposedValue),
    messageDate: message?.internalDate ?? occurrences[0]?.messageDate ?? null,
    sourceRole: sourceRoleOf(item.source),
    direction: message?.direction ?? occurrences[0]?.direction ?? null,
    status,
    occurrenceCount: Math.max(1, occurrences.length),
    occurrences,
  };
}

function ringSizeStatusOf(
  fingerItems: readonly ReconstructionEvidenceItem[],
  proposed: readonly ProposedProjectSpecCorrection[],
  ambiguous: readonly AchedekalCandidateRow[],
): AchedekalRingSizeStatus {
  if (fingerItems.length === 0) return "none";
  if (proposed.length > 0) return "explicit";
  if (ambiguous.length > 0) return "ambiguous";
  return "explicit";
}

export function presentAchedekalReview(
  handoff: ExactThreadReconstructionHandoff,
  presentation?: { projectName?: string; lifecycle?: string },
): AchedekalReviewSuccess {
  const proposed = applyFingerSizeAmbiguityGuard(handoff);
  const fingerItems = handoff.candidateEvidence.filter(
    (item) => item.kind === "finger_size" && item.proposedValue,
  );
  const candidates: AchedekalCandidateRow[] = [];
  const ambiguousSizeEvidence: AchedekalCandidateRow[] = [];

  for (const item of handoff.candidateEvidence) {
    if (!CANDIDATE_KINDS.includes(item.kind) || !item.proposedValue) continue;
    const ambiguous =
      item.kind === "finger_size" &&
      fingerSizeIsAmbiguousForValue(handoff, item.proposedValue);
    const row = candidateRow(handoff, item, ambiguous ? "ambiguous" : "candidate");
    if (!row) continue;
    if (ambiguous) ambiguousSizeEvidence.push(row);
    else candidates.push(row);
  }

  const dates = handoff.thread.messages
    .map((row) => row.internalDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  const attachments: AchedekalAttachmentRow[] = handoff.thread.messages.flatMap((message) =>
    message.attachments.map((attachment) => ({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    })),
  );

  return {
    ok: true,
    safeErrorCode: null,
    projectName: presentation?.projectName?.trim() || ACHEDEKAL_DISPLAY_NAME,
    lifecycle: presentation?.lifecycle?.trim() || ACHEDEKAL_LIFECYCLE_LABEL,
    warning: ACHEDEKAL_REVIEW_WARNING,
    currentSpecs: currentSpecRows(handoff.currentSpecs),
    candidates,
    proposedCorrections: proposed.map((row) => ({
      field: "finger_size",
      label: "Finger size",
      currentValue: row.currentValue,
      candidateValue: row.proposedValue,
      requiresFounderApproval: true,
      automaticApply: false,
    })),
    ambiguousSizeEvidence,
    attachments,
    threadSummary: {
      messageCount: handoff.thread.messages.length,
      earliestDate: dates[0] ?? null,
      latestDate: dates[dates.length - 1] ?? null,
      attachmentCount: attachments.length,
    },
    ringSizeStatus: ringSizeStatusOf(fingerItems, proposed, ambiguousSizeEvidence),
    automaticApply: false,
  };
}

export type AchedekalEvidenceReviewInput = ExactProjectThreadFetchInput & {
  requestedProjectId?: string | null;
  requestedThreadId?: string | null;
  requestedQuery?: string | null;
  projectName?: string;
  lifecycleLabel?: string;
};

export async function executeAchedekalEvidenceReview(
  input: AchedekalEvidenceReviewInput,
): Promise<AchedekalReviewState> {
  if (!input.founderSessionOk) {
    return failedAchedekalReview("unauthorized");
  }
  if (
    input.requestedProjectId != null &&
    input.requestedProjectId.trim() !== "" &&
    !isPermittedAchedekalProjectId(input.requestedProjectId)
  ) {
    return failedAchedekalReview("project-not-found");
  }

  // Caller-supplied thread id / Gmail query are ignored. Authority is
  // ACHEDEKAL_PROJECT_ID → stored project_history.gmail_thread_id.
  void input.requestedThreadId;
  void input.requestedQuery;

  const result = await runExactProjectThreadFetch({
    founderSessionOk: true,
    projectId: ACHEDEKAL_PROJECT_ID,
    projects: input.projects,
    connections: input.connections,
    decryptRefreshToken: input.decryptRefreshToken,
    refreshAccessToken: input.refreshAccessToken,
    createApi: input.createApi,
  });
  return presentExactThreadResult(result);
}

export async function executeProjectEvidenceReview(
  input: AchedekalEvidenceReviewInput,
): Promise<AchedekalReviewState> {
  if (!input.founderSessionOk) {
    return failedAchedekalReview("unauthorized");
  }
  const projectId = input.projectId.trim();
  if (!projectId) {
    return failedAchedekalReview("project-not-found");
  }
  if (
    input.requestedProjectId != null &&
    input.requestedProjectId.trim() !== "" &&
    input.requestedProjectId.trim() !== projectId
  ) {
    return failedAchedekalReview("project-not-found");
  }
  void input.requestedThreadId;
  void input.requestedQuery;

  const result = await runExactProjectThreadFetch({
    founderSessionOk: true,
    projectId,
    projects: input.projects,
    connections: input.connections,
    decryptRefreshToken: input.decryptRefreshToken,
    refreshAccessToken: input.refreshAccessToken,
    createApi: input.createApi,
  });
  return presentExactThreadResult(result, {
    projectName: input.projectName,
    lifecycle: input.lifecycleLabel ?? "Review only — commercial state unknown",
  });
}

export function presentExactThreadResult(
  result: ExactProjectThreadFetchResult,
  presentation?: { projectName?: string; lifecycle?: string },
): AchedekalReviewState {
  if (!result.ok) {
    return sanitizeAchedekalReviewFailure(
      failedAchedekalReview(mapExactThreadErrorToAchedekalReview(result.safeErrorCode)),
    );
  }
  return presentAchedekalReview(result.reconstruction, presentation);
}
