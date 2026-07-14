/**
 * Precious Materials Index — weekly data.
 * Update values and copy here each week. Page layout is fixed in precious-materials-index-view.
 */

export const PMI_UPDATED_LABEL = "Updated weekly — July 14, 2026";

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
  { week: "2 Weeks Ago", score: 85 },
  { week: "3 Weeks Ago", score: 83 },
] as const;

export const PMI_CROSS_SYSTEM_BRIDGE =
  "Material markets remain connected to broader macro and reserve-asset conditions — but jewelry sourcing follows its own segmented logic beneath the geopolitical layer.";

export const PMI_CROSS_SYSTEM_PRESSURE = [
  "Central-bank gold demand remains a structural support beneath near-term real-yield sensitivity as the restored energy and rate frame firms yields.",
  "De Beers' July sight pricing alignment stays a selective pipeline watch rather than broad market stress.",
  "Lab-grown pricing compression continues in commercial and mid-tier ranges as an embedded factor, while premium natural holds firmer in selective sizes and cuts.",
  "High-quality natural stones increasingly behave as scarcity and reserve assets rather than simple luxury cyclicals.",
] as const;

export const PMI_WHAT_MOVED = [
  "No materials-regime change this week — central-bank gold demand and selective diamond segmentation continue as embedded supports.",
  "Real-yield sensitivity stayed relevant as oil's restored risk premium fed rate-path uncertainty; gold monetary pressure held at 87.",
  "Lab-grown compression persisted in mid-tier channels as an embedded segmentation factor, not a newly accelerating shock.",
] as const;

export const PMI_WHAT_TO_WATCH = [
  "Whether gold reconnects to reserve-asset demand or remains tethered to real yields through the summer rate path.",
  "De Beers July sight outcomes and whether rough-price alignment stays selective rather than broad.",
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
