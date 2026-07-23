import { isBrandQuery } from "@/lib/intelligence/brand-queries";
import type { SearchIntentClass } from "./types";

const LOCAL_TERMS = [
  "charlotte",
  "waxhaw",
  "fort mill",
  "south charlotte",
  "ballantyne",
  "weddington",
  "matthews",
  "indian trail",
  "monroe",
  "marvin",
  "north carolina",
  "south carolina",
  " nc",
  " sc",
] as const;

const COMMERCIAL_TERMS = [
  "buy",
  "price",
  "cost",
  "custom",
  "engagement ring",
  "jeweler",
  "near me",
  "appointment",
  "best",
] as const;

const INFORMATIONAL_TERMS = [
  "what is",
  "how to",
  "vs",
  "versus",
  "guide",
  "explained",
  "meaning",
  "difference",
] as const;

const NAVIGATIONAL_TERMS = [
  "login",
  "hourglass diamonds",
  "diamond studio",
  "analyze sparkle",
  "see it on your hand",
] as const;

export { isBrandQuery };

export function isLocalIntent(query: string): boolean {
  const q = query.toLowerCase();
  return LOCAL_TERMS.some((t) => q.includes(t.trim()));
}

export function classifyQueryIntent(query: string): SearchIntentClass[] {
  const q = query.toLowerCase();
  const classes: SearchIntentClass[] = [];

  if (isBrandQuery(query)) classes.push("branded");
  else classes.push("non-branded");

  if (isLocalIntent(query)) classes.push("local");

  if (INFORMATIONAL_TERMS.some((t) => q.includes(t))) {
    classes.push("informational");
  } else if (COMMERCIAL_TERMS.some((t) => q.includes(t))) {
    classes.push("commercial");
  }

  if (
    NAVIGATIONAL_TERMS.some((t) => q.includes(t)) &&
    isBrandQuery(query)
  ) {
    classes.push("navigational");
  }

  return classes;
}

/** Small-sample guard for GSC rows — percentage swings are unreliable. */
export function isSmallSample(impressions: number, clicks: number): boolean {
  return impressions < 200 || clicks < 15;
}

export function sampleSizeConfidencePenalty(
  impressions: number,
  clicks: number,
): number {
  if (impressions < 80) return 0.45;
  if (isSmallSample(impressions, clicks)) return 0.7;
  if (impressions < 500) return 0.85;
  return 1;
}
