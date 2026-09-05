import { isIP } from "node:net";

const MAX_IP_LENGTH = 80;
const MISSING_PRODUCTION_RETRY_SECONDS = 30;

/**
 * Vercel production identity:
 * 1. `x-vercel-forwarded-for` — platform-owned client IP. Prefer this because
 *    Vercel documents that `x-forwarded-for` can be overwritten by a proxy in
 *    front of Vercel, while this header keeps the platform value.
 * 2. `x-forwarded-for` only when the Vercel-specific header is absent —
 *    documented fallback for direct-to-Vercel traffic, where Vercel overwrites
 *    `x-forwarded-for` to prevent spoofing.
 *
 * A present-but-malformed trusted header fails closed. We never parse a
 * comma-separated forwarding chain (no leftmost/rightmost hop selection) and
 * never consult caller-controlled headers such as `x-real-ip` or `x-client-ip`
 * on Vercel.
 *
 * Outside Vercel (local/test): a single valid `x-forwarded-for` or `x-real-ip`,
 * else `"unknown"`. Never persist the returned value.
 */
export function getRequestClientIp(request: Request): string {
  if (isVercelRuntime()) {
    return readVercelClientIp(request);
  }

  return (
    parseSingleClientIp(request.headers.get("x-forwarded-for")) ??
    parseSingleClientIp(request.headers.get("x-real-ip")) ??
    "unknown"
  );
}

/** `null` means Vercel production is missing a usable identity — fail closed. */
export function resolveAbuseLimiterIdentity(raw: string): string | null {
  const identity = raw.trim();
  if (identity) return identity;
  if (process.env.VERCEL_ENV === "production") return null;
  return "unknown";
}

export function missingProductionClientIpResult(): {
  allowed: false;
  retryAfterSeconds: number;
} {
  return {
    allowed: false,
    retryAfterSeconds: MISSING_PRODUCTION_RETRY_SECONDS,
  };
}

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}

function readVercelClientIp(request: Request): string {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  if (hasHeaderValue(vercelForwarded)) {
    return parseSingleClientIp(vercelForwarded) ?? "";
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (hasHeaderValue(forwarded)) {
    return parseSingleClientIp(forwarded) ?? "";
  }

  return "";
}

function hasHeaderValue(value: string | null): boolean {
  return Boolean(value && value.trim());
}

/**
 * Accept exactly one public client IP. Comma-separated chains are rejected
 * because this code does not know which hop is platform-trusted.
 */
function parseSingleClientIp(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().slice(0, MAX_IP_LENGTH);
  if (!trimmed || trimmed.includes(",")) return null;

  const unbracketed = trimmed.replace(/^\[|\]$/g, "");
  if (isIP(unbracketed) === 0) return null;

  const mapped = unwrapMappedIpv4(unbracketed);
  return mapped ?? unbracketed;
}

function unwrapMappedIpv4(address: string): string | null {
  const lower = address.toLowerCase();
  if (!lower.startsWith("::ffff:")) return null;
  const rest = lower.slice(7);
  if (isIP(rest) === 4) return rest;
  return null;
}
