import type { ListingExtraction } from "./types";
import { normalizeListingLab } from "./listing-grade-hint-fallback";

const VENDOR_LABELS: Partial<Record<ListingExtraction["vendor"], string>> = {
  "rare-carat": "Rare Carat",
  "james-allen": "James Allen",
  "blue-nile": "Blue Nile",
  "brilliant-earth": "Brilliant Earth",
  ritani: "Ritani",
  adiamor: "Adiamor",
};

export type PartialListingDetail = {
  label: string;
  value: string;
};

export function vendorDisplayLabel(
  vendor: ListingExtraction["vendor"],
): string {
  return VENDOR_LABELS[vendor] ?? vendor;
}

/** High-confidence listing fields for partial URL-ingest states. */
export function listPartialListingDetails(
  listing: ListingExtraction,
): PartialListingDetail[] {
  if (listing.extractionConfidence !== "high") {
    return [];
  }

  const details: PartialListingDetail[] = [];
  const push = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (!text) return;
    details.push({ label, value: text });
  };

  push("Carat", listing.carat);
  push("Color", listing.color);
  push("Clarity", listing.clarity);
  push("Shape", listing.shape);
  const lab = normalizeListingLab(listing.lab);
  if (lab) {
    details.push({ label: "Lab", value: lab });
  }
  push("Retailer", vendorDisplayLabel(listing.vendor));

  return details;
}
