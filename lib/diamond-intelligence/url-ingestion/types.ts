export type DiamondVendorId =
  | "james-allen"
  | "blue-nile"
  | "rare-carat"
  | "brilliant-earth"
  | "ritani"
  | "adiamor"
  | "whiteflash"
  | "brian-gavin"
  | "clean-origin"
  | "with-clarity"
  | "grown-brilliance"
  | "frank-darling"
  | "vrai"
  | "art-of-jewels"
  | "loose-grown-diamond"
  | "rockher"
  | "diamonds-direct"
  | "jared"
  | "kay"
  | "zales"
  | "aurate"
  | "unknown";

export type VendorSupportTier = "tier1" | "tier2" | "tier3" | "unsupported";

export type VendorSupportClassification = {
  vendor: DiamondVendorId;
  tier: VendorSupportTier;
  supported: boolean;
};

export type UrlIngestionStatus =
  | "invalid_url"
  | "unsupported_vendor"
  | "listing_inaccessible"
  | "listing_found_no_report"
  | "report_extracted"
  | "report_incomplete"
  | "full_interpretation";

export type ListingExtraction = {
  vendor: DiamondVendorId;
  url: string;
  canonicalUrl: string;
  listingId: string | null;
  price: number | null;
  currency: string | null;
  shape: string | null;
  carat: number | null;
  color: string | null;
  clarity: string | null;
  cut: string | null;
  polish: string | null;
  symmetry: string | null;
  fluorescence: string | null;
  lab: string | null;
  reportNumber: string | null;
  reportUrl: string | null;
  certificateUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  availability: string | null;
  extractedAt: string;
  extractionConfidence: "high" | "medium" | "low";
  extractionWarnings: string[];
  rawHtmlSnippet?: string;
  rawJsonLd?: unknown;
  rawMetadata?: Record<string, string>;
};

export type FetchedListingPage = {
  finalUrl: string;
  html: string;
  contentType: string | null;
};

export type UrlIngestionLogEntry = {
  vendor: DiamondVendorId;
  status: UrlIngestionStatus;
  extractionConfidence: ListingExtraction["extractionConfidence"] | null;
  failureReason: string | null;
};
