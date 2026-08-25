/**
 * PLAUD text intake. Canonicalize only enough for stable hashing.
 * Does not paraphrase or extract memories.
 */

import { HUMAN_SOURCE_TEXT_MAX_LENGTH } from "./types";

export const PLAUD_FILE_EXTENSIONS = [".txt", ".vtt", ".json", ".md"] as const;

export type PlaudFileKind = "txt" | "vtt" | "json" | "md";

const EXTENSION_KIND: Record<(typeof PLAUD_FILE_EXTENSIONS)[number], PlaudFileKind> = {
  ".txt": "txt",
  ".vtt": "vtt",
  ".json": "json",
  ".md": "md",
};

const ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/vtt",
  "application/json",
  "application/octet-stream",
]);

export function canonicalizeHumanSourceText(raw: string): string {
  const withoutBom = raw.replace(/^\uFEFF/, "");
  return withoutBom.normalize("NFC").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function plaudFileKindFromName(fileName: string): PlaudFileKind | null {
  const lower = fileName.trim().toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = lower.slice(dot);
  if (ext === ".txt" || ext === ".vtt" || ext === ".json" || ext === ".md") {
    return EXTENSION_KIND[ext];
  }
  return null;
}

export function isAllowedPlaudMime(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) return true;
  return ALLOWED_MIME.has(normalized);
}

export function decodeUtf8Bytes(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function extractJsonTranscript(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      for (const key of ["transcript", "text", "content"]) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) return value;
      }
    }
  } catch {
    return text;
  }
  return text;
}

export function extractPlaudRawText(input: {
  kind: PlaudFileKind;
  decoded: string;
}): string {
  if (input.kind === "json") {
    return canonicalizeHumanSourceText(extractJsonTranscript(input.decoded));
  }
  return canonicalizeHumanSourceText(input.decoded);
}

export function assertHumanSourceTextLength(
  text: string,
): "ok" | "empty-text" | "oversized-text" {
  if (!text.trim()) return "empty-text";
  if (text.length > HUMAN_SOURCE_TEXT_MAX_LENGTH) return "oversized-text";
  return "ok";
}
