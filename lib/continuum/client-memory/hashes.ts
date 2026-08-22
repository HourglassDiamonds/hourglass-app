/**
 * Deterministic Client Memory identity hashes.
 * Email: lowercase. Phone: US / +1 10-digit only (no last-10 truncation for
 * international numbers). Hash prefix is Continuum-specific so raw email/phone
 * never appear in identifiers.
 *
 * import_row_key helpers below are for the frozen Continuum Reconciliation v3
 * seed only. Excel-row keys are not a generic reusable importer strategy.
 */

import { createHash } from "node:crypto";

const HASH_PREFIX = "continuum:client-memory:v1";

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export function normalizePhone(raw: string | null | undefined): string | null {
  const classified = classifyPhone(raw);
  if (classified.status !== "us-compatible") return null;
  return classified.normalized;
}

export type PhoneClassification =
  | { status: "us-compatible"; normalized: string }
  | { status: "blank" }
  | { status: "too-short" }
  | { status: "international" };

/**
 * US / +1: 10 digits, or 11 starting with 1.
 * Longer or non-+1 11-digit values are international — do not last-10 hash.
 */
export function classifyPhone(raw: string | null | undefined): PhoneClassification {
  if (!raw || !raw.trim()) return { status: "blank" };
  const digits = raw.replace(/\D+/g, "");
  if (digits.length < 10) return { status: "too-short" };
  if (digits.length === 10) return { status: "us-compatible", normalized: digits };
  if (digits.length === 11 && digits.startsWith("1")) {
    return { status: "us-compatible", normalized: digits.slice(1) };
  }
  return { status: "international" };
}

export function hashIdentityMaterial(
  kind: "email" | "phone",
  normalized: string,
): string {
  return createHash("sha256")
    .update(`${HASH_PREFIX}:${kind}:${normalized}`)
    .digest("hex");
}

export function hashEmail(raw: string | null | undefined): string | null {
  const normalized = normalizeEmail(raw);
  if (!normalized) return null;
  return hashIdentityMaterial("email", normalized);
}

export function hashPhone(raw: string | null | undefined): string | null {
  const normalized = normalizePhone(raw);
  if (!normalized) return null;
  return hashIdentityMaterial("phone", normalized);
}

export function peopleImportRowKey(excelRow: number): string {
  // Frozen v3 seed only: continuum-reconciliation-v3:{Sheet}:{excelRow}
  return `continuum-reconciliation-v3:People:${excelRow}`;
}

export function projectImportRowKey(excelRow: number): string {
  return `continuum-reconciliation-v3:ReconciledProjects:${excelRow}`;
}

export function cadImportRowKey(excelRow: number): string {
  return `continuum-reconciliation-v3:CadFiles:${excelRow}`;
}

export function salesImportRowKey(excelRow: number): string {
  return `continuum-reconciliation-v3:SalesHistory:${excelRow}`;
}

export function reviewQueueImportRowKey(excelRow: number): string {
  return `continuum-reconciliation-v3:ReviewQueue:${excelRow}`;
}
