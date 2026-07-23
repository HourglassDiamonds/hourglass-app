/**
 * Local geography + intent classification for Search Strategy.
 * Query text ≠ physical user location. Overlaps are handled cautiously.
 */

import { isBrandQuery } from "@/lib/intelligence/brand-queries";
import type { LocalGeography, LocalIntentKind } from "./types";

const GEOGRAPHY_PATTERNS: Array<{
  geography: LocalGeography;
  patterns: RegExp[];
}> = [
  {
    geography: "south-charlotte",
    patterns: [/\bsouth\s+charlotte\b/i, /\bballantyne\b/i],
  },
  {
    geography: "waxhaw",
    patterns: [/\bwaxhaw\b/i, /\bunion\s+county\b/i, /\bweddington\b/i, /\bmarvin\b/i],
  },
  {
    geography: "fort-mill",
    patterns: [/\bfort\s+mill\b/i, /\btega\s+cay\b/i],
  },
  {
    geography: "charlotte",
    patterns: [/\bcharlotte\b/i, /\buptown\b/i, /\bsouthpark\b/i],
  },
];

const METRO_TERMS =
  /\b(charlotte\s+metro|charlotte\s+area|near\s+charlotte|matthews|indian\s+trail|monroe|pineville|huntersville|lake\s+norman)\b/i;

const NEAR_ME = /\bnear\s+me\b/i;

const COMMERCIAL =
  /\b(engagement\s+ring|jeweler|custom|buy|price|cost|appointment|best|store)\b/i;

const INFORMATIONAL =
  /\b(what\s+is|how\s+to|guide|explained|meaning|vs|versus|difference)\b/i;

const VENUE =
  /\b(propose|proposal|venue|neighborhood|park|restaurant)\b/i;

export function classifyLocalGeography(query: string): LocalGeography {
  const q = query.toLowerCase();

  // Prefer more specific geographies before generic Charlotte
  for (const entry of GEOGRAPHY_PATTERNS) {
    if (entry.patterns.some((p) => p.test(q))) {
      return entry.geography;
    }
  }

  if (METRO_TERMS.test(q) || NEAR_ME.test(q)) {
    return "charlotte-metro";
  }

  if (/\b(nationwide|united\s+states|usa|online)\b/i.test(q)) {
    return "national";
  }

  return "unknown";
}

export function classifyLocalIntentKind(query: string): LocalIntentKind | null {
  const q = query.toLowerCase();
  const geography = classifyLocalGeography(query);
  const local =
    geography !== "unknown" && geography !== "national"
      ? true
      : NEAR_ME.test(q);

  if (!local && !NEAR_ME.test(q)) return null;

  if (NEAR_ME.test(q)) return "near-me-query";

  if (isBrandQuery(query) && local) return "branded-location-query";

  if (VENUE.test(q)) return "venue-neighborhood-query";

  if (INFORMATIONAL.test(q)) return "local-informational-query";

  if (COMMERCIAL.test(q)) return "local-commercial-query";

  if (
    geography === "charlotte" ||
    geography === "south-charlotte" ||
    geography === "waxhaw" ||
    geography === "fort-mill"
  ) {
    return "city-name-query";
  }

  if (geography === "charlotte-metro") return "regional-service-query";

  return "regional-service-query";
}

export function isLocalAuthorityQuery(query: string): boolean {
  return classifyLocalIntentKind(query) != null;
}

/**
 * Charlotte vs South Charlotte: South Charlotte is more specific;
 * mentioning both is complementary, not contradictory.
 */
export function geographyOverlapNote(
  a: LocalGeography,
  b: LocalGeography,
): "same" | "complementary" | "distinct" | "national-local" {
  if (a === b) return "same";
  if (a === "national" || b === "national") return "national-local";

  const charlotteFamily = new Set<LocalGeography>([
    "charlotte",
    "south-charlotte",
    "charlotte-metro",
    "waxhaw",
    "fort-mill",
  ]);

  if (charlotteFamily.has(a) && charlotteFamily.has(b)) {
    return "complementary";
  }

  return "distinct";
}

export function geographyDisplayName(g: LocalGeography): string {
  switch (g) {
    case "charlotte":
      return "Charlotte";
    case "waxhaw":
      return "Waxhaw";
    case "fort-mill":
      return "Fort Mill";
    case "south-charlotte":
      return "South Charlotte";
    case "charlotte-metro":
      return "Charlotte metro";
    case "national":
      return "National";
    default:
      return "Unknown";
  }
}
