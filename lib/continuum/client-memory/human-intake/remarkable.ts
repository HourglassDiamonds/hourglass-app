/**
 * reMarkable export intake. Founder upload only.
 * No cloud mailbox, account sync, or OCR.
 */

export const REMARKABLE_FILE_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"] as const;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

export function remarkableKindFromName(
  fileName: string,
): "pdf" | "png" | "jpg" | "jpeg" | null {
  const lower = fileName.trim().toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = lower.slice(dot);
  if (ext === ".pdf" || ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
    return ext.slice(1) as "pdf" | "png" | "jpg" | "jpeg";
  }
  return null;
}

export function isAllowedRemarkableMime(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) return false;
  return ALLOWED_MIME.has(normalized);
}

export function sanitizeOriginalFilename(fileName: string): string | null {
  const trimmed = fileName.replace(/[/\\]/g, "").trim();
  if (!trimmed || trimmed.length > 240) return null;
  return remarkableKindFromName(trimmed) ? trimmed : null;
}

export function remarkableMimeFromName(fileName: string): string | null {
  const kind = remarkableKindFromName(fileName);
  if (kind === "pdf") return "application/pdf";
  if (kind === "png") return "image/png";
  if (kind === "jpg" || kind === "jpeg") return "image/jpeg";
  return null;
}
