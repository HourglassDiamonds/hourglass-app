/**
 * Integer money helpers. Source costs are cents. Raw Hourglass quotes use
 * eighth-cents so $93.125 is exact. V1 rounds the raw quote to nearest $5
 * without mutating source cost.
 */

import { EIGHTH_CENTS_PER_DOLLAR } from "./types";

const MONEY_RE = /^-?\$?\s*([0-9]{1,9})(?:,([0-9]{3}))*(?:\.([0-9]{1,2}))?$/;

export function parseUsdToCents(raw: string | null | undefined): number | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const normalized = trimmed.replace(/,/g, "");
  const match = /^-?\$?\s*([0-9]{1,9})(?:\.([0-9]{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const dollars = Number(match[1]);
  const frac = (match[2] ?? "").padEnd(2, "0");
  const cents = dollars * 100 + Number(frac || "0");
  if (!Number.isInteger(cents) || cents > 999_999_999_00) return null;
  return trimmed.startsWith("-") ? -cents : cents;
}

export function formatUsdCents(cents: number): string {
  if (!Number.isInteger(cents)) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${grouped}.${frac}`;
}

export function centsToEighthCents(cents: number): number {
  if (!Number.isInteger(cents)) throw new Error("invalid-money");
  return cents * 8;
}

/**
 * Hourglass raw quote in eighth-cents:
 * (Cost Labor × 1.25 + Cost Parts + Cost Other) × 2.5
 * = Cost Labor × 25/8 + (Parts + Other) × 20/8 dollars-in-cents terms
 * stored as eighth-cents: laborCents * 25 + (parts+other) * 20
 */
export function hourglassQuoteEighthCents(input: {
  costLaborCents: number;
  costPartsCents: number;
  costOtherCents: number;
}): number {
  const labor = input.costLaborCents;
  const parts = input.costPartsCents;
  const other = input.costOtherCents;
  if (![labor, parts, other].every((n) => Number.isInteger(n) && n >= 0)) {
    throw new Error("invalid-money");
  }
  return labor * 25 + (parts + other) * 20;
}

export function loadedLaborEighthCents(costLaborCents: number): number {
  if (!Number.isInteger(costLaborCents) || costLaborCents < 0) {
    throw new Error("invalid-money");
  }
  return costLaborCents * 10;
}

export function formatUsdEighthCents(eighthCents: number): string {
  if (!Number.isInteger(eighthCents)) return "";
  const sign = eighthCents < 0 ? "-" : "";
  const abs = Math.abs(eighthCents);
  const dollars = Math.floor(abs / EIGHTH_CENTS_PER_DOLLAR);
  const remainder = abs % EIGHTH_CENTS_PER_DOLLAR;
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (remainder === 0) return `${sign}$${grouped}`;
  const frac = (remainder / EIGHTH_CENTS_PER_DOLLAR).toString().slice(2);
  return `${sign}$${grouped}.${frac}`;
}

export function isMoneyPattern(raw: string): boolean {
  return MONEY_RE.test(raw.trim());
}

export function overrideCentsToEighthCents(cents: number): number {
  return centsToEighthCents(cents);
}

const FIVE_DOLLARS_EIGHTH_CENTS = 4_000;

/** Nearest $5. Exact halfway rounds away from the lower $5 (half up). */
export function roundToNearestFiveDollarsEighthCents(
  eighthCents: number,
): number {
  if (!Number.isInteger(eighthCents) || eighthCents < 0) {
    throw new Error("invalid-money");
  }
  const remainder = eighthCents % FIVE_DOLLARS_EIGHTH_CENTS;
  if (remainder * 2 < FIVE_DOLLARS_EIGHTH_CENTS) {
    return eighthCents - remainder;
  }
  return eighthCents - remainder + FIVE_DOLLARS_EIGHTH_CENTS;
}

