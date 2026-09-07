/**
 * Provenance pointer from a Candidate back to a stored human source.
 * Does not embed transcript text. Fail closed rather than truncate.
 * Locator offsets are optional; adapters stamp them. Parser does not.
 */

import { CANDIDATE_SOURCE_REF_MAX } from "@/lib/continuum/candidates/types";

export const HUMAN_EVIDENCE_SOURCE_VERSION = "he1" as const;

export type HumanEvidenceSourceRef = {
  sourceId: string;
  start?: number;
  end?: number;
};

export function humanEvidenceSourceRefPrefix(sourceId: string): string {
  return `${HUMAN_EVIDENCE_SOURCE_VERSION}|${sourceId.trim()}`;
}

export function packHumanEvidenceSourceRef(
  input: HumanEvidenceSourceRef,
): { ok: true; sourceRef: string } | { ok: false; reason: "identity-too-long" } {
  const sourceId = input.sourceId.trim();
  if (!sourceId) return { ok: false, reason: "identity-too-long" };
  const parts = [HUMAN_EVIDENCE_SOURCE_VERSION, sourceId];
  if (input.start != null && input.end != null) {
    parts.push(String(input.start), String(input.end));
  }
  const packed = parts.join("|");
  if (packed.length > CANDIDATE_SOURCE_REF_MAX) {
    return { ok: false, reason: "identity-too-long" };
  }
  return { ok: true, sourceRef: packed };
}

export function parseHumanEvidenceSourceRef(
  sourceRef: string,
): HumanEvidenceSourceRef | null {
  const raw = sourceRef.trim();
  const parts = raw.split("|");
  if (parts[0] !== HUMAN_EVIDENCE_SOURCE_VERSION) return null;
  if (parts.length < 2) return null;
  const sourceId = (parts[1] ?? "").trim();
  if (!sourceId) return null;
  if (parts.length >= 4) {
    const start = Number(parts[2]);
    const end = Number(parts[3]);
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      return { sourceId };
    }
    return { sourceId, start, end };
  }
  return { sourceId };
}
