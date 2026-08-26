/**
 * Browser-safe URL parsing for My Card.
 * Blank / whitespace-only optional URLs are absent and valid.
 */

import { DIGITAL_CARD_URL_MAX } from "./types";

export function trimToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseHttpUrl(
  raw: string | null | undefined,
  options?: { allowEmpty?: boolean },
): { ok: true; url: string | null } | { ok: false } {
  const value = trimToNull(raw);
  if (!value) {
    return options?.allowEmpty === false ? { ok: false } : { ok: true, url: null };
  }
  if (value.length > DIGITAL_CARD_URL_MAX) return { ok: false };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { ok: false };
  if (parsed.username || parsed.password) return { ok: false };
  if (!parsed.hostname) return { ok: false };
  return { ok: true, url: parsed.toString() };
}

export function parseHttpsUrl(
  raw: string | null | undefined,
): { ok: true; url: string | null } | { ok: false } {
  const parsed = parseHttpUrl(raw);
  if (!parsed.ok) return { ok: false };
  if (!parsed.url) return { ok: true, url: null };
  try {
    const url = new URL(parsed.url);
    if (url.protocol !== "https:") return { ok: false };
  } catch {
    return { ok: false };
  }
  return parsed;
}

export function parseInstagramUrl(
  raw: string | null | undefined,
): { ok: true; url: string | null } | { ok: false } {
  const value = trimToNull(raw);
  if (!value) return { ok: true, url: null };
  if (/^https?:\/\//i.test(value)) return parseHttpUrl(value);
  const handle = value.replace(/^@/, "").replace(/\/+$/, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return { ok: false };
  return { ok: true, url: `https://www.instagram.com/${handle}` };
}
