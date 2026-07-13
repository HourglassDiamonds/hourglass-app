/**
 * First-party campaign attribution — sessionStorage only, no PII.
 * Captures first-touch UTMs once; tracks most recent CTA separately.
 * Does not store arbitrary query strings, fragments, or full referrer URLs.
 */

const STORAGE_KEY = "hg_attribution_v1";

export const ATTRIBUTION_MAX = {
  utm: 80,
  path: 120,
  host: 120,
  cta: 80,
  tool: 80,
  content: 80,
} as const;

export type AttributionSnapshot = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing_path?: string;
  /** Hostname only — never query string or fragment. */
  referrer_host?: string;
  /** Optional pathname only — never query/fragment. */
  referrer_path?: string;
  last_cta_location?: string;
  originating_tool?: string;
  originating_content?: string;
};

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const ALLOWED_KEYS = new Set<keyof AttributionSnapshot>([
  ...UTM_KEYS,
  "landing_path",
  "referrer_host",
  "referrer_path",
  "last_cta_location",
  "originating_tool",
  "originating_content",
]);

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

/** Strip control chars; reject values that look like emails/phones/tokens. */
export function sanitizeAttributionValue(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  let cleaned = value.trim().slice(0, maxLength);
  if (!cleaned) return undefined;
  cleaned = cleaned.replace(/[\u0000-\u001f\u007f]/g, "");
  if (!cleaned) return undefined;

  // Reject obvious PII / secrets patterns.
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(cleaned)) return undefined;
  if (/\+?\d[\d\s().-]{8,}\d/.test(cleaned)) return undefined;
  if (/^(bearer\s+|token=|session|jwt)/i.test(cleaned)) return undefined;
  if (/[?&#=].*(token|auth|session|password|email|phone)/i.test(cleaned)) {
    return undefined;
  }

  // Pathname-safe: allow letters, numbers, and a small punctuation set.
  if (!/^[a-zA-Z0-9_./:%+\-@ ]+$/.test(cleaned)) {
    // Still allow common UTM/campaign punctuation after stripping unsafe chars.
    cleaned = cleaned.replace(/[^a-zA-Z0-9_./:%+\-@ ]+/g, "");
  }
  cleaned = cleaned.trim().slice(0, maxLength);
  return cleaned || undefined;
}

function sanitizePathname(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // Drop query/fragment before any character filtering so `?`/`#` are not
  // merely stripped into adjacent path text.
  const pathOnly = value.trim().split(/[?#]/)[0] || "";
  if (!pathOnly) return undefined;
  const withSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return sanitizeAttributionValue(withSlash, ATTRIBUTION_MAX.path);
}

function parseReferrerParts(referrer: string): {
  host?: string;
  path?: string;
} {
  try {
    const url = new URL(referrer);
    const host = sanitizeAttributionValue(url.hostname, ATTRIBUTION_MAX.host);
    const path = sanitizePathname(url.pathname);
    return { host, path: path === "/" ? undefined : path };
  } catch {
    return {};
  }
}

function readStored(): AttributionSnapshot {
  if (!canUseStorage()) return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    return sanitizeAttributionRecord(parsed);
  } catch {
    return {};
  }
}

function writeStored(snapshot: AttributionSnapshot): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}

export function sanitizeAttributionRecord(
  input: Record<string, unknown>,
): AttributionSnapshot {
  const snapshot: AttributionSnapshot = {};

  for (const key of UTM_KEYS) {
    const value = sanitizeAttributionValue(input[key], ATTRIBUTION_MAX.utm);
    if (value) snapshot[key] = value;
  }

  const landing = sanitizePathname(input.landing_path);
  if (landing) snapshot.landing_path = landing;

  const host = sanitizeAttributionValue(
    input.referrer_host,
    ATTRIBUTION_MAX.host,
  );
  if (host) snapshot.referrer_host = host;

  const refPath = sanitizePathname(input.referrer_path);
  if (refPath) snapshot.referrer_path = refPath;

  const cta = sanitizeAttributionValue(
    input.last_cta_location,
    ATTRIBUTION_MAX.cta,
  );
  if (cta) snapshot.last_cta_location = cta;

  const tool = sanitizeAttributionValue(
    input.originating_tool,
    ATTRIBUTION_MAX.tool,
  );
  if (tool) snapshot.originating_tool = tool;

  const content = sanitizeAttributionValue(
    input.originating_content,
    ATTRIBUTION_MAX.content,
  );
  if (content) snapshot.originating_content = content;

  return snapshot;
}

/**
 * Capture first-touch landing + UTM data once per session.
 * Safe to call on every navigation — existing first-touch fields are preserved.
 */
export function captureAttributionFromLocation(
  pathname?: string,
  search?: string,
): AttributionSnapshot {
  if (!canUseStorage()) return {};

  const current = readStored();
  const path =
    pathname ??
    (typeof window !== "undefined" ? window.location.pathname : "") ??
    "";
  const query =
    search ??
    (typeof window !== "undefined"
      ? window.location.search.replace(/^\?/, "")
      : "") ??
    "";

  const params = new URLSearchParams(query);
  const next: AttributionSnapshot = { ...current };

  if (!next.landing_path && path) {
    next.landing_path = sanitizePathname(path);
  }

  if (
    !next.referrer_host &&
    typeof document !== "undefined" &&
    document.referrer
  ) {
    const parts = parseReferrerParts(document.referrer);
    if (parts.host) next.referrer_host = parts.host;
    if (parts.path) next.referrer_path = parts.path;
  }

  for (const key of UTM_KEYS) {
    if (next[key]) continue;
    const value = sanitizeAttributionValue(params.get(key), ATTRIBUTION_MAX.utm);
    if (value) next[key] = value;
  }

  const tool = sanitizeAttributionValue(
    params.get("tool") || params.get("source"),
    ATTRIBUTION_MAX.tool,
  );
  if (tool && !next.originating_tool) {
    next.originating_tool = tool;
  }

  const content = sanitizeAttributionValue(
    params.get("content") || params.get("article") || params.get("slug"),
    ATTRIBUTION_MAX.content,
  );
  if (content && !next.originating_content) {
    next.originating_content = content;
  }

  writeStored(next);
  return next;
}

/** Record the most recent consultation CTA location (overwrites). */
export function recordConsultationCtaLocation(location: string): void {
  const sanitized = sanitizeAttributionValue(location, ATTRIBUTION_MAX.cta);
  if (!sanitized) return;
  const current = readStored();
  current.last_cta_location = sanitized;
  writeStored(current);
}

/** Set originating tool when known (e.g. diamond-intelligence handoff). */
export function recordOriginatingTool(tool: string): void {
  const sanitized = sanitizeAttributionValue(tool, ATTRIBUTION_MAX.tool);
  if (!sanitized) return;
  const current = readStored();
  if (!current.originating_tool) {
    current.originating_tool = sanitized;
    writeStored(current);
  }
}

export function getAttributionSnapshot(): AttributionSnapshot {
  return readStored();
}

/** Client payload for Concierge FormData — already sanitized. */
export function attributionToFormFields(
  snapshot: AttributionSnapshot = readStored(),
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (
      ALLOWED_KEYS.has(key as keyof AttributionSnapshot) &&
      typeof value === "string" &&
      value
    ) {
      fields[key] = value;
    }
  }
  return fields;
}

/** Server-side sanitize of attribution fields from FormData. */
export function sanitizeAttributionFromFormData(
  formData: FormData,
): AttributionSnapshot {
  const record: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    record[key] = formData.get(key);
  }
  // Explicitly ignore legacy/unsafe keys if a client still sends them.
  return sanitizeAttributionRecord(record);
}

/** Human-readable HubSpot source line — never PII. */
export function buildHumanReadableSource(
  attribution: AttributionSnapshot,
  fallback = "concierge_page",
): string {
  const parts: string[] = [];

  if (attribution.originating_tool) {
    parts.push(`tool:${attribution.originating_tool}`);
  }
  if (attribution.utm_source) {
    parts.push(`utm:${attribution.utm_source}`);
    if (attribution.utm_medium) parts.push(attribution.utm_medium);
    if (attribution.utm_campaign) parts.push(attribution.utm_campaign);
  }
  if (attribution.last_cta_location) {
    parts.push(`cta:${attribution.last_cta_location}`);
  }
  if (attribution.landing_path && !attribution.originating_tool) {
    parts.push(`landed:${attribution.landing_path}`);
  }

  if (parts.length === 0) return fallback;
  return parts.join(" | ").slice(0, 500);
}
