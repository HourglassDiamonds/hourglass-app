/**
 * Exact-thread reconstruction evidence contract.
 * Surfaces candidate evidence for a later Project Book Reconstruction
 * layer. Does not decide canonical truth. Does not apply Slice C.
 * Does not infer finger size from order/CAD adjacency.
 */

import { validateProjectSpecCorrection } from "@/lib/continuum/client-memory/project-spec/validate";
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

export type ReconstructionEvidenceItem = {
  kind: ReconstructionEvidenceKind;
  messageId: string | null;
  proposedValue: string | null;
  explicit: boolean;
  source: ReconstructionEvidenceSource;
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
const ORDER_NUMBER_EVIDENCE =
  /\border(?:\s*(?:#|number|no\.?))?\s*[:#]?\s*([A-Za-z0-9-]{2,64})\b/gi;
const CAD_JOB_EVIDENCE =
  /\b(?:CAD|job(?:\s*(?:#|number|no\.?))?)\s*[:#]?\s*([A-Za-z0-9-]{2,64})\b/gi;
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

function collectMessageEvidence(
  message: ProtectedExactThreadMessage,
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
    collectMatches(haystack, "order_number", ORDER_NUMBER_EVIDENCE, message.messageId, items);
    collectMatches(haystack, "cad_job_number", CAD_JOB_EVIDENCE, message.messageId, items);
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

export function collectExactThreadEvidence(
  thread: ProtectedExactThread,
): ReconstructionEvidenceItem[] {
  return thread.messages.flatMap(collectMessageEvidence);
}

export function buildExactThreadReconstructionHandoff(input: {
  projectId: string;
  currentSpecs: ExactThreadCurrentSpecs;
  thread: ProtectedExactThread;
}): ExactThreadReconstructionHandoff {
  const candidateEvidence = collectExactThreadEvidence(input.thread);
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
