/**
 * Strip secrets, hashes, and raw identifiers from founder-facing Concierge text.
 */

const UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const HASH = /\b[0-9a-f]{24,}\b/gi;
const SK_KEY = /\bsk-[A-Za-z0-9_-]{8,}\b/g;
const GC1 = /\bgc1\|[^\s]+/gi;
const SUPABASE = /https?:\/\/[a-z0-9-]+\.supabase\.co[^\s]*/gi;
const SERVICE_ROLE = /\beyJ[A-Za-z0-9_-]{20,}\b/g;

export function sanitizeFounderText(text: string): string {
  return text
    .replace(SK_KEY, "[redacted]")
    .replace(SERVICE_ROLE, "[redacted]")
    .replace(SUPABASE, "[redacted]")
    .replace(GC1, "source evidence")
    .replace(UUID, "")
    .replace(HASH, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function clipToolJson(value: unknown, max = 4000): string {
  const raw = JSON.stringify(value)
    .replace(SK_KEY, "[redacted]")
    .replace(SERVICE_ROLE, "[redacted]")
    .replace(SUPABASE, "[redacted]");
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…`;
}
