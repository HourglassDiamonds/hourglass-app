/**
 * Structured_spec source provenance contract.
 * Additive payload metadata. Does not invent a parallel CandidateStore.
 * Does not write canonical specs or change founder review state.
 */

import {
  STRUCTURED_SPEC_SOURCE_PROVENANCES,
  type ContinuumCandidate,
  type StructuredSpecPayload,
  type StructuredSpecSourceProvenance,
} from "./types";

export {
  STRUCTURED_SPEC_SOURCE_PROVENANCES,
  type StructuredSpecSourceProvenance,
};

const GENERATED_FOUNDER_OPERATING_BRIEF_RULE =
  "generated_founder_operating_brief";

export function isStructuredSpecSourceProvenance(
  value: unknown,
): value is StructuredSpecSourceProvenance {
  return (
    typeof value === "string" &&
    (STRUCTURED_SPEC_SOURCE_PROVENANCES as readonly string[]).includes(value)
  );
}

export function structuredSpecSourceProvenanceOf(
  row: Pick<ContinuumCandidate, "payload" | "sourceSystem" | "evidenceBasis">,
): StructuredSpecSourceProvenance {
  const payload = row.payload;
  if (payload.kind !== "structured_spec") return "UNKNOWN";
  if (isStructuredSpecSourceProvenance(payload.sourceProvenance)) {
    return payload.sourceProvenance;
  }
  if (row.evidenceBasis.ruleIds.includes(GENERATED_FOUNDER_OPERATING_BRIEF_RULE)) {
    return "DERIVED";
  }
  return row.sourceSystem === "gmail" ? "EXACT" : "UNKNOWN";
}

export function isExactStructuredSpecGmailSource(
  row: ContinuumCandidate,
): boolean {
  if (row.sourceSystem !== "gmail") return false;
  if (row.evidenceBasis.ruleIds.includes(GENERATED_FOUNDER_OPERATING_BRIEF_RULE)) {
    return false;
  }
  if (!row.sourceRef.trim().startsWith("gc1|")) return false;
  return structuredSpecSourceProvenanceOf(row) === "EXACT";
}

export function withStructuredSpecProvenance(
  row: ContinuumCandidate,
  provenance: StructuredSpecSourceProvenance,
  extras?: {
    sourceRef?: string;
    supportingSourceRefs?: readonly string[];
  },
): ContinuumCandidate {
  const payload = row.payload;
  if (payload.kind !== "structured_spec") return row;
  const nextPayload: StructuredSpecPayload = {
    ...payload,
    sourceProvenance: provenance,
  };
  let evidenceBasis = row.evidenceBasis;
  if (extras?.supportingSourceRefs) {
    evidenceBasis = {
      ruleIds: [...row.evidenceBasis.ruleIds],
      matchedText: row.evidenceBasis.matchedText,
      supportingSourceRefs:
        extras.supportingSourceRefs.length > 0
          ? [...extras.supportingSourceRefs]
          : undefined,
    };
  }
  return {
    ...row,
    sourceRef: extras?.sourceRef?.trim() || row.sourceRef,
    payload: nextPayload,
    founderEditedPayload: row.founderEditedPayload,
    evidenceBasis,
  };
}
