import { SITE_URL } from "@/lib/seo/site-metadata";

/** Resolve public origin for QR capture links (server). */
export function resolveCaptureOrigin(request: Request): string {
  const fromEnv = process.env.SHAPE_STUDIO_PUBLIC_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto =
      request.headers.get("x-forwarded-proto") ??
      (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return SITE_URL.replace(/\/$/, "");
}

/** Client-side origin for QR when session API returns capturePath only. */
export function clientCaptureUrl(sessionId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/diamond-shape-studio/capture/${sessionId}`;
}
