/**
 * Precious Materials Index — weekly data.
 * Update values and copy here each week. Page layout is fixed in precious-materials-index-view.
 */

export const PMI_UPDATED_LABEL = "Updated weekly — May 19, 2026";

export const PMI_MARKET_PRESSURE = {
  score: 86,
  status: "High Pressure",
  weeklyChange: -1,
} as const;

export const PMI_INTRO =
  "A weekly index tracking the material conditions behind fine jewelry — gold, platinum, natural diamonds, and the sourcing environment that shapes quality, availability, and long-term value for clients and makers.";

export const PMI_METALS_PRESSURE = [
  { metal: "Gold Monetary Pressure", score: 93, state: "High" },
  { metal: "Silver Pressure", score: 84, state: "Elevated" },
  { metal: "Platinum / Palladium", score: 75, state: "Elevated" },
] as const;

export const PMI_DIAMOND_SPLIT = [
  { segment: "Premium Natural", score: 74, note: "Resilient in key sizes" },
  { segment: "Commercial Natural", score: 58, note: "Price-sensitive" },
  { segment: "Lab-Grown", score: 90, note: "Share pressure rising" },
] as const;

export const PMI_JEWELRY_DEMAND = [
  { channel: "Jewelry Demand Pressure", read: "85/100", note: "Bridal and high jewelry firm" },
  { channel: "Colored Gemstone Scarcity", read: "78/100", note: "Key origins constrained" },
] as const;

export const PMI_RECENT_READINGS = [
  { week: "This Week", score: 86 },
  { week: "Last Week", score: 87 },
  { week: "2 Weeks Ago", score: 86 },
  { week: "3 Weeks Ago", score: 84 },
] as const;

export const PMI_CROSS_SYSTEM_BRIDGE =
  "Material markets are increasingly reacting to the same energy, logistics, and infrastructure pressures affecting broader industrial systems.";

export const PMI_CROSS_SYSTEM_PRESSURE = [
  "Energy costs and grid strain are feeding through to mining, refining, and transport — raising the physical floor beneath metals.",
  "Currency sensitivity remains active: dollar moves continue to shape wholesale gold and platinum even when jewelry demand is steady.",
  "Lab-grown pricing compression is narrowing commercial natural margins, while premium natural holds firmer in selective sizes.",
  "Luxury demand bifurcation persists — high jewelry and bridal hold structure; mid-tier channels face more price competition.",
] as const;

export const PMI_WHAT_MOVED = [
  "Gold monetary pressure remained elevated as macro support and dollar sensitivity kept the complex firm across wholesale channels.",
  "Lab-grown disruption continued to press natural diamond positioning, with market stress rising in commercial and mid-tier ranges.",
  "Jewelry demand pressure held firm in bridal and high jewelry, while colored gemstone scarcity remained visible in key origins and sizes.",
] as const;

export const PMI_WHAT_TO_WATCH = [
  "Gold direction and the interaction between rates, dollar strength, and safe-haven flows.",
  "Natural diamond availability in VS+ qualities and rough price discipline.",
  "Lab-grown pricing pressure and its effect on natural premium positioning.",
  "Platinum and palladium supply for mounting lead times into peak season.",
] as const;

export const PMI_CALCULATION_ROWS = [
  { component: "Metals complex", weight: "30%", note: "Gold, silver, platinum, palladium" },
  { component: "Diamond market stress", weight: "35%", note: "Natural, lab-grown, market pressure" },
  { component: "Jewelry demand pressure", weight: "20%", note: "Bridal, high jewelry, channel load" },
  { component: "Gemstone scarcity", weight: "15%", note: "Colored stones, selective supply" },
] as const;

export const PMI_SOURCES_NOTE =
  "Sources include public metals benchmarks, wholesale diamond market commentary, trade press, and Hourglass sourcing intelligence. Figures are normalized to a 0–100 scale for comparison. This index is editorial — not a traded product or investment recommendation.";

export const PMI_FOOTER_METHOD_NOTE =
  "The Precious Materials Index is a weighted editorial composite published weekly by Hourglass Ledger. It is designed for orientation in fine jewelry sourcing — not commodity speculation.";
