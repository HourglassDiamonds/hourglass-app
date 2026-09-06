/**
 * Maps Gmail attachment MIME types onto #14 allowed types.
 * Does not guess from filename. octet-stream may use magic-byte validation.
 */

import { isAllowedArtifactMime } from "../project-artifacts/validate";

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
};

export type GmailCopyMimeDecision =
  | { ok: true; mimeType: string; usedMagic: boolean }
  | { ok: false; reason: "unsupported-mime" };

function normalizeMime(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function previewGmailCopyMime(
  declaredMime: string | null | undefined,
): "allowed" | "needs-bytes" | "unsupported-mime" {
  const mime = normalizeMime(declaredMime);
  if (!mime) return "unsupported-mime";
  const aliased = MIME_ALIASES[mime] ?? mime;
  if (isAllowedArtifactMime(aliased)) return "allowed";
  if (aliased === "application/octet-stream") return "needs-bytes";
  return "unsupported-mime";
}

function sniffMagic(bytes: Uint8Array): string | null {
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf";
  }
  if (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function resolveGmailCopyMime(
  declaredMime: string | null | undefined,
  bytes: Uint8Array | null,
): GmailCopyMimeDecision {
  const mime = normalizeMime(declaredMime);
  if (!mime) return { ok: false, reason: "unsupported-mime" };
  const aliased = MIME_ALIASES[mime] ?? mime;
  if (isAllowedArtifactMime(aliased)) {
    return { ok: true, mimeType: aliased, usedMagic: false };
  }
  if (aliased !== "application/octet-stream") {
    return { ok: false, reason: "unsupported-mime" };
  }
  if (!bytes) return { ok: false, reason: "unsupported-mime" };
  const sniffed = sniffMagic(bytes);
  if (!sniffed || !isAllowedArtifactMime(sniffed)) {
    return { ok: false, reason: "unsupported-mime" };
  }
  return { ok: true, mimeType: sniffed, usedMagic: true };
}
