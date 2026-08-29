/**
 * Exact-thread reconstruction evidence contract.
 * Surfaces candidate evidence for a later Project Book Reconstruction
 * layer. Does not decide canonical truth. Does not apply Slice C.
 * Does not infer finger size from order/CAD adjacency.
 */

import { validateProjectSpecCorrection } from "@/lib/continuum/client-memory/project-spec/validate";
import {
  extractCadJobIdentifiers,
  isStrongStructuredCadIdentifier,
  supportingKnownCadIdentifiers,
} from "./cad-job-identifier";
import { extractOrderIdentifiers } from "./order-identifier";
import type { ProtectedExactThread, ProtectedExactThreadMessage } from "./exact-thread-payload";

export const RECONSTRUCTION_EVIDENCE_KINDS = [
  "finger_size",
  "order_number",
  "cad_job_number",
  "metal",
  "center_stone",
  "client_approval",
  "requested_revision",
  "vendor_response",
  "timing",
  "attachment_inventory",
] as const;

export type ReconstructionEvidenceKind =
  (typeof RECONSTRUCTION_EVIDENCE_KINDS)[number];

export type ReconstructionEvidenceSource =
  | "plain-text"
  | "header-subject"
  | "mime-attachment"
  | "internal-date";

export type ReconstructionEvidenceOccurrence = {
  messageId: string | null;
  source: ReconstructionEvidenceSource;
};

export type ReconstructionEvidenceItem = {
  kind: ReconstructionEvidenceKind;
  messageId: string | null;
  proposedValue: string | null;
  explicit: boolean;
  source: ReconstructionEvidenceSource;
  occurrences?: readonly ReconstructionEvidenceOccurrence[];
};

export type ExactThreadCurrentSpecs = {
  fingerSize: string | null;
  orderNumber: string | null;
  cadJobNumber: string | null;
  metal: string | null;
  centerStone: string | null;
};

export type ProposedProjectSpecCorrection = {
  fieldName: "finger_size";
  currentValue: string | null;
  proposedValue: string;
  automaticApply: false;
  requiresFounderApproval: true;
};

export type ExactThreadReconstructionHandoff = {
  projectId: string;
  currentSpecs: ExactThreadCurrentSpecs;
  thread: ProtectedExactThread;
  candidateEvidence: ReconstructionEvidenceItem[];
  proposedCorrections: ProposedProjectSpecCorrection[];
};

type TextHaystack = {
  text: string;
  source: Exclude<ReconstructionEvidenceSource, "mime-attachment" | "internal-date">;
};

const FINGER_SIZE_TOKEN = "(?:[1-9]|[12]\\d|30)(?:\\.(?:0|00|25|5|50|75))?";
const FINGER_SIZE_EVIDENCE = new RegExp(
  `\\b(?:ring|finger)\\s+size\\s*(?:is|=|:)?\\s*(${FINGER_SIZE_TOKEN})\\b`,
  "gi",
);
const METAL_EVIDENCE =
  /\b(platinum|palladium|18k\s+white\s+gold|18k\s+yellow\s+gold|18k\s+rose\s+gold|14k\s+white\s+gold|14k\s+yellow\s+gold|14k\s+rose\s+gold|white\s+gold|yellow\s+gold|rose\s+gold)\b/gi;
const CENTER_STONE_EVIDENCE =
  /\b(?:center|centre)\s+stone\s*(?:is|=|:)?\s*([^\n.]{2,80})/gi;
const CLIENT_APPROVAL_EVIDENCE =
  /\b(approved|looks great|please proceed|we(?:'| a)re good)\b/gi;
const REQUESTED_REVISION_EVIDENCE =
  /\b(please (?:change|revise|update)|can we (?:change|make|revise)|revision requested)\b/gi;
const VENDOR_RESPONSE_EVIDENCE =
  /\b(we can (?:do|make)|completed at the bench|from the workshop)\b/gi;

function haystacksOf(message: ProtectedExactThreadMessage): TextHaystack[] {
  const haystacks: TextHaystack[] = [];
  if (message.subject?.trim()) {
    haystacks.push({ text: message.subject, source: "header-subject" });
  }
  if (message.plainText?.trim()) {
    haystacks.push({ text: message.plainText, source: "plain-text" });
  }
  return haystacks;
}

function collectMatches(
  haystack: TextHaystack,
  kind: ReconstructionEvidenceKind,
  pattern: RegExp,
  messageId: string,
  into: ReconstructionEvidenceItem[],
): void {
  pattern.lastIndex = 0;
  for (const match of haystack.text.matchAll(pattern)) {
    const proposedValue = match[1]?.trim() ?? match[0]?.trim() ?? null;
    if (!proposedValue) continue;
    into.push({
      kind,
      messageId,
      proposedValue,
      explicit: true,
      source: haystack.source,
    });
  }
}

function collectCadIdentifiers(
  text: string,
  knownCadIdentifiers: readonly string[],
): string[] {
  const found = extractCadJobIdentifiers(text);
  for (const known of supportingKnownCadIdentifiers(text, knownCadIdentifiers)) {
    if (!found.some((row) => row.toLowerCase() === known.toLowerCase())) {
      found.push(known);
    }
  }
  return found;
}

function collectMessageEvidence(
  message: ProtectedExactThreadMessage,
  knownCadIdentifiers: readonly string[] = [],
): ReconstructionEvidenceItem[] {
  const items: ReconstructionEvidenceItem[] = [];
  if (message.internalDate) {
    items.push({
      kind: "timing",
      messageId: message.messageId,
      proposedValue: message.internalDate,
      explicit: true,
      source: "internal-date",
    });
  }
  for (const attachment of message.attachments) {
    items.push({
      kind: "attachment_inventory",
      messageId: message.messageId,
      proposedValue: attachment.filename,
      explicit: Boolean(attachment.attachmentId),
      source: "mime-attachment",
    });
  }
  for (const haystack of haystacksOf(message)) {
    collectMatches(haystack, "finger_size", FINGER_SIZE_EVIDENCE, message.messageId, items);
    for (const order of extractOrderIdentifiers(haystack.text)) {
      items.push({
        kind: "order_number",
        messageId: message.messageId,
        proposedValue: order,
        explicit: true,
        source: haystack.source,
      });
    }
    for (const cadId of collectCadIdentifiers(haystack.text, knownCadIdentifiers)) {
      items.push({
        kind: "cad_job_number",
        messageId: message.messageId,
        proposedValue: cadId,
        explicit: true,
        source: haystack.source,
      });
    }
    collectMatches(haystack, "metal", METAL_EVIDENCE, message.messageId, items);
    collectMatches(haystack, "center_stone", CENTER_STONE_EVIDENCE, message.messageId, items);
    collectMatches(haystack, "client_approval", CLIENT_APPROVAL_EVIDENCE, message.messageId, items);
    collectMatches(haystack, "requested_revision", REQUESTED_REVISION_EVIDENCE, message.messageId, items);
    collectMatches(haystack, "vendor_response", VENDOR_RESPONSE_EVIDENCE, message.messageId, items);
  }
  return items;
}

function uniqueExplicitValues(
  items: readonly ReconstructionEvidenceItem[],
  kind: ReconstructionEvidenceKind,
): string[] {
  return [
    ...new Set(
      items
        .filter((item) => item.kind === kind && item.explicit && item.proposedValue)
        .map((item) => item.proposedValue as string),
    ),
  ];
}

export function proposedFingerSizeCorrection(
  currentFingerSize: string | null,
  evidence: readonly ReconstructionEvidenceItem[],
): ProposedProjectSpecCorrection | null {
  const values = uniqueExplicitValues(evidence, "finger_size");
  if (values.length !== 1) return null;
  const proposedValue = values[0]!;
  const validated = validateProjectSpecCorrection("finger_size", proposedValue);
  if (!validated.ok) return null;
  if (validated.value === (currentFingerSize ?? "").trim()) return null;
  return {
    fieldName: "finger_size",
    currentValue: currentFingerSize,
    proposedValue: validated.value,
    automaticApply: false,
    requiresFounderApproval: true,
  };
}

export function knownStructuredCadIdentifiersFromSpecs(
  specs: ExactThreadCurrentSpecs,
): string[] {
  const raw = specs.cadJobNumber?.trim();
  if (!raw) return [];
  return extractCadJobIdentifiers(raw).filter(isStrongStructuredCadIdentifier);
}

export function groupCadJobEvidence(
  items: readonly ReconstructionEvidenceItem[],
): ReconstructionEvidenceItem[] {
  const grouped: ReconstructionEvidenceItem[] = [];
  const cadIndex = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "cad_job_number" || !item.proposedValue) {
      grouped.push(item);
      continue;
    }
    const key = item.proposedValue.toLowerCase();
    const occurrence: ReconstructionEvidenceOccurrence = {
      messageId: item.messageId,
      source: item.source,
    };
    const existingAt = cadIndex.get(key);
    if (existingAt == null) {
      cadIndex.set(key, grouped.length);
      grouped.push({
        ...item,
        occurrences: item.occurrences ?? [occurrence],
      });
      continue;
    }
    const existing = grouped[existingAt]!;
    const next = [...(existing.occurrences ?? [])];
    const already = next.some(
      (row) => row.messageId === occurrence.messageId && row.source === occurrence.source,
    );
    if (!already) next.push(occurrence);
    grouped[existingAt] = { ...existing, occurrences: next };
  }
  return grouped;
}

export function collectExactThreadEvidence(
  thread: ProtectedExactThread,
  knownCadIdentifiers: readonly string[] = [],
): ReconstructionEvidenceItem[] {
  return groupCadJobEvidence(
    thread.messages.flatMap((message) =>
      collectMessageEvidence(message, knownCadIdentifiers),
    ),
  );
}

export function buildExactThreadReconstructionHandoff(input: {
  projectId: string;
  currentSpecs: ExactThreadCurrentSpecs;
  thread: ProtectedExactThread;
}): ExactThreadReconstructionHandoff {
  const knownCad = knownStructuredCadIdentifiersFromSpecs(input.currentSpecs);
  const candidateEvidence = collectExactThreadEvidence(input.thread, knownCad);
  const fingerSize = proposedFingerSizeCorrection(
    input.currentSpecs.fingerSize,
    candidateEvidence,
  );
  return {
    projectId: input.projectId,
    currentSpecs: { ...input.currentSpecs },
    thread: input.thread,
    candidateEvidence,
    proposedCorrections: fingerSize ? [fingerSize] : [],
  };
}
