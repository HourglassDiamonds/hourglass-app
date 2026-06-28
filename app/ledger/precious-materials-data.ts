/**
 * Precious Materials Index — weekly data.
 * Update values and copy here each week. Page layout is fixed in precious-materials-index-view.
 */

export const PMI_UPDATED_LABEL = "Updated weekly — June 28, 2026";

export const PMI_MARKET_PRESSURE = {
  score: 85,
  status: "Strategically Firm",
  weeklyChange: 0,
} as const;

export const PMI_INTRO =
  "A weekly index tracking the material conditions behind fine jewelry — gold, platinum, natural diamonds, and the sourcing environment that shapes quality, availability, and long-term value for clients and makers.";

export const PMI_METALS_PRESSURE = [
  { metal: "Gold Monetary Pressure", score: 87, state: "Elevated" },
  { metal: "Silver Pressure", score: 78, state: "Elevated" },
  { metal: "Platinum / Palladium", score: 72, state: "Firm" },
] as const;

export const PMI_DIAMOND_SPLIT = [
  { segment: "Premium Natural", score: 78, note: "Selectively firm in key sizes" },
  { segment: "Commercial Natural", score: 55, note: "Price-sensitive" },
  { segment: "Lab-Grown", score: 88, note: "Share pressure rising" },
] as const;

export const PMI_JEWELRY_DEMAND = [
  { channel: "Jewelry Demand Pressure", read: "78/100", note: "Bridal and high jewelry firm" },
  { channel: "Colored Gemstone Scarcity", read: "74/100", note: "Key origins constrained" },
] as const;

export const PMI_RECENT_READINGS = [
  { week: "This Week", score: 85 },
  { week: "Last Week", score: 85 },
  { week: "2 Weeks Ago", score: 83 },
  { week: "3 Weeks Ago", score: 86 },
] as const;

export const PMI_CROSS_SYSTEM_BRIDGE =
  "Material markets remain connected to broader macro and reserve-asset conditions — but jewelry sourcing follows its own segmented logic beneath the geopolitical layer.";

export const PMI_CROSS_SYSTEM_PRESSURE = [
  "Gold holds structurally elevated support from central-bank reserve behavior — with near-term real-yield sensitivity beneath the strategic read.",
  "Major-producer supply discipline continues; premium natural categories selectively firm, commercial ranges price-sensitive.",
  "Lab-grown pricing compression continues in commercial and mid-tier ranges, while premium natural holds firmer in selective sizes and cuts.",
  "High-quality natural stones increasingly behave as scarcity and reserve assets rather than simple luxury cyclicals.",
] as const;

export const PMI_WHAT_MOVED = [
  "Gold showed near-term real-yield sensitivity while central-bank reserve behavior kept the structural read firm — elevated without dramatic volatility.",
  "De Beers-led supply discipline continued; premium natural categories held selective firmness in well-cut, desirable sizes.",
  "Lab-grown compression persisted in mid-tier channels, reinforcing luxury demand segmentation rather than uniform market pressure.",
] as const;

export const PMI_WHAT_TO_WATCH = [
  "Whether gold reconnects to reserve-asset demand or remains tethered to real yields through the summer rate path.",
  "Natural diamond availability in VS+ qualities and rough price discipline during ongoing supply-structure reset.",
  "Whether high-quality natural diamonds continue holding firm as scarcity assets in premium categories.",
  "Lab-grown pricing pressure and its effect on commercial natural positioning — not premium heirloom-grade work.",
  "Sourcing discipline in a segmented market — provenance and selective inventory over reactive accumulation.",
] as const;

export const PMI_CALCULATION_ROWS = [
  { component: "Metals complex", weight: "30%", note: "Gold, silver, platinum, palladium" },
  { component: "Diamond market stress", weight: "35%", note: "Natural, lab-grown, segmented demand" },
  { component: "Jewelry demand pressure", weight: "20%", note: "Bridal, high jewelry, channel load" },
  { component: "Gemstone scarcity", weight: "15%", note: "Colored stones, selective supply" },
] as const;

export const PMI_SOURCES_NOTE =
  "Sources include public metals benchmarks, wholesale diamond market commentary, trade press, and Hourglass sourcing intelligence. Figures are normalized to a 0–100 scale for comparison. This index is editorial — not a traded product or investment recommendation.";

export const PMI_FOOTER_METHOD_NOTE =
  "The Precious Materials Index is a weighted editorial composite published weekly by Hourglass Ledger. It is designed for orientation in fine jewelry sourcing — not commodity speculation.";
