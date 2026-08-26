import { SITE_URL } from "@/lib/seo/site-metadata";
import { publicCardPath } from "./paths";

export function digitalCardPublicOrigin(
  headersList?: Headers | { get(name: string): string | null },
  env: NodeJS.ProcessEnv = process.env,
): string {
  const vercelEnv = env.VERCEL_ENV?.trim();
  const nodeEnv = env.NODE_ENV?.trim();
  if (vercelEnv === "production" || nodeEnv === "production") {
    return SITE_URL.replace(/\/$/, "");
  }
  if (headersList) {
    const host =
      headersList.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      headersList.get("host")?.trim();
    if (host) {
      const proto =
        headersList.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }
  return SITE_URL.replace(/\/$/, "");
}

export function publicCardAbsoluteUrl(
  slug: string,
  headersList?: Headers | { get(name: string): string | null },
  env: NodeJS.ProcessEnv = process.env,
): string {
  return `${digitalCardPublicOrigin(headersList, env)}${publicCardPath(slug)}`;
}
