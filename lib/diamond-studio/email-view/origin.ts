import { SITE_URL } from "@/lib/seo/site-metadata";

/**
 * Origin used in visitor-facing Studio emails.
 *
 * Production (and Vercel production) always use the canonical Hourglass
 * site origin. Localhost is never composed unless development explicitly
 * sets STUDIO_EMAIL_LOCAL_ORIGIN.
 */
export function studioPublicOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const vercelEnv = env.VERCEL_ENV?.trim();
  const nodeEnv = env.NODE_ENV?.trim();

  if (vercelEnv === "production" || nodeEnv === "production") {
    return SITE_URL;
  }

  if (nodeEnv === "development") {
    const local = env.STUDIO_EMAIL_LOCAL_ORIGIN?.trim();
    if (local && /^https?:\/\/localhost(?::\d+)?$/i.test(local)) {
      return local.replace(/\/$/, "");
    }
  }

  return SITE_URL;
}

export function studioAbsoluteShareUrl(
  sharePath: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const origin = studioPublicOrigin(env).replace(/\/$/, "");
  const path = sharePath.startsWith("/") ? sharePath : `/${sharePath}`;
  return `${origin}${path}`;
}

export function emailCompositionContainsLocalhost(content: string): boolean {
  return /localhost:\d+|127\.0\.0\.1|0\.0\.0\.0/i.test(content);
}
