import { SITE_URL } from "@/lib/seo/site-metadata";

export const SCHEMA_CONTEXT = "https://schema.org";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const PERSON_ID = `${SITE_URL}/#justin-smith`;
export const WEBSITE_ID = `${SITE_URL}#website`;
export const JEWELRY_STORE_ID = `${SITE_URL}/#jewelry-store`;
export const DIAMOND_STUDIO_APP_ID = `${SITE_URL}/diamond-studio#software`;

export const ORGANIZATION_NAME = "Hourglass Diamonds";
export const PERSON_NAME = "Justin Smith";

export const LOGO_PATH = "/hourglass-logo-gold.png";

export const ORGANIZATION_DESCRIPTION =
  "Charlotte-based personal jeweler serving clients nationwide—private gemologist-led guidance for custom engagement rings and fine jewelry.";

export const PERSON_JOB_TITLE = "Graduate Gemologist";

export const DIAMOND_STUDIO_NAME = "Diamond Studio";
export const DIAMOND_STUDIO_DESCRIPTION =
  "Interactive diamond size visualization tool—explore carat, finger coverage, shape, and proportion in a calm, visual environment.";

/** Charlotte Metro communities served (no fabricated storefronts). */
export const CHARLOTTE_METRO_AREA_SERVED = [
  { name: "Charlotte", region: "NC" },
  { name: "Waxhaw", region: "NC" },
  { name: "Ballantyne", region: "NC" },
  { name: "Weddington", region: "NC" },
  { name: "Marvin", region: "NC" },
  { name: "Fort Mill", region: "SC" },
  { name: "Matthews", region: "NC" },
  { name: "Indian Trail", region: "NC" },
  { name: "Monroe", region: "NC" },
] as const;

export function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}
