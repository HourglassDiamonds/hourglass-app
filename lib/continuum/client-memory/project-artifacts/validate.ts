/**
 * Bounded Project Artifact parsing. No Gmail body inference. No public URLs.
 */

import {
  PROJECT_ARTIFACT_CREATED_BY_MAX,
  PROJECT_ARTIFACT_FILENAME_MAX,
  PROJECT_ARTIFACT_KINDS,
  PROJECT_ARTIFACT_MAX_BYTES,
  PROJECT_ARTIFACT_SOURCE_REF_MAX,
  PROJECT_ARTIFACT_SOURCE_SYSTEMS,
  PROJECT_ARTIFACT_TITLE_MAX,
  type ProjectArtifactKind,
  type ProjectArtifactSourceSystem,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export function isProjectArtifactKind(
  value: unknown,
): value is ProjectArtifactKind {
  return (
    typeof value === "string" &&
    (PROJECT_ARTIFACT_KINDS as readonly string[]).includes(value)
  );
}

export function isProjectArtifactSourceSystem(
  value: unknown,
): value is ProjectArtifactSourceSystem {
  return (
    typeof value === "string" &&
    (PROJECT_ARTIFACT_SOURCE_SYSTEMS as readonly string[]).includes(value)
  );
}

export function isProjectArtifactUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function isAllowedArtifactMime(value: string): boolean {
  return ALLOWED_MIME.has(value.trim().toLowerCase());
}

export function artifactExtensionForMime(mimeType: string): string | null {
  return EXT_BY_MIME[mimeType.trim().toLowerCase()] ?? null;
}

export function parseArtifactTitle(
  value: string | null | undefined,
): { ok: true; title: string } | { ok: false } {
  const title = (value ?? "").replace(/\s+/g, " ").trim();
  if (!title || title.length > PROJECT_ARTIFACT_TITLE_MAX) return { ok: false };
  if (/[\n\r]/.test(title)) return { ok: false };
  return { ok: true, title };
}

export function parseOriginalFilename(
  value: string | null | undefined,
): { ok: true; filename: string } | { ok: false } {
  const filename = (value ?? "").trim();
  if (!filename || filename.length > PROJECT_ARTIFACT_FILENAME_MAX) {
    return { ok: false };
  }
  if (/[\n\r\\/]/.test(filename) || filename.includes("..")) return { ok: false };
  return { ok: true, filename };
}

export function parseArtifactCreatedBy(
  value: string | null | undefined,
): { ok: true; createdBy: string } | { ok: false } {
  const createdBy = (value ?? "").trim();
  if (!createdBy || createdBy.length > PROJECT_ARTIFACT_CREATED_BY_MAX) {
    return { ok: false };
  }
  if (/[\n\r]/.test(createdBy)) return { ok: false };
  return { ok: true, createdBy };
}

export function parseArtifactSourceRef(
  value: string | null | undefined,
): { ok: true; sourceRef: string | null } | { ok: false } {
  if (value == null || value.trim() === "") return { ok: true, sourceRef: null };
  const sourceRef = value.trim();
  if (sourceRef.length > PROJECT_ARTIFACT_SOURCE_REF_MAX) return { ok: false };
  if (/[\n\r]/.test(sourceRef)) return { ok: false };
  return { ok: true, sourceRef };
}

export function parseArtifactBytes(
  bytes: Uint8Array | null | undefined,
): { ok: true; bytes: Uint8Array } | { ok: false } {
  if (!bytes || bytes.byteLength < 1) return { ok: false };
  if (bytes.byteLength > PROJECT_ARTIFACT_MAX_BYTES) return { ok: false };
  return { ok: true, bytes };
}

export function isPreviewableArtifactMime(mimeType: string): boolean {
  const mime = mimeType.trim().toLowerCase();
  return mime.startsWith("image/") || mime === "application/pdf";
}
