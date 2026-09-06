/**
 * Maps Gmail copy-in kind labels onto live #14 canonical kinds.
 * Does not persist cad_render, vendor_paperwork, or client_image.
 */

import type { ProjectArtifactKind } from "../project-artifacts/types";
import { isProjectArtifactKind } from "../project-artifacts/validate";

const KIND_ALIASES: Record<string, ProjectArtifactKind> = {
  cad_render: "cad",
  "cad presentation": "cad",
  "cad finger render": "cad",
  vendor_paperwork: "document",
  "vendor order confirmation": "document",
  quote: "document",
  invoice: "document",
  "invoice pdf": "document",
  client_image: "inspiration",
  "client reference ring photo": "inspiration",
};

function normalizeKindKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function mapGmailCopyArtifactKind(
  value: string | null | undefined,
): ProjectArtifactKind | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (isProjectArtifactKind(raw)) return raw;
  const spaced = normalizeKindKey(raw);
  const underscored = spaced.replace(/ /g, "_");
  if (isProjectArtifactKind(underscored)) return underscored;
  return KIND_ALIASES[spaced] ?? KIND_ALIASES[underscored] ?? null;
}
