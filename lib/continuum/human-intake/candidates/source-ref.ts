/**
 * Full Human Intake provenance pointer for candidates.
 * Source id and locator offsets are retained in full. Fail closed rather than truncate.
 */

import { CANDIDATE_SOURCE_REF_MAX } from "@/lib/continuum/candidates/types";
import { parseHumanEvidenceSourceRef } from "@/lib/continuum/candidates/human-evidence-source-ref";
import type { IntakeLocator } from "./types";

export const HUMAN_INTAKE_CANDIDATE_SOURCE_VERSION = "hi1" as const;

export type HumanIntakeCandidateSourceRef = {
  sourceId: string;
  start: number;
  end: number;
};

export function locatorFor(
  text: string,
  start: number,
  end: number,
): IntakeLocator {
  const from = Math.max(0, start);
  const to = Math.min(text.length, end);
  return {
    start: from,
    end: to,
    quote: text.slice(from, to).replace(/\s+/g, " ").trim().slice(0, 280),
  };
}

export function packHumanIntakeCandidateSourceRef(
  input: HumanIntakeCandidateSourceRef,
): { ok: true; sourceRef: string } | { ok: false; reason: "identity-too-long" } {
  const sourceId = input.sourceId.trim();
  if (!sourceId) return { ok: false, reason: "identity-too-long" };
  const packed = [
    HUMAN_INTAKE_CANDIDATE_SOURCE_VERSION,
    sourceId,
    String(input.start),
    String(input.end),
  ].join("|");
  if (packed.length > CANDIDATE_SOURCE_REF_MAX) {
    return { ok: false, reason: "identity-too-long" };
  }
  return { ok: true, sourceRef: packed };
}

export function parseHumanIntakeCandidateSourceRef(
  sourceRef: string,
): HumanIntakeCandidateSourceRef | null {
  const parts = sourceRef.trim().split("|");
  if (parts[0] !== HUMAN_INTAKE_CANDIDATE_SOURCE_VERSION) return null;
  if (parts.length < 4) return null;
  const sourceId = (parts[1] ?? "").trim();
  const start = Number(parts[2]);
  const end = Number(parts[3]);
  if (!sourceId || !Number.isInteger(start) || !Number.isInteger(end)) return null;
  return { sourceId, start, end };
}

export function sourceIdFromCandidateSourceRef(sourceRef: string): string | null {
  return parseHumanIntakeCandidateSourceRef(sourceRef)?.sourceId ?? null;
}

export function sourceIdFromHumanCandidateSourceRef(
  sourceRef: string,
): string | null {
  return (
    sourceIdFromCandidateSourceRef(sourceRef) ??
    parseHumanEvidenceSourceRef(sourceRef)?.sourceId ??
    null
  );
}
