export type SecurityHeader = {
  key: string;
  value: string;
};

/**
 * Site-wide headers for public routes. Intentionally not a full CSP:
 * Next.js runtime, consent-loaded GA, Cloudinary, YouTube click-to-play,
 * Mux, and same-origin Ring Studio iframes need a nonce-based rollout.
 *
 * This policy only sets clickjacking + plugin + base-uri constraints.
 */
export const PUBLIC_SECURITY_HEADERS: SecurityHeader[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
  },
];

/** Private dashboard — tighter framing than public SAMEORIGIN. Do not weaken. */
export const EXECUTIVE_DASHBOARD_SECURITY_HEADERS: SecurityHeader[] = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
];

export function applySecurityHeaders(
  headers: { set(name: string, value: string): void },
  list: SecurityHeader[],
): void {
  for (const header of list) {
    headers.set(header.key, header.value);
  }
}

/**
 * Staged full CSP (report-only first). Not shipped in this commit.
 *
 * default-src 'self';
 * base-uri 'self';
 * object-src 'none';
 * frame-ancestors 'self';
 * form-action 'self';
 * script-src 'self' 'nonce-{NEXT}' https://www.googletagmanager.com https://www.google-analytics.com;
 * style-src 'self' 'unsafe-inline';
 * img-src 'self' data: blob: https://res.cloudinary.com https://www.google-analytics.com https://www.googletagmanager.com https://i.ytimg.com https://image.mux.com;
 * font-src 'self' data:;
 * media-src 'self' blob: https://res.cloudinary.com https://stream.mux.com;
 * frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com;
 * connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://res.cloudinary.com https://*.mux.com https://inferred.litix.io;
 * worker-src 'self' blob:;
 * upgrade-insecure-requests;
 *
 * Must allow after-consent GA, Cloudinary House media, YouTube nocookie
 * embeds, Mux player, Next hydration, and same-origin Ring Studio iframe.
 * Do not enable without report-only observation on production.
 */
