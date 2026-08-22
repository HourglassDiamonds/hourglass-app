/**
 * Frozen Continuum Reconciliation v3 seed — not a generic importer strategy.
 * import_row_key uses Excel row numbers only for this immutable artifact.
 * Workbook SHA-256 is not Person identity.
 */

import { createHash } from "node:crypto";

export const AUDITED_RECONCILIATION_V3 = {
  artifactId: "continuum-reconciliation-v3" as const,
  relativePath: ".review/client-memory/Continuum_Reconciliation_v3.xlsx",
  sourceArtifactVersion: "continuum-reconciliation-v3" as const,
  frozenSeed: true as const,
  sha256:
    "e510311186297cd73f81bf03c04a18b64a8262ad8388af6a7d9d1a0c0092d058",
};

export function fingerprintWorkbook(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function workbookFingerprintMatch(bytes: Uint8Array): boolean {
  return fingerprintWorkbook(bytes) === AUDITED_RECONCILIATION_V3.sha256;
}
