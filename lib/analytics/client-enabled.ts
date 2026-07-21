/**
 * Server-only decision: whether the public site should load gtag and dispatch
 * client analytics. Safe to call from Server Components (e.g. root layout).
 *
 * Rules:
 * - Missing NEXT_PUBLIC_GA_ID → disabled
 * - VERCEL_ENV=production → enabled (when ID present)
 * - Local / Vercel Preview → disabled unless GA_CLIENT_ENABLED=1
 *
 * Do not use NODE_ENV alone — Next production builds on Preview would otherwise
 * pollute the production GA4 property.
 */
export function isClientAnalyticsEnabled(): boolean {
  const measurementId = process.env.NEXT_PUBLIC_GA_ID?.trim();
  if (!measurementId) return false;

  if (process.env.VERCEL_ENV === "production") return true;

  return process.env.GA_CLIENT_ENABLED === "1";
}
