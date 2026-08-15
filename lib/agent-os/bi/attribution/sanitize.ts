/**
 * Sanitize explicit attribution tokens for aggregate keys.
 * Never keep emails, phones, names, deal names, or amount-like values.
 */

import { containsLikelyPiiOrSecret, redactSecretsAndPii } from "../../redaction";

const MAX_KEY = 80;

export function sanitizeAttributionKey(
  raw: string | undefined,
  kind: "tool" | "cta" | "path" | "utm" | "host",
): string | undefined {
  if (!raw?.trim()) return undefined;
  let value = redactSecretsAndPii(raw).trim();
  if (kind === "path") {
    value = value.split(/[?#]/)[0] ?? value;
    if (!value.startsWith("/")) {
      value = value.startsWith("http") ? pathFromUrl(value) : `/${value}`;
    }
  }
  if (kind === "host") {
    value = value.split(/\s+/)[0]?.replace(/[/,]+$/g, "") ?? "";
    value = value.toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(value) || value.includes("@")) return undefined;
  }
  if (kind === "tool" || kind === "cta" || kind === "utm") {
    value = value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9:_./-]+/g, "");
  }
  value = value.replace(/\s+/g, " ").trim();
  if (!value || value === "[redacted_email]" || value === "[redacted_phone]") {
    return undefined;
  }
  if (containsLikelyPiiOrSecret(value)) return undefined;
  if (/^\$?\d[\d,]*(?:\.\d+)?$/.test(value)) return undefined;
  if (value.length > MAX_KEY) value = value.slice(0, MAX_KEY);
  return value || undefined;
}

export function ctaSurfaceKey(lastCtaLocation: string): string {
  const colon = lastCtaLocation.indexOf(":");
  if (colon > 0) return lastCtaLocation.slice(0, colon);
  return lastCtaLocation;
}

export function founderFacingAttributionTextContainsPii(text: string): boolean {
  if (!text) return false;
  if (containsLikelyPiiOrSecret(text)) return true;
  if (/\$\s*\d/.test(text)) return true;
  return false;
}

function pathFromUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return url.pathname || "/";
  } catch {
    return "/";
  }
}
