/**
 * Canonical vs proposed vs unverified provenance for Concierge answers.
 * Does not collapse conflicts. Does not write canonical specs.
 */

export type ProvenanceLabel =
  | "canonical"
  | "proposed"
  | "conflicting"
  | "exact-source"
  | "non-exact"
  | "unknown";

export type SpecFact = {
  fieldName: string;
  label: string;
  canonicalValue: string | null;
  proposedValue: string | null;
  conflict: boolean;
  provenance: ProvenanceLabel;
  sourceVerified: boolean;
  sourceHref: string | null;
  matchedText: string | null;
};

export function provenanceLabelOf(input: {
  canonicalValue: string | null;
  proposedValue: string | null;
  sourceProvenance?: string | null;
  exactGmail?: boolean;
}): ProvenanceLabel {
  const proposed = input.proposedValue?.trim() || null;
  const canonical = input.canonicalValue?.trim() || null;
  if (proposed && canonical && proposed !== canonical) return "conflicting";
  if (input.exactGmail || input.sourceProvenance === "EXACT") return "exact-source";
  if (input.sourceProvenance === "DERIVED" || input.sourceProvenance === "THREAD_SUPPORT") {
    return "non-exact";
  }
  if (proposed && !canonical) {
    return input.sourceProvenance === "UNKNOWN" || !input.sourceProvenance
      ? "unknown"
      : "proposed";
  }
  if (canonical && !proposed) return "canonical";
  if (input.sourceProvenance === "UNKNOWN" || !input.sourceProvenance) return "unknown";
  return "proposed";
}

export function composeSpecFactCopy(fact: SpecFact): string {
  const label = fact.label || "That spec";
  const canonical = fact.canonicalValue?.trim() || null;
  const proposed = fact.proposedValue?.trim() || null;
  if (canonical && proposed && canonical !== proposed) {
    if (!fact.sourceVerified) {
      return `Canonical ${label.toLowerCase()} is ${canonical}. Continuum also has a pending proposal for ${proposed}, but the exact source message could not be verified. No canonical change has been approved.`;
    }
    return `Canonical ${label.toLowerCase()} is ${canonical}. Continuum also has a pending proposal for ${proposed} from an exact source. No canonical change has been approved.`;
  }
  if (canonical) {
    return `Canonical ${label.toLowerCase()} is ${canonical}.`;
  }
  if (proposed && !fact.sourceVerified) {
    return `Continuum has a pending proposal for ${label.toLowerCase()} ${proposed}, but the exact source message could not be verified. Nothing canonical is recorded yet.`;
  }
  if (proposed) {
    return `Continuum has a pending proposal for ${label.toLowerCase()} ${proposed}. It is not canonical.`;
  }
  return `Continuum does not have a recorded ${label.toLowerCase()} yet.`;
}

export function fieldLabel(fieldName: string): string {
  if (fieldName === "finger_size") return "finger size";
  if (fieldName === "cad_job_number") return "CAD job number";
  if (fieldName === "order_number") return "order number";
  if (fieldName === "center_stone") return "center stone";
  if (fieldName === "diamond_supply_notes") return "diamond supply notes";
  if (fieldName === "metal") return "metal";
  return fieldName.replace(/_/g, " ");
}
