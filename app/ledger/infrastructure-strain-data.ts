/**
 * Infrastructure Strain Index — weekly data.
 * Update values and copy here each week. Page layout is fixed in infrastructure-strain-index-view.
 */

export const ISI_UPDATED_LABEL = "Updated weekly — May 19, 2026";

export const ISI_READING = {
  score: 82,
  label: "Infrastructure Strain",
  status: "Elevated Strain",
  weeklyChange: 4,
} as const;

export const ISI_INTRO =
  "A weekly reading of the physical constraints beneath digital, economic, and industrial acceleration: power, transmission, transformers, data centers, water, skilled labor, semiconductors, and logistics. The purpose is not to predict failure. It is to show when the systems supporting modern growth are losing flexibility.";

export const ISI_SUMMARY =
  "The physical layer of the system is under elevated strain. AI data-center expansion, grid interconnection delays, transformer shortages, cooling demand, semiconductor bottlenecks, and skilled labor constraints are reinforcing one another. The system is still functioning, but the margin for fast expansion is narrowing.";

export const ISI_WEEKLY_SIGNAL =
  "The reading moved higher because data-center power demand, transformer lead times, grid labor shortages, and cooling requirements are now appearing together in infrastructure reporting. The limiting factor is no longer just capital or software capability. It is physical capacity.";

export const ISI_CATEGORIES = [
  {
    name: "Grid & Transmission",
    score: 86,
    state: "High",
    body: "Transmission queues, substation upgrades, transformer availability, and summer electricity demand remain the core strain points.",
  },
  {
    name: "Data-Center Load",
    score: 91,
    state: "Critical",
    body: "Hyperscaler expansion, power contracts, cooling load, and regional utility pressure continue to accelerate.",
  },
  {
    name: "Transformer Supply",
    score: 88,
    state: "High",
    body: "Long lead times and limited manufacturing capacity continue to slow grid expansion and large-load interconnection.",
  },
  {
    name: "Semiconductor Capacity",
    score: 80,
    state: "Elevated",
    body: "Advanced packaging, HBM, fabrication concentration, and chip demand remain tight but not fully constrained.",
  },
  {
    name: "Skilled Labor",
    score: 78,
    state: "Elevated",
    body: "Electricians, line workers, utility engineers, and industrial construction labor remain a quiet but important bottleneck.",
  },
  {
    name: "Water & Cooling",
    score: 74,
    state: "Rising",
    body: "Cooling demand, drought overlap, and regional water constraints are becoming more relevant to data-center and industrial siting.",
  },
] as const;

export const ISI_RECENT_READINGS = [
  { week: "This Week", score: 82 },
  { week: "Last Week", score: 78 },
  { week: "2 Weeks Ago", score: 75 },
  { week: "3 Weeks Ago", score: 72 },
] as const;

export const ISI_BENCHMARKS = [
  { name: "Stable Buildout", score: 45, note: "Low constraint", tier: "quiet" as const },
  { name: "Post-Covid Construction Cycle", score: 68, note: "Supply tightness", tier: "mid" as const },
  { name: "Energy Crunch", score: 84, note: "Europe 2022", tier: "high" as const },
  { name: "Supply Chain Shock", score: 88, note: "2020–21", tier: "high" as const },
  { name: "Wartime Industrial Surge", score: 91, note: "Forced capacity", tier: "high" as const },
];

export const ISI_WHAT_WATCHING = [
  {
    title: "Power interconnection",
    body: "Large-load connection timelines, utility approval delays, substation availability, and queue congestion.",
  },
  {
    title: "Transformer lead times",
    body: "Whether transformer manufacturing capacity improves quickly enough to support grid, industrial, and data-center expansion.",
  },
  {
    title: "Data-center concentration",
    body: "Regional clustering of hyperscale demand in areas where water, power, and transmission capacity are already tight.",
  },
  {
    title: "Skilled labor availability",
    body: "Electricians, linemen, engineers, and industrial construction crews remain essential to translating capital plans into real capacity.",
  },
] as const;

export const ISI_WHAT_WOULD_EASE = [
  {
    title: "Faster grid expansion",
    body: "Clear acceleration in transmission, generation, substations, interconnection processing, and utility planning.",
  },
  {
    title: "Transformer relief",
    body: "Shorter lead times, expanded domestic manufacturing, and improved availability of large electrical equipment.",
  },
  {
    title: "Better load management",
    body: "More flexible data-center siting, demand response, onsite generation, and efficiency improvements.",
  },
  {
    title: "Water-aware siting",
    body: "Stronger alignment between cooling demand, local water availability, drought exposure, and community pressure.",
  },
] as const;

export const ISI_CALCULATION_ROWS = [
  {
    category: "Grid & Transmission",
    weight: "24%",
    score: "86",
    contribution: "20.6",
    reason:
      "Grid queues, transmission bottlenecks, substation upgrades, and summer load remain major constraints.",
  },
  {
    category: "Data-Center Load",
    weight: "22%",
    score: "91",
    contribution: "20.0",
    reason:
      "AI and cloud expansion are increasing power demand, cooling requirements, and regional utility pressure.",
  },
  {
    category: "Transformer Supply",
    weight: "16%",
    score: "88",
    contribution: "14.1",
    reason:
      "Long lead times and limited manufacturing capacity remain one of the most important physical bottlenecks.",
  },
  {
    category: "Semiconductor Capacity",
    weight: "14%",
    score: "80",
    contribution: "11.2",
    reason:
      "Advanced chips, HBM, packaging, and fabrication concentration remain tight but still functioning.",
  },
  {
    category: "Skilled Labor",
    weight: "12%",
    score: "78",
    contribution: "9.4",
    reason:
      "Labor availability is constraining the speed of grid, utility, and industrial buildout.",
  },
  {
    category: "Water & Cooling",
    weight: "12%",
    score: "74",
    contribution: "8.9",
    reason:
      "Cooling demand and regional water stress are becoming more important but remain uneven by location.",
  },
] as const;

export const ISI_SOURCES = [
  {
    name: "Utility & Grid Reporting",
    body: "Used for transmission queues, interconnection delays, power demand, transformer availability, and summer load planning.",
  },
  {
    name: "Data-Center Reporting",
    body: "Used for hyperscaler expansion, power contracts, cooling demand, site selection, and regional infrastructure pressure.",
  },
  {
    name: "Semiconductor Supply Reporting",
    body: "Used for advanced packaging, HBM, fabrication concentration, chip demand, and supply-chain constraints.",
  },
  {
    name: "Construction & Labor Reporting",
    body: "Used for skilled labor shortages, industrial construction capacity, electrical trade demand, and project timelines.",
  },
  {
    name: "Water & Resource Reporting",
    body: "Used for drought overlap, cooling demand, regional water pressure, and industrial siting constraints.",
  },
] as const;

export const ISI_FOOTER_NOTE =
  "The Infrastructure Strain Index is a weekly editorial framework. It compresses physical-system constraints into a directional reading so readers can understand whether growth is supported by available capacity, slowed by bottlenecks, or approaching structural constraint.";
