import type { PersonRowClass } from "./types";

const LEGAL_ENTITY_SUFFIX =
  /(?:,?\s+)?\b(?:l\.?l\.?c\.?|inc\.?|incorporated|ltd\.?|l\.?l\.?p\.?|p\.?c\.?|gmbh|plc)\.?$/i;

const ORG_AMBIGUOUS_KEYWORD = /\b(?:jewelers?|jewellery|jewelry)\b/i;

export function classifyPersonName(
  name: string,
  extras?: { companyName?: string | null },
): PersonRowClass {
  const display = name.trim();
  if (!display) return "invalid";

  // Company Name == Name is QB duplication, not organization evidence.
  void extras?.companyName;

  if (LEGAL_ENTITY_SUFFIX.test(display)) return "organization-candidate";
  const tokens = display.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return "needs-review";
  if (ORG_AMBIGUOUS_KEYWORD.test(display)) return "needs-review";
  return "person-candidate";
}

export function splitDisplayName(name: string): {
  givenName: string | null;
  familyName: string | null;
} {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { givenName: null, familyName: null };
  if (tokens.length === 1) return { givenName: tokens[0], familyName: null };
  return {
    givenName: tokens[0],
    familyName: tokens[tokens.length - 1],
  };
}

