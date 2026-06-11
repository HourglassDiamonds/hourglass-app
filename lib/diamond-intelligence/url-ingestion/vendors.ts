import type { DiamondVendorId, VendorSupportTier } from "./types";

export type VendorDefinition = {
  id: DiamondVendorId;
  tier: VendorSupportTier;
  hostPatterns: RegExp[];
  listingIdFromPath?: RegExp;
};

export const VENDOR_DEFINITIONS: VendorDefinition[] = [
  {
    id: "james-allen",
    tier: "tier1",
    hostPatterns: [/^(?:www\.)?jamesallen\.com$/i],
    listingIdFromPath: /\/(?:loose-diamonds|diamonds)\/[^/]+\/(\d+)/i,
  },
  {
    id: "blue-nile",
    tier: "tier1",
    hostPatterns: [/^(?:www\.)?bluenile\.com$/i],
    listingIdFromPath: /\/diamond-details\/([^/?#]+)/i,
  },
  {
    id: "rare-carat",
    tier: "tier1",
    hostPatterns: [/^(?:www\.)?rarecarat\.com$/i],
    listingIdFromPath: /\/diamond\/([^/?#]+)/i,
  },
  {
    id: "brilliant-earth",
    tier: "tier1",
    hostPatterns: [/^(?:www\.)?brilliantearth\.com$/i],
    listingIdFromPath: /\/(?:diamond|loose-diamonds)\/([^/?#]+)/i,
  },
  {
    id: "ritani",
    tier: "tier1",
    hostPatterns: [/^(?:www\.)?ritani\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "adiamor",
    tier: "tier1",
    hostPatterns: [/^(?:www\.)?adiamor\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "whiteflash",
    tier: "tier2",
    hostPatterns: [/^(?:www\.)?whiteflash\.com$/i],
    listingIdFromPath: /\/loose-diamonds\/([^/?#]+)/i,
  },
  {
    id: "brian-gavin",
    tier: "tier2",
    hostPatterns: [/^(?:www\.)?briangavin\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "clean-origin",
    tier: "tier2",
    hostPatterns: [/^(?:www\.)?cleanorigin\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "with-clarity",
    tier: "tier2",
    hostPatterns: [/^(?:www\.)?withclarity\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "grown-brilliance",
    tier: "tier2",
    hostPatterns: [/^(?:www\.)?grownbrilliance\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "frank-darling",
    tier: "tier2",
    hostPatterns: [/^(?:www\.)?frankdarling\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "vrai",
    tier: "tier3",
    hostPatterns: [/^(?:www\.)?vrai\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "art-of-jewels",
    tier: "tier3",
    hostPatterns: [/^(?:www\.)?(?:theartofjewels|artofjewels)\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "loose-grown-diamond",
    tier: "tier3",
    hostPatterns: [/^(?:www\.)?loosegrowndiamond\.com$/i],
    listingIdFromPath: /\/product\/([^/?#]+)/i,
  },
  {
    id: "rockher",
    tier: "tier3",
    hostPatterns: [/^(?:www\.)?rockher\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "diamonds-direct",
    tier: "tier3",
    hostPatterns: [/^(?:www\.)?diamondsdirect\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "jared",
    tier: "tier3",
    hostPatterns: [/^(?:www\.)?jared\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "kay",
    tier: "tier3",
    hostPatterns: [/^(?:www\.)?kay\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "zales",
    tier: "tier3",
    hostPatterns: [/^(?:www\.)?zales\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
  {
    id: "aurate",
    tier: "tier3",
    hostPatterns: [/^(?:www\.)?(?:aurate|aurelline)\.com$/i],
    listingIdFromPath: /\/diamonds\/([^/?#]+)/i,
  },
];

export const TIER1_VENDOR_IDS = new Set(
  VENDOR_DEFINITIONS.filter((v) => v.tier === "tier1").map((v) => v.id),
);

export const SUPPORTED_VENDOR_IDS = new Set(
  VENDOR_DEFINITIONS.filter((v) => v.tier === "tier1" || v.tier === "tier2").map(
    (v) => v.id,
  ),
);
