/**
 * Private bucket design for human sources.
 * No public URLs. Object paths are server-generated.
 */

export const HUMAN_SOURCES_BUCKET = "continuum-human-sources";
export const HUMAN_SOURCES_SIGNED_URL_TTL_SECONDS = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SAFE_EXTENSION = new Set([
  "txt",
  "vtt",
  "json",
  "md",
  "pdf",
  "png",
  "jpg",
  "jpeg",
]);

export function humanSourceObjectPath(
  sourceId: string,
  fileName: string,
): string | null {
  if (!UUID_RE.test(sourceId.trim())) return null;
  const lower = fileName.trim().toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot + 1) : "";
  if (!SAFE_EXTENSION.has(ext)) return null;
  return `${sourceId.trim()}/source.${ext}`;
}
