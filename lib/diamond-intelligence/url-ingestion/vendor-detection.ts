import {
  SUPPORTED_VENDOR_IDS,
  TIER1_VENDOR_IDS,
  VENDOR_DEFINITIONS,
  type VendorDefinition,
} from "./vendors";
import type {
  DiamondVendorId,
  VendorSupportClassification,
  VendorSupportTier,
} from "./types";
import { validateListingUrl } from "./url-safety";

function findVendorDefinition(hostname: string): VendorDefinition | null {
  const host = hostname.toLowerCase();
  for (const def of VENDOR_DEFINITIONS) {
    if (def.hostPatterns.some((re) => re.test(host))) {
      return def;
    }
  }
  return null;
}

export function detectVendorFromUrl(url: string): DiamondVendorId {
  try {
    const parsed = new URL(url.trim());
    return findVendorDefinition(parsed.hostname)?.id ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function normalizeDiamondListingUrl(input: string): string | null {
  const safety = validateListingUrl(input);
  if (!safety.ok) return null;

  const url = safety.url;
  url.hash = "";
  url.username = "";
  url.password = "";

  const trackingParams = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "msclkid",
    "ref",
  ];
  for (const key of trackingParams) {
    url.searchParams.delete(key);
  }

  return url.toString();
}

export function extractListingId(
  url: string,
  vendor: DiamondVendorId,
): string | null {
  try {
    const parsed = new URL(url);
    const def = VENDOR_DEFINITIONS.find((v) => v.id === vendor);
    if (def?.listingIdFromPath) {
      const match = parsed.pathname.match(def.listingIdFromPath);
      if (match?.[1]) return decodeURIComponent(match[1]);
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.at(-1) ?? null;
  } catch {
    return null;
  }
}

export function classifyVendorSupport(url: string): VendorSupportClassification {
  const vendor = detectVendorFromUrl(url);
  if (vendor === "unknown") {
    return { vendor, tier: "unsupported", supported: false };
  }

  const def = VENDOR_DEFINITIONS.find((v) => v.id === vendor);
  const tier: VendorSupportTier = def?.tier ?? "unsupported";
  const supported = SUPPORTED_VENDOR_IDS.has(vendor);

  return { vendor, tier, supported };
}

export function isTier1Vendor(vendor: DiamondVendorId): boolean {
  return TIER1_VENDOR_IDS.has(vendor);
}
