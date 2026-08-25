import type {
  HumanCommunicationType,
  HumanProvenanceClass,
} from "./types";

/**
 * reported-text: Justin reported a conversation Continuum did not read.
 * Never treat that as a direct-channel observation.
 */
export function provenanceClassForCommunication(
  type: HumanCommunicationType,
): HumanProvenanceClass {
  if (type === "reported-text") return "founder-reported";
  if (type === "handwritten") return "handwriting-parse";
  if (type === "unknown") return "unknown";
  return "founder-captured";
}

export function isFounderReportedProvenance(
  type: HumanCommunicationType,
): boolean {
  return provenanceClassForCommunication(type) === "founder-reported";
}
