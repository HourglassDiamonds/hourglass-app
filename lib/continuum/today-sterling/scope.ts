import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";

export type SterlingTodayScopeDefinition = {
  key: string;
  publicId: string;
  identifiers: readonly string[];
  exactLabels: readonly string[];
  founderCorrectionOnly?: boolean;
  requiredCorrectionTerms?: readonly string[];
};

/**
 * Server-owned acceptance scope. Labels are discovery aids only; they never
 * establish identity. A label-only entry must resolve through an already
 * scoped founder correction before it can enter the working set.
 */
export const STERLING_TODAY_ACCEPTANCE_SCOPE = [
  { key: "abbey", publicId: "ABBEY/C026137", identifiers: ["C026137"], exactLabels: ["Abbey"] },
  { key: "sarah", publicId: "SARAH/C026143", identifiers: ["C026143"], exactLabels: ["Sarah"] },
  { key: "nathan", publicId: "NATHAN/C026176", identifiers: ["C026176"], exactLabels: ["Nathan", "Nate"] },
  { key: "alex", publicId: "ALEX/C026510", identifiers: ["C026510"], exactLabels: ["Alex"] },
  { key: "madi", publicId: "MADI/C026000/C017756", identifiers: ["C026000", "C017756"], exactLabels: ["Madi Rutledge"] },
  { key: "dylan", publicId: "DYLAN/C025610", identifiers: ["C025610"], exactLabels: ["Dylan", "Dylon"] },
  { key: "grant", publicId: "F-GRANT/C025885", identifiers: ["C025885"], exactLabels: ["F. Grant", "F Grant"] },
  { key: "pennock", publicId: "J-PENNOCK/C025519", identifiers: ["C025519"], exactLabels: ["J. Pennock", "J Pennock"] },
  { key: "duane", publicId: "DUANE/C026350", identifiers: ["C026350"], exactLabels: ["Duane"] },
  { key: "timJenn", publicId: "TIM-JENN/C025964", identifiers: ["C025964"], exactLabels: ["Tim", "Jenn"] },
  { key: "audrey", publicId: "AUDREY/C026401", identifiers: ["C026401"], exactLabels: ["Audrey"] },
  { key: "lucasResolved", publicId: "FOUNDER-CORRECTION/LUCAS-RESOLVED", identifiers: [],
    exactLabels: ["Lucas", "Lucas Kinnin"], founderCorrectionOnly: true },
  { key: "justinIntake", publicId: "FOUNDER-CORRECTION/JUSTIN-OCT5-VS-ZANE", identifiers: [],
    exactLabels: ["Justin Smith", "Zane Kennedy"], founderCorrectionOnly: true,
    requiredCorrectionTerms: ["Justin Smith", "Zane Kennedy"] },
  { key: "jenniferActionability", publicId: "FOUNDER-CORRECTION/JENNIFER-ACTIONABILITY", identifiers: [],
    exactLabels: ["Jennifer Flores"], founderCorrectionOnly: true },
] as const satisfies readonly SterlingTodayScopeDefinition[];

export type SterlingTodayScopeKey = (typeof STERLING_TODAY_ACCEPTANCE_SCOPE)[number]["key"];

function fold(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}

function hasIdentifier(text: string, identifier: string): boolean {
  const normalized = fold(text);
  const expected = fold(identifier);
  return normalized.split(/[^a-z0-9-]+/).includes(expected);
}

function hasExactLabel(text: string, label: string): boolean {
  const normalized = ` ${fold(text).replace(/[^a-z0-9]+/g, " ")} `;
  const expected = ` ${fold(label).replace(/[^a-z0-9]+/g, " ")} `;
  return normalized.includes(expected);
}

export function scopeDefinition(key: string): SterlingTodayScopeDefinition | null {
  return STERLING_TODAY_ACCEPTANCE_SCOPE.find((row) => row.key === key) ?? null;
}

export function scopeMatchesText(definition: SterlingTodayScopeDefinition, text: string): boolean {
  return definition.identifiers.some((identifier) => hasIdentifier(text, identifier)) ||
    definition.exactLabels.some((label) => hasExactLabel(text, label));
}

/** Exact operational identifiers only. Human labels must never establish scope identity. */
export function scopeMatchesIdentifierText(definition: SterlingTodayScopeDefinition, text: string): boolean {
  return definition.identifiers.some((identifier) => hasIdentifier(text, identifier));
}

export function scopeMatchesOperationalIdentifier(
  definition: SterlingTodayScopeDefinition,
  identifiers: readonly string[],
): boolean {
  const expected = new Set(definition.identifiers.map(fold));
  return identifiers.some((identifier) => expected.has(fold(identifier)));
}

export function isDurablyScopedFounderCorrection(
  definition: SterlingTodayScopeDefinition,
  event: SourceCommunicationEvent,
): boolean {
  if (event.provenance !== "founder_correction" || event.semanticClass !== "founder_correction") return false;
  if (!event.sourceRef.startsWith("founder-note:")) return false;
  const durableIdentity = Boolean(event.projectId || event.workLoopId || event.cadIds.length > 0);
  if (!durableIdentity || event.workIdentityBasis === null) return false;
  if (definition.identifiers.length > 0 && scopeMatchesOperationalIdentifier(definition, event.cadIds)) return true;
  const correctionText = [event.personLabel, event.authorOwnedText, event.evidenceExcerpt].filter(Boolean).join(" ");
  if (!definition.exactLabels.some((label) => hasExactLabel(correctionText, label))) return false;
  return (definition.requiredCorrectionTerms ?? []).every((term) => hasExactLabel(correctionText, term));
}

export function candidateScopeText(candidate: ContinuumCandidate): string {
  return [
    candidate.sourceRef,
    candidate.evidenceBasis.matchedText ?? "",
    JSON.stringify(candidate.payload),
    JSON.stringify(candidate.founderEditedPayload ?? {}),
  ].join(" ");
}

export function acceptanceIdentifiers(): string[] {
  return [...new Set(STERLING_TODAY_ACCEPTANCE_SCOPE.flatMap((row) => [...row.identifiers]))];
}
