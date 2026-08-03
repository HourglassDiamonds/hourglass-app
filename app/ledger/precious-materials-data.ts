/**
 * Precious Materials — weekly data.
 * ARCHIVED NUMERICAL SERIES — public page is a qualitative Precious Materials Monitor.
 * Proprietary 0–100 scores and weighting rows remain for rebuild.
 */

import {
  LEDGER_EVIDENCE_CUTOFF,
  LEDGER_METHODOLOGY_VERSION,
  latestSnapshot,
  type LedgerMonitorSeries,
} from "./ledger-monitor-framework";

export const PMI_UPDATED_LABEL =
  "Interim status — methodology revision in progress";

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
  { week: "3 Weeks Ago", score: 85 },
] as const;

export const PMI_CROSS_SYSTEM_BRIDGE =
  "Material markets remain connected to broader macro and reserve-asset conditions — but jewelry sourcing follows its own segmented logic beneath the geopolitical layer.";

export const PMI_CROSS_SYSTEM_PRESSURE = [
  "Structural central-bank and diversification demand continue to support conditions beneath near-term real-yield and rate-expectation pressure from the energy frame.",
  "Market pricing indicated gold trading around the $4,000 area — near-term sensitivity without a materials-regime break. The Ledger’s current interpretation is that this remains a firm monetary-demand read, not a materials-regime change.",
  "Selective natural-diamond pipeline adjustments, including July sight pricing alignment, remain a segmented watch rather than broad market stress.",
  "Lab-grown pricing compression continues in commercial and mid-tier ranges as an embedded factor, while premium natural holds firmer in selective sizes and cuts.",
] as const;

export const PMI_WHAT_MOVED = [
  "No materials-regime change this week — structural central-bank demand and selective diamond segmentation continue as embedded supports.",
  "Near-term pressure from real yields and rate expectations kept market pricing for gold around the $4,000 area; gold monetary demand remained elevated.",
  "Selective natural-diamond pipeline adjustments and continued lab-grown price compression remained segmented factors, not a newly confirmed regime shock.",
] as const;

export const PMI_WHAT_TO_WATCH = [
  "Whether gold reconnects more tightly to reserve-asset demand or remains tethered to real yields through the summer rate path.",
  "Whether gold holds around the $4,000 area or breaks that near-term range on rate or energy news.",
  "Selective natural-diamond pipeline outcomes and whether rough-price alignment stays segmented rather than broad.",
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
  "Directly sourced market prices and observable movements are retained. This monitor is editorial — not a traded product or investment recommendation.";

export const PMI_FOOTER_METHOD_NOTE =
  "The Precious Materials Monitor is a qualitative editorial framework for fine jewelry sourcing orientation — not commodity speculation.";

/** Append-only public series. Future reviews push a new snapshot. */
export const PMI_SERIES: LedgerMonitorSeries = {
  id: "precious-materials",
  methodologyVersion: LEDGER_METHODOLOGY_VERSION,
  snapshots: [
    {
      reviewDate: "August 3, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: "Strategically firm",
      currentDirection: "Highly segmented",
      previousState: "Strategically Firm (archived numerical series)",
      materialChangeSummary:
        "No materials-regime change. Market pricing indicated gold near the $4,000 area; diamond segmentation and lab-grown compression continued.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "LBMA / public spot market reporting",
          title: "Gold spot price near the $4,000 area",
          date: "Accessed August 3, 2026",
          supports:
            "Market pricing indicated gold trading around the $4,000 area without a materials-regime break",
        },
        {
          institution: "Wholesale diamond market commentary",
          title: "July sight pricing alignment and segmented natural demand",
          date: "Reviewed through August 3, 2026",
          supports:
            "Selective natural-diamond pipeline adjustments remaining segmented rather than broad stress",
        },
        {
          institution: "Trade press / lab-grown pricing surveys",
          title: "Commercial and mid-tier lab-grown price compression",
          date: "Reviewed through August 3, 2026",
          supports:
            "Continued lab-grown pricing compression as an embedded commercial-factor",
        },
      ],
    },
  ],
};

export const PMI_SNAPSHOT = latestSnapshot(PMI_SERIES);
