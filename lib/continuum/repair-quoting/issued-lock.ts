/**
 * Issued quotes freeze source, factors, and quote math.
 * Voiding is allowed only when frozen fields are unchanged.
 */

import type { RepairQuote } from "./types";

const FROZEN_KEYS = [
  "quoteId",
  "projectId",
  "quoteNumber",
  "repairType",
  "metalFamily",
  "associatedPersonId",
  "sourceEditionLabel",
  "sourceSku",
  "line",
  "calculation",
  "override",
  "issuedAt",
  "issuedBy",
  "issuedMutationId",
  "createdAt",
  "createdBy",
  "createdMutationId",
] as const;

export function jsonFrozenEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function issuedQuoteUpdateAllowed(
  prior: RepairQuote,
  next: RepairQuote,
): boolean {
  if (prior.state === "voided") return false;
  if (prior.state !== "issued") return true;
  if (next.state !== "voided") return false;
  if (!next.voidedAt || !next.voidedBy) return false;
  for (const key of FROZEN_KEYS) {
    if (!jsonFrozenEqual(prior[key], next[key])) return false;
  }
  return true;
}
