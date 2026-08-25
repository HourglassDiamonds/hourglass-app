/**
 * Founder-facing labels for human-source inbox.
 * Does not invent provenance.
 */

import type {
  HumanCommunicationType,
  HumanReviewStatus,
  HumanSourceType,
} from "./types";
import { provenanceClassForCommunication } from "./provenance";

export const HUMAN_SOURCE_TYPE_LABELS: Record<HumanSourceType, string> = {
  plaud: "PLAUD",
  remarkable: "reMarkable",
};

export const HUMAN_COMMUNICATION_LABELS: Record<HumanCommunicationType, string> = {
  call: "Call",
  "in-person": "In-person",
  "voice-memo": "Voice memo",
  "reported-text": "Reported text",
  handwritten: "Handwritten",
  unknown: "Unknown",
};

export const HUMAN_REVIEW_STATUS_LABELS: Record<HumanReviewStatus, string> = {
  pending: "Pending",
  "in-review": "In review",
  complete: "Complete",
  discarded: "Discarded",
};

export const PLAUD_COMMUNICATION_CHOICES: HumanCommunicationType[] = [
  "unknown",
  "call",
  "in-person",
  "voice-memo",
  "reported-text",
];

export function humanSourceTypeLabel(type: HumanSourceType): string {
  return HUMAN_SOURCE_TYPE_LABELS[type];
}

export function humanCommunicationLabel(type: HumanCommunicationType): string {
  return HUMAN_COMMUNICATION_LABELS[type];
}

export function humanReviewStatusLabel(status: HumanReviewStatus): string {
  return HUMAN_REVIEW_STATUS_LABELS[status];
}

export function reportedTextProvenanceLabel(
  type: HumanCommunicationType,
): string | null {
  if (provenanceClassForCommunication(type) !== "founder-reported") return null;
  return "Reported by Justin";
}
