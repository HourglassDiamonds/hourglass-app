import { SITE_URL } from "@/lib/seo/site-metadata";

export const SCHEMA_CONTEXT = "https://schema.org";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const PERSON_ID = `${SITE_URL}/#justin-smith`;
export const WEBSITE_ID = `${SITE_URL}#website`;
export const JEWELRY_STORE_ID = `${SITE_URL}/#jewelry-store`;
export const DIAMOND_STUDIO_APP_ID = `${SITE_URL}/diamond-studio#software`;
export const DIAMOND_INTELLIGENCE_APP_ID = `${SITE_URL}/diamond-intelligence#software`;
export const DIAMOND_SHAPE_STUDIO_APP_ID = `${SITE_URL}/diamond-shape-studio#software`;

export const DIAMOND_INTELLIGENCE_NAME = "Diamond Intelligence";
export const DIAMOND_INTELLIGENCE_DESCRIPTION =
  "Upload an original GIA, IGI, or GCAL 8X grading report and receive independent interpretation of light performance, proportions, craftsmanship, and purchase context through Hourglass standards.";

export const ORGANIZATION_NAME = "Hourglass Diamonds";
export const PERSON_NAME = "Justin Smith";

export const LOGO_PATH = "/hourglass-logo-gold.png";

export const ORGANIZATION_DESCRIPTION =
  "Charlotte-based personal jeweler serving clients nationwide—private gemologist-led guidance for custom engagement rings and fine jewelry.";

export const PERSON_JOB_TITLE = "Graduate Gemologist";

/** Canonical public Charlotte office NAP (founder-approved). Single source for schema + Concierge. */
export const BUSINESS_STREET_ADDRESS = "15720 Brixham Hill Ave";
export const BUSINESS_SUITE = "Suite 300";
export const BUSINESS_ADDRESS_LOCALITY = "Charlotte";
export const BUSINESS_ADDRESS_REGION = "NC";
export const BUSINESS_POSTAL_CODE = "28277";
export const BUSINESS_ADDRESS_COUNTRY = "US";
/** Public display phone (hyphenated). */
export const BUSINESS_TELEPHONE_DISPLAY = "980-259-9485";
/** E.164 for `tel:` links and schema.org `telephone`. */
export const BUSINESS_TELEPHONE_E164 = "+19802599485";
/** Quiet-luxury office hours label for Concierge / contact UI. */
export const BUSINESS_OFFICE_HOURS_LABEL = "Monday–Friday, 9–5";
/** Schema.org OpeningHoursSpecification (Mon–Fri, office staffed). Consultations remain by appointment. */
export const BUSINESS_OPENING_HOURS = {
  dayOfWeek: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ] as const,
  opens: "09:00",
  closes: "17:00",
} as const;

/** Full street line including suite — for PostalAddress.streetAddress and visible UI. */
export function businessStreetAddressLine(): string {
  return `${BUSINESS_STREET_ADDRESS}, ${BUSINESS_SUITE}`;
}

export const DIAMOND_STUDIO_NAME = "Diamond Size Studio";
export const DIAMOND_STUDIO_DESCRIPTION =
  "Compare diamond shapes and carat weights on different finger sizes. Visualize scale, finger coverage, band width, and proportion before choosing a diamond.";

export const DIAMOND_SHAPE_STUDIO_NAME = "See It On Your Hand";
export const DIAMOND_SHAPE_STUDIO_DESCRIPTION =
  "Upload or photograph your hand and preview how different diamond shapes, carat weights, and proportions may appear before beginning a ring design.";

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
