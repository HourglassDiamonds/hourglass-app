/**
 * Deterministic Client Memory identity hashes.
 * Normalization matches Client Attention (email lowercase; phone last 10 digits).
 * Hash prefix is Continuum-specific so raw email/phone never appear in identifiers.
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
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
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
