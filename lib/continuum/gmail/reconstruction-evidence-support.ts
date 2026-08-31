/**
 * Generic stored-field evidence support assessment.
 * Compares CURRENT STORED VALUE against already-recovered Project-scoped
 * indexed metadata. Candidate-only. Does not write canonical records.
 * Does not fetch Gmail bodies, attachment bytes, or refresh tokens.
 * automaticApply: false.
 */

import {
  extractCadJobIdentifiers,
  hasBoundedIdentifierToken,
  isStrongStructuredCadIdentifier,
} from "./cad-job-identifier";
import {
  classifyIdentifierSpecificity,
  compactIdentifierToken,
  identifierTokensMatch,
  isStrongStructuredIdentifier,
  isWeakIdentifierSpecificity,
} from "./identifier-specificity";
import {
  extractOrderIdentifiers,
  extractStructuredOrderCandidates,
  isPlausibleOrderIdentifier,
  isStrongStructuredOrderIdentifier,
  orderIdentifierFamilyPrefix,
} from "./order-identifier";
import type { ReconstructedItemType } from "./project-reconstruction";

export const STORED_FIELD_EVIDENCE_STATES = [
  "supported",
  "partially_supported",
  "conflicting",
  "unsupported",
  "not_assessed",
] as const;

export type StoredFieldEvidenceState =
  (typeof STORED_FIELD_EVIDENCE_STATES)[number];

export type RecoveredMetadataSourceType =
  | "exact_stored_thread_subject"
  | "candidate_thread_subject"
  | "project_attributed_artifact_filename"
  | "project_attributed_artifact_subject";

export type RecoveredIdentifierProvenance = {
  sourceType: RecoveredMetadataSourceType;
  identifier: string;
  reason: string;
  threadId: string | null;
  messageId: string | null;
  filename: string | null;
};

export type RecoveredProjectMetadataSnippet = {
  sourceType: RecoveredMetadataSourceType;
  text: string;
  projectId: string;
  threadId: string | null;
  messageId: string | null;
  filename: string | null;
};

export type ProjectScopedRecoveredInput = {
  targetProjectId: string;
  storedThreadSubjects?: readonly {
    threadId: string;
    messageId?: string | null;
    subject: string | null;
  }[];
  candidateThreadSubjects?: readonly {
    threadId: string;
    subject: string | null;
    attributedProjectId: string;
  }[];
  artifactMetadata?: readonly {
    filename: string | null;
    subject: string | null;
    threadId?: string | null;
    messageId?: string | null;
    attributedProjectId: string | null;
    spanningProjectIds?: readonly string[];
  }[];
};

export type StoredFieldEvidenceAssessment = {
  field: "order_number" | "finger_size";
  storedValue: string;
  storedIdentifiers: readonly string[];
  supportedStoredIdentifiers: readonly string[];
  additionalRecoveredIdentifiers: readonly string[];
  supportingEvidence: readonly RecoveredIdentifierProvenance[];
  conflictingEvidence: readonly RecoveredIdentifierProvenance[];
  state: StoredFieldEvidenceState;
  reviewState: "review_only";
  confidence: "corroborated" | "partial" | "unresolved" | "conflict";
  provenance: readonly RecoveredIdentifierProvenance[];
  canonical: false;
  automaticApply: false;
  supportedDoesNotMeanCanonical: true;
  reviewNote: string;
};

const EXPLICIT_FINGER_SIZE = new RegExp(
  String.raw`\b(?:ring|finger)\s+size\s*(?:is|=|:)?\s*((?:[1-9]|[12]\d|30)(?:\.(?:0|00|25|5|50|75))?)\b`,
  "gi",
);

function uniqueTokens(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const token = compactIdentifierToken(raw);
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}

function isSuspiciousStoredFingerSize(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  if (/^\d{3,}$/.test(raw)) return true;
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return n < 1 || n > 20;
  }
  return false;
}

function isStrongCommercialIdentifier(value: string): boolean {
  const token = compactIdentifierToken(value);
  if (!token || /\s/.test(token)) return false;
  if (!isPlausibleOrderIdentifier(token) && !isStrongStructuredCadIdentifier(token)) {
    return false;
  }
  if (isWeakIdentifierSpecificity(classifyIdentifierSpecificity(token))) {
    return false;
  }
  return isStrongStructuredIdentifier(token);
}

export function extractStoredOrderIdentifiers(storedOrder: string): string[] {
  const raw = storedOrder.trim();
  if (!raw) return [];
  const found: string[] = [];
  if (isStrongCommercialIdentifier(raw) && isStrongStructuredOrderIdentifier(raw)) {
    found.push(compactIdentifierToken(raw));
  }
  for (const order of extractOrderIdentifiers(raw)) {
    if (isStrongStructuredOrderIdentifier(order)) found.push(order);
  }
  for (const token of extractCadJobIdentifiers(raw)) {
    if (isStrongStructuredOrderIdentifier(token) || isStrongCommercialIdentifier(token)) {
      found.push(token);
    }
  }
  for (const part of raw.split(/[/,;|]+/)) {
    const token = compactIdentifierToken(part);
    if (isStrongStructuredOrderIdentifier(token)) found.push(token);
  }
  return uniqueTokens(found).filter(
    (token) =>
      isStrongStructuredOrderIdentifier(token) || isStrongCommercialIdentifier(token),
  );
}

export function extractStoredCadIdentifiers(storedCad: string): string[] {
  const raw = storedCad.trim();
  if (!raw) return [];
  const found: string[] = [];
  for (const cad of extractCadJobIdentifiers(raw)) {
    if (isStrongStructuredCadIdentifier(cad) || isStrongStructuredIdentifier(cad)) {
      found.push(cad);
    }
  }
  if (isStrongStructuredCadIdentifier(raw) || isStrongStructuredIdentifier(raw)) {
    found.push(compactIdentifierToken(raw));
  }
  return uniqueTokens(found);
}

export function extractRecoveredOrderIdentifiers(
  text: string,
  storedOrderIdentifiers: readonly string[] = [],
): string[] {
  if (!text.trim()) return [];
  const found: string[] = [];
  for (const order of extractOrderIdentifiers(text)) {
    if (isStrongStructuredOrderIdentifier(order)) found.push(order);
  }
  const storedFamilies = new Set(
    storedOrderIdentifiers
      .map(orderIdentifierFamilyPrefix)
      .filter((prefix) => prefix.length > 0),
  );
  if (storedFamilies.size > 0) {
    for (const token of extractStructuredOrderCandidates(text)) {
      if (!storedFamilies.has(orderIdentifierFamilyPrefix(token))) continue;
      found.push(token);
    }
  }
  return uniqueTokens(found);
}

function snippetAuthorizedForTarget(
  snippet: RecoveredProjectMetadataSnippet,
  storedCad: readonly string[],
): boolean {
  if (snippet.sourceType === "exact_stored_thread_subject") return true;
  if (
    snippet.sourceType === "project_attributed_artifact_filename" ||
    snippet.sourceType === "project_attributed_artifact_subject"
  ) {
    return true;
  }
  if (snippet.sourceType !== "candidate_thread_subject") return false;
  if (storedCad.length === 0) return false;
  return storedCad.some((cad) => hasBoundedIdentifierToken(snippet.text, cad));
}

function tokenInSet(token: string, set: readonly string[]): boolean {
  return set.some((row) => identifierTokensMatch(row, token));
}

function provenanceKey(row: RecoveredIdentifierProvenance): string {
  const location = (row.filename ?? row.threadId ?? row.messageId ?? "").toLowerCase();
  return `${row.sourceType}:${location}:${row.identifier.toLowerCase()}`;
}

function dedupeProvenance(
  rows: readonly RecoveredIdentifierProvenance[],
): RecoveredIdentifierProvenance[] {
  const seen = new Set<string>();
  const out: RecoveredIdentifierProvenance[] = [];
  for (const row of rows) {
    const key = provenanceKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function reasonFor(
  sourceType: RecoveredMetadataSourceType,
  identifier: string,
): string {
  if (sourceType === "exact_stored_thread_subject") {
    return `Exact Project-related thread subject contains ${identifier}.`;
  }
  if (sourceType === "candidate_thread_subject") {
    return `Project-related candidate thread subject contains ${identifier}.`;
  }
  if (sourceType === "project_attributed_artifact_filename") {
    return `Project-attributed artifact filename contains ${identifier}.`;
  }
  return `Project-attributed artifact subject contains ${identifier}.`;
}

function snippetOf(input: {
  sourceType: RecoveredMetadataSourceType;
  text: string;
  projectId: string;
  threadId?: string | null;
  messageId?: string | null;
  filename?: string | null;
}): RecoveredProjectMetadataSnippet | null {
  const text = input.text.trim();
  if (!text) return null;
  return {
    sourceType: input.sourceType,
    text,
    projectId: input.projectId.trim(),
    threadId: input.threadId ?? null,
    messageId: input.messageId ?? null,
    filename: input.filename ?? null,
  };
}

function artifactAttributedToTarget(
  targetProjectId: string,
  row: {
    attributedProjectId: string | null;
    spanningProjectIds?: readonly string[];
  },
): boolean {
  const target = targetProjectId.trim();
  if (!target) return false;
  const spanning = row.spanningProjectIds ?? [];
  if (spanning.some((id) => id.trim() && id.trim() !== target)) return false;
  const attributed = row.attributedProjectId?.trim() ?? "";
  if (!attributed) return false;
  return attributed === target;
}

export function collectProjectScopedRecoveredSnippets(
  input: ProjectScopedRecoveredInput,
): RecoveredProjectMetadataSnippet[] {
  const target = input.targetProjectId.trim();
  const snippets: RecoveredProjectMetadataSnippet[] = [];
  const seen = new Set<string>();
  const push = (row: RecoveredProjectMetadataSnippet | null) => {
    if (!row || row.projectId !== target) return;
    const key = `${row.sourceType}:${row.threadId ?? ""}:${row.messageId ?? ""}:${row.filename ?? ""}:${row.text}`;
    if (seen.has(key)) return;
    seen.add(key);
    snippets.push(row);
  };

  for (const row of input.storedThreadSubjects ?? []) {
    push(
      snippetOf({
        sourceType: "exact_stored_thread_subject",
        text: row.subject ?? "",
        projectId: target,
        threadId: row.threadId,
        messageId: row.messageId ?? null,
      }),
    );
  }

  for (const row of input.candidateThreadSubjects ?? []) {
    if (row.attributedProjectId.trim() !== target) continue;
    push(
      snippetOf({
        sourceType: "candidate_thread_subject",
        text: row.subject ?? "",
        projectId: target,
        threadId: row.threadId,
      }),
    );
  }

  for (const row of input.artifactMetadata ?? []) {
    if (!artifactAttributedToTarget(target, row)) continue;
    push(
      snippetOf({
        sourceType: "project_attributed_artifact_filename",
        text: row.filename ?? "",
        projectId: target,
        threadId: row.threadId ?? null,
        messageId: row.messageId ?? null,
        filename: row.filename ?? null,
      }),
    );
    push(
      snippetOf({
        sourceType: "project_attributed_artifact_subject",
        text: row.subject ?? "",
        projectId: target,
        threadId: row.threadId ?? null,
        messageId: row.messageId ?? null,
        filename: row.filename ?? null,
      }),
    );
  }

  return snippets;
}

function summarizeSupportReasons(
  rows: readonly RecoveredIdentifierProvenance[],
  identifier: string,
): string {
  const types = new Set(rows.map((row) => row.sourceType));
  const hasExact = types.has("exact_stored_thread_subject");
  const hasCandidate = types.has("candidate_thread_subject");
  const hasFilename = types.has("project_attributed_artifact_filename");
  const hasArtifactSubject = types.has("project_attributed_artifact_subject");
  const artifact = hasFilename || hasArtifactSubject;
  if (hasExact && artifact) {
    return `Exact Project-related thread subject and Project-attributed artifact metadata contain ${identifier}.`;
  }
  if (hasCandidate && artifact) {
    return `Project-related candidate thread subject and Project-attributed artifact metadata contain ${identifier}.`;
  }
  if (hasExact) return `Exact Project-related thread subject contains ${identifier}.`;
  if (hasCandidate) {
    return `Project-related candidate thread subject contains ${identifier}.`;
  }
  if (artifact) {
    return `Project-attributed artifact metadata contains ${identifier}.`;
  }
  return rows[0]?.reason ?? `Recovered Project-scoped metadata contains ${identifier}.`;
}

function orderReviewNote(input: {
  state: StoredFieldEvidenceState;
  storedIdentifiers: readonly string[];
  supportedStoredIdentifiers: readonly string[];
  additionalRecoveredIdentifiers: readonly string[];
  supportingEvidence: readonly RecoveredIdentifierProvenance[];
}): string {
  const epistemic =
    "Support is corroboration only — not canonical, not corrected, and not commercially final.";
  if (input.state === "supported") {
    const parts = input.supportedStoredIdentifiers.map((id) =>
      summarizeSupportReasons(
        input.supportingEvidence.filter((row) =>
          identifierTokensMatch(row.identifier, id),
        ),
        id,
      ),
    );
    return [`Supported by recovered indexed evidence.`, ...parts, epistemic].join(" ");
  }
  if (input.state === "partially_supported") {
    return [
      "Partially supported by recovered indexed evidence.",
      `Supported stored identifiers: ${input.supportedStoredIdentifiers.join(", ")}.`,
      `Stored order identifiers: ${input.storedIdentifiers.join(", ")}.`,
      epistemic,
    ].join(" ");
  }
  if (input.state === "conflicting") {
    return [
      "Conflicting / multiple Project-scoped order identifiers require review.",
      `Stored order identifiers: ${input.storedIdentifiers.join(", ") || "none"}.`,
      `Supported stored identifiers: ${input.supportedStoredIdentifiers.join(", ") || "none"}.`,
      `Additional recovered order identifier: ${input.additionalRecoveredIdentifiers.join(", ") || "none"}.`,
      "Other structured Project references in recovered metadata are not interpreted as order identifiers.",
      "No automatic correction. Founder review is required to interpret revision, reorder, quote, or vendor context.",
      epistemic,
    ].join(" ");
  }
  return "Not independently supported by recovered evidence.";
}

export function assessStoredOrderEvidence(input: {
  targetProjectId: string;
  storedOrder: string | null | undefined;
  storedCad?: string | null;
  recovered: readonly RecoveredProjectMetadataSnippet[];
}): StoredFieldEvidenceAssessment | null {
  const storedValue = input.storedOrder?.trim() ?? "";
  if (!storedValue) return null;

  const storedIdentifiers = extractStoredOrderIdentifiers(storedValue);
  const storedCad = extractStoredCadIdentifiers(input.storedCad ?? "");
  const target = input.targetProjectId.trim();
  const supporting: RecoveredIdentifierProvenance[] = [];
  const conflicting: RecoveredIdentifierProvenance[] = [];
  const additional: string[] = [];

  for (const snippet of input.recovered) {
    if (snippet.projectId.trim() !== target) continue;
    if (!snippetAuthorizedForTarget(snippet, storedCad)) continue;
    for (const storedId of storedIdentifiers) {
      if (!hasBoundedIdentifierToken(snippet.text, storedId)) continue;
      supporting.push({
        sourceType: snippet.sourceType,
        identifier: storedId,
        reason: reasonFor(snippet.sourceType, storedId),
        threadId: snippet.threadId,
        messageId: snippet.messageId,
        filename: snippet.filename,
      });
    }
    for (const recoveredId of extractRecoveredOrderIdentifiers(
      snippet.text,
      storedIdentifiers,
    )) {
      if (tokenInSet(recoveredId, storedIdentifiers)) continue;
      if (tokenInSet(recoveredId, storedCad)) continue;
      if (!tokenInSet(recoveredId, additional)) additional.push(recoveredId);
      conflicting.push({
        sourceType: snippet.sourceType,
        identifier: recoveredId,
        reason: reasonFor(snippet.sourceType, recoveredId),
        threadId: snippet.threadId,
        messageId: snippet.messageId,
        filename: snippet.filename,
      });
    }
  }

  const supportingEvidence = dedupeProvenance(supporting);
  const conflictingEvidence = dedupeProvenance(conflicting);
  const supportedStoredIdentifiers = storedIdentifiers.filter((id) =>
    supportingEvidence.some((row) => identifierTokensMatch(row.identifier, id)),
  );
  const additionalRecoveredIdentifiers = uniqueTokens(additional);

  let state: StoredFieldEvidenceState = "unsupported";
  let confidence: StoredFieldEvidenceAssessment["confidence"] = "unresolved";
  if (storedIdentifiers.length === 0) {
    state = "unsupported";
  } else if (
    additionalRecoveredIdentifiers.length > 0 &&
    (supportedStoredIdentifiers.length > 0 || storedIdentifiers.length > 1)
  ) {
    state = "conflicting";
    confidence = "conflict";
  } else if (
    additionalRecoveredIdentifiers.length > 0 &&
    supportedStoredIdentifiers.length === 0
  ) {
    state = "conflicting";
    confidence = "conflict";
  } else if (
    supportedStoredIdentifiers.length === storedIdentifiers.length &&
    additionalRecoveredIdentifiers.length === 0
  ) {
    state = "supported";
    confidence = "corroborated";
  } else if (supportedStoredIdentifiers.length > 0) {
    state = "partially_supported";
    confidence = "partial";
  }

  return {
    field: "order_number",
    storedValue,
    storedIdentifiers,
    supportedStoredIdentifiers,
    additionalRecoveredIdentifiers,
    supportingEvidence,
    conflictingEvidence,
    state,
    reviewState: "review_only",
    confidence,
    provenance: dedupeProvenance([...supportingEvidence, ...conflictingEvidence]),
    canonical: false,
    automaticApply: false,
    supportedDoesNotMeanCanonical: true,
    reviewNote: orderReviewNote({
      state,
      storedIdentifiers,
      supportedStoredIdentifiers,
      additionalRecoveredIdentifiers,
      supportingEvidence,
    }),
  };
}

function explicitFingerSizeHits(text: string): string[] {
  const found: string[] = [];
  EXPLICIT_FINGER_SIZE.lastIndex = 0;
  for (const match of text.matchAll(EXPLICIT_FINGER_SIZE)) {
    const value = match[1]?.trim();
    if (value) found.push(value);
  }
  return found;
}

function normalizeFingerSize(value: string): string {
  return value.replace(/^~/, "").trim();
}

export function assessStoredFingerSizeEvidence(input: {
  targetProjectId: string;
  storedFingerSize: string | null | undefined;
  itemTypeCandidate: ReconstructedItemType;
  recovered: readonly RecoveredProjectMetadataSnippet[];
}): StoredFieldEvidenceAssessment | null {
  const storedValue = input.storedFingerSize?.trim() ?? "";
  if (!storedValue) return null;
  const target = input.targetProjectId.trim();
  const braceletConflict = input.itemTypeCandidate === "bracelet";
  const explicitHits: RecoveredIdentifierProvenance[] = [];

  for (const snippet of input.recovered) {
    if (snippet.projectId.trim() !== target) continue;
    for (const hit of explicitFingerSizeHits(snippet.text)) {
      if (normalizeFingerSize(hit) !== normalizeFingerSize(storedValue)) continue;
      explicitHits.push({
        sourceType: snippet.sourceType,
        identifier: hit,
        reason: reasonFor(snippet.sourceType, hit),
        threadId: snippet.threadId,
        messageId: snippet.messageId,
        filename: snippet.filename,
      });
    }
  }

  const supportingEvidence = dedupeProvenance(explicitHits);
  const independentlySupported = supportingEvidence.length > 0 && !braceletConflict;

  let reviewNote = "Not independently supported by recovered evidence.";
  if (braceletConflict) {
    reviewNote = "Not supported by recovered evidence for this bracelet project.";
  } else if (independentlySupported) {
    reviewNote =
      "Supported by recovered indexed evidence with explicit finger-size wording. Support is corroboration only — not canonical.";
  } else if (isSuspiciousStoredFingerSize(storedValue)) {
    reviewNote =
      "Suspicious stored value — not independently supported by recovered evidence.";
  } else {
    reviewNote =
      "Plausible stored value but not independently supported by recovered indexed evidence.";
  }

  return {
    field: "finger_size",
    storedValue,
    storedIdentifiers: [],
    supportedStoredIdentifiers: independentlySupported ? [storedValue] : [],
    additionalRecoveredIdentifiers: [],
    supportingEvidence: independentlySupported ? supportingEvidence : [],
    conflictingEvidence: [],
    state: independentlySupported ? "supported" : "unsupported",
    reviewState: "review_only",
    confidence: independentlySupported ? "corroborated" : "unresolved",
    provenance: independentlySupported ? supportingEvidence : [],
    canonical: false,
    automaticApply: false,
    supportedDoesNotMeanCanonical: true,
    reviewNote,
  };
}
