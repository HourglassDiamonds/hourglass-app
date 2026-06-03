/**
 * Infrastructure Strain Index — weekly data.
 * Update values and copy here each week. Page layout is fixed in infrastructure-strain-index-view.
 */

export const ISI_UPDATED_LABEL = "Updated weekly — June 2, 2026";

export const ISI_READING = {
  score: 82,
  label: "Infrastructure Strain",
  status: "Elevated Strain",
  weeklyChange: 2,
} as const;

export const ISI_INTRO =
  "A weekly reading of the physical constraints beneath digital, economic, and industrial acceleration: power, transmission, transformers, data centers, water, skilled labor, semiconductors, and logistics. The purpose is not to predict failure. It is to track a capacity expansion race — where capital deploys quickly, buildout timing stays uneven, and flexibility narrows beneath functioning systems.";

export const ISI_SUMMARY =
  "Infrastructure strain remains elevated but orderly: a capacity expansion race, not a collapse scenario. Evidence continues accumulating around transformer constraints, utility bottlenecks, grid interconnection delays, electrical labor shortages, cooling requirements, transmission expansion, and data-center power demand. The system functions; spare capacity and flexibility narrow.";

export const ISI_WEEKLY_SIGNAL =
  "Power availability, transformer manufacturing lead times, utility responsiveness, transmission capacity, and electrical labor availability gained emphasis in the read. Data-center load growth and cooling requirements remain active, but capital continues deploying — physical coordination increasingly defines how quickly expansion converts to energized capacity.";

export const ISI_CATEGORIES = [
  {
    name: "Grid & Transmission",
    score: 83,
    state: "High",
    body: "Transmission expansion lag, interconnection queues, and utility upgrade timelines remain core strain points — limiting how quickly new load can be connected and served.",
  },
  {
    name: "Data-Center Load",
    score: 86,
    state: "High",
    body: "Hyperscale demand continues accelerating; power availability is increasingly strategic, with cooling requirements and utility responsiveness shaping siting and timelines.",
  },
  {
    name: "Transformer Supply",
    score: 84,
    state: "High",
    body: "Manufacturing lead times remain constrained — utilities and hyperscalers competing for large-unit capacity, slowing substation and interconnection work.",
  },
  {
    name: "Semiconductor Capacity",
    score: 77,
    state: "Elevated",
    body: "Advanced packaging and HBM remain tight; AI infrastructure demand is still the dominant allocator, with supply functioning but not slack.",
  },
  {
    name: "Skilled Labor",
    score: 77,
    state: "Elevated",
    body: "Electrical, utility, HVAC, and industrial construction labor shortages remain meaningful — translating capital plans into energized capacity takes longer.",
  },
  {
    name: "Water & Cooling",
    score: 74,
    state: "Rising",
    body: "Cooling load and regional water pressure are increasingly central in site-selection and community discussions — uneven by geography, rising in importance.",
  },
] as const;

export const ISI_RECENT_READINGS = [
  { week: "This Week", score: 82 },
  { week: "Last Week", score: 80 },
  { week: "2 Weeks Ago", score: 79 },
  { week: "3 Weeks Ago", score: 81 },
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
    title: "Power availability",
    body: "Hyperscale load growth, power contracts, and large-load interconnection requests — where regional power availability is becoming a strategic constraint, not only a cost input.",
  },
  {
    title: "Transformer manufacturing",
    body: "Lead times, order books, and competition between utilities and hyperscalers for large transformer capacity — a core limit on substation and interconnection work.",
  },
  {
    title: "Utility responsiveness",
    body: "How quickly utilities can process upgrades, approvals, and interconnection relative to announced data-center and industrial timelines.",
  },
  {
    title: "Transmission capacity",
    body: "Transmission limits, substation availability, and queue congestion in clusters where AI and industrial load concentrate.",
  },
  {
    title: "Cooling infrastructure",
    body: "Liquid and air-cooling requirements, facility design choices, and operational load as power density rises.",
  },
  {
    title: "Electrical labor availability",
    body: "Electricians, lineworkers, utility engineers, and industrial crews — the practical limit on how fast plans become energized capacity.",
  },
] as const;

export const ISI_WHAT_WOULD_EASE = [
  {
    title: "Faster transmission & interconnection",
    body: "Measurable progress on queues, substation upgrades, and regional transmission without implying strain has disappeared.",
  },
  {
    title: "Transformer lead-time relief",
    body: "Expanded manufacturing throughput and shorter delivery windows for large electrical equipment serving grid and data-center load.",
  },
  {
    title: "Aligned load growth",
    body: "Data-center siting, onsite generation, demand response, and efficiency gains better matched to available power and cooling capacity.",
  },
  {
    title: "Labor pipeline expansion",
    body: "Stronger electrical and utility trade throughput — training, retention, and project staffing that shorten buildout calendars.",
  },
] as const;

export const ISI_CALCULATION_ROWS = [
  {
    category: "Grid & Transmission",
    weight: "24%",
    score: "83",
    contribution: "19.9",
    reason:
      "Transmission delays, interconnection queues, and utility upgrade lag continue to slow large-load connection.",
  },
  {
    category: "Data-Center Load",
    weight: "22%",
    score: "86",
    contribution: "18.9",
    reason:
      "Accelerating hyperscale demand; power availability and cooling requirements increasingly strategic in siting and timelines.",
  },
  {
    category: "Transformer Supply",
    weight: "16%",
    score: "84",
    contribution: "13.4",
    reason:
      "Manufacturing lead times still constrained — utilities and hyperscalers competing for large-unit capacity.",
  },
  {
    category: "Semiconductor Capacity",
    weight: "14%",
    score: "77",
    contribution: "10.8",
    reason:
      "Advanced packaging and HBM remain tight; AI infrastructure demand still dominant in allocation.",
  },
  {
    category: "Skilled Labor",
    weight: "12%",
    score: "77",
    contribution: "9.2",
    reason:
      "Electrical, utility, HVAC, and industrial construction labor shortages remain a meaningful buildout limit.",
  },
  {
    category: "Water & Cooling",
    weight: "12%",
    score: "74",
    contribution: "8.9",
    reason:
      "Cooling and regional water pressure increasingly factor in site selection — uneven but rising in importance.",
  },
] as const;

export const ISI_CALCULATION_TOTAL = {
  contribution: "81.1 → 82",
  reason:
    "Elevated strain within a capacity expansion race — persistent bottlenecks in power, transformers, transmission, and labor beneath rapid capital deployment, with the system functioning but less flexible.",
} as const;

export const ISI_SOURCES = [
  {
    name: "Utility & Grid Reporting",
    body: "Transmission queues, interconnection delays, power demand, transformer availability, permitting, utility responsiveness, and regional upgrade timelines.",
  },
  {
    name: "Data-Center Reporting",
    body: "Hyperscale expansion, power contracts, cooling design, site selection, and utility coordination for large load.",
  },
  {
    name: "Semiconductor Supply Reporting",
    body: "Advanced packaging, HBM, fabrication concentration, and AI-driven allocation across chip supply chains.",
  },
  {
    name: "Construction & Labor Reporting",
    body: "Electrical and industrial labor availability, project duration, trade demand, and construction capacity.",
  },
  {
    name: "Water & Resource Reporting",
    body: "Cooling demand, drought overlap, regional water pressure, and siting friction in water-stressed areas.",
  },
] as const;

export const ISI_FOOTER_NOTE =
  "The Infrastructure Strain Index is a weekly editorial framework. It compresses physical-system constraints into a directional reading — whether growth is supported by available capacity, slowed by bottlenecks, or operating with narrowing flexibility beneath still-functioning systems.";
