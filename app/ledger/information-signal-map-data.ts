/**
 * Information Signal Map — weekly data.
 * Update values and copy here each week. Page layout is fixed in information-signal-map-view.
 */

export const ISM_UPDATED_LABEL = "Updated weekly — May 19, 2026";

export const ISM_READING = {
  score: 77,
  label: "Signal Clarity",
  weeklyChange: 3,
} as const;

export const ISM_SUMMARY =
  "Reliable sources are converging more clearly around the same core signal: energy disruption, inflation pressure, financial sensitivity, and physical infrastructure strain are now linked. The disagreement is no longer about whether pressure exists. It is about whether this is a temporary volatility cycle or the early phase of a longer capacity adjustment.";

export const ISM_SIGNAL_GRID = [
  {
    title: "Consensus",
    body: "Energy routing, inflation pressure, data-center demand, grid strain, and rate sensitivity are increasingly being discussed as connected pressures.",
  },
  {
    title: "Divergence",
    body: "Markets still frame the pressure as tradable volatility, while infrastructure reporting points to slower physical bottlenecks beneath the price moves.",
  },
  {
    title: "Blind Spot",
    body: "Power labor shortages, transformer constraints, cooling demand, and consumer cost pass-through remain underweighted in mainstream framing.",
  },
] as const;

export const ISM_SOURCE_STACK = [
  {
    title: "Institutional",
    body: "Focuses on stability, inflation management, energy resilience, grid planning, and controlled risk language.",
  },
  {
    title: "Market",
    body: "Focuses on oil, bond yields, gold, rate expectations, volatility, and whether energy prices delay policy relief.",
  },
  {
    title: "Mainstream",
    body: "Focuses on individual events, price spikes, political reaction, consumer cost pressure, and short-term market movement.",
  },
  {
    title: "Infrastructure",
    body: "Focuses on power demand, data-center load, grid labor, transmission delays, cooling constraints, and capacity limits.",
  },
] as const;

export const ISM_NARRATIVE_MAP = [
  {
    title: "Domestic Framing",
    body: "Emphasizes inflation, energy costs, and interest-rate pressure. Underweights global supply-route fragility and grid capacity limits.",
  },
  {
    title: "Political Framing",
    body: "Emphasizes blame, diplomacy, conflict headlines, and consumer pain. Underweights slow-moving system constraints.",
  },
  {
    title: "Market Framing",
    body: "Emphasizes pricing signals in oil, gold, yields, and equities. Underweights construction timelines, workforce shortages, and physical load growth.",
  },
  {
    title: "Infrastructure Framing",
    body: "Emphasizes electricity demand, data centers, transmission, labor shortages, and utility planning. Underweights near-term public attention.",
  },
] as const;

export const ISM_NARRATIVE_SHIFT =
  "Coverage is shifting from isolated inflation and energy headlines toward a more connected capacity story. Oil, bond yields, rate expectations, AI data-center load, grid labor shortages, and utility planning are increasingly appearing in the same frame. The market is still treating much of this as price volatility, but the deeper signal is physical: power, labor, cooling, transmission, and supply chains are becoming the limiting layer.";

export const ISM_WHAT_TO_WATCH = [
  {
    title: "Energy Routing",
    body: "Disruption language around shipping corridors, port access, Gulf risk, oil flows, LNG availability, and tanker strain.",
  },
  {
    title: "Rate Expectations",
    body: "Whether higher oil and fuel prices keep inflation sticky enough to delay central-bank easing or lift bond-yield pressure.",
  },
  {
    title: "Grid Labor",
    body: "Shortages in electricians, line workers, engineers, and construction labor needed for data centers, transmission, and utility upgrades.",
  },
  {
    title: "Consumer Pass-Through",
    body: "Whether energy, freight, power, and infrastructure costs start showing up more clearly in food, goods, rent, and utility bills.",
  },
] as const;

export const ISM_WHAT_WOULD_CHANGE = [
  {
    title: "Energy Stabilization",
    body: "Reduced volatility, calmer route language, softer crude pricing, and normalized supply expectations.",
  },
  {
    title: "Rate Relief",
    body: "Clear evidence that inflation pressure is cooling enough to restore confidence in rate cuts.",
  },
  {
    title: "Infrastructure Catch-up",
    body: "Visible acceleration in grid expansion, generation capacity, transmission, labor pipelines, or load-management planning.",
  },
  {
    title: "Tone Shift",
    body: "Less urgent language across institutional, market, infrastructure, and international sources at the same time.",
  },
] as const;

export const ISM_FOOTER_NOTE =
  "Signals beneath the noise. Clarity without speculation.";
