/**
 * Infrastructure Strain Index — weekly data.
 * Update values and copy here each week. Page layout is fixed in infrastructure-strain-index-view.
 */

export const ISI_UPDATED_LABEL = "Updated weekly — June 20, 2026";

export const ISI_READING = {
  score: 85,
  label: "Infrastructure Strain",
  status: "Elevated Strain",
  weeklyChange: 3,
} as const;

export const ISI_INTRO =
  "A weekly reading of the physical constraints beneath digital, economic, and industrial acceleration: power, transmission, transformers, data centers, water, skilled labor, semiconductors, and logistics. The purpose is not to predict failure. It is to track a capacity expansion race — where capital deploys quickly, buildout timing stays uneven, and flexibility narrows beneath functioning systems.";

export const ISI_SUMMARY =
  "Infrastructure strain rose as World Cup logistics, Hormuz routing friction, and AI data-center power demand tested physical systems simultaneously. Transformer constraints, grid interconnection delays, and electrical labor shortages continue accumulating — the system functions, but spare capacity and flexibility narrow.";

export const ISI_WEEKLY_SIGNAL =
  "World Cup host cities became a live test of transportation, security, weather response, and information integrity. Hormuz routing friction added shipping-layer strain alongside uneven normalization. AI data-center power demand continued raising utility, grid, and siting pressure — physical coordination increasingly defines how quickly expansion converts to energized capacity.";

export const ISI_CATEGORIES = [
  {
    name: "Grid & Transmission",
    score: 85,
    state: "High",
    body: "Transmission expansion lag, interconnection queues, and utility upgrade timelines remain core strain points — with Hormuz routing friction adding shipping-layer pressure alongside grid constraints.",
  },
  {
    name: "Data-Center Load",
    score: 88,
    state: "High",
    body: "Hyperscale demand continues accelerating; power availability is increasingly strategic, with utility responsiveness and site selection shaping timelines more than chip supply alone.",
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
    score: 79,
    state: "Elevated",
    body: "Electrical, utility, HVAC, and event-security labor demand rose with World Cup logistics and industrial construction — translating capital plans into energized capacity takes longer.",
  },
  {
    name: "Water & Cooling",
    score: 74,
    state: "Rising",
    body: "Cooling load and regional water pressure are increasingly central in site-selection and community discussions — uneven by geography, rising in importance.",
  },
] as const;

export const ISI_RECENT_READINGS = [
  { week: "This Week", score: 85 },
  { week: "Last Week", score: 82 },
  { week: "2 Weeks Ago", score: 80 },
  { week: "3 Weeks Ago", score: 79 },
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
    title: "World Cup host-city strain",
    body: "Whether transportation, security, weather response, and crowd-management pressure stays localized or becomes a broader infrastructure and safety narrative.",
  },
  {
    title: "Hormuz routing normalization",
    body: "Whether shipping traffic normalizes or remains controlled, delayed, or selectively routed — with permit, insurance, and security questions still active.",
  },
  {
    title: "AI power & grid demand",
    body: "Whether data-center load growth continues raising utility responsiveness, grid interconnection, and regional siting pressure.",
  },
  {
    title: "Transformer manufacturing",
    body: "Lead times, order books, and competition between utilities and hyperscalers for large transformer capacity — a core limit on substation and interconnection work.",
  },
  {
    title: "Transmission capacity",
    body: "Transmission limits, substation availability, and queue congestion in clusters where AI and industrial load concentrate.",
  },
  {
    title: "Electrical labor availability",
    body: "Electricians, lineworkers, utility engineers, and industrial crews — the practical limit on how fast plans become energized capacity.",
  },
] as const;

export const ISI_WHAT_WOULD_EASE = [
  {
    title: "Hormuz traffic normalization",
    body: "Measurable progress on routing, permits, insurance, and security without implying strain has disappeared.",
  },
  {
    title: "Event logistics stabilization",
    body: "World Cup transit and security pressure remaining localized rather than broadening into wider infrastructure narrative.",
  },
  {
    title: "Transformer lead-time relief",
    body: "Expanded manufacturing throughput and shorter delivery windows for large electrical equipment serving grid and data-center load.",
  },
  {
    title: "Aligned load growth",
    body: "Data-center siting, onsite generation, demand response, and efficiency gains better matched to available power and cooling capacity.",
  },
] as const;

export const ISI_CALCULATION_ROWS = [
  {
    category: "Grid & Transmission",
    weight: "24%",
    score: "85",
    contribution: "20.4",
    reason:
      "Transmission delays, interconnection queues, Hormuz routing friction, and utility upgrade lag continue to slow large-load connection.",
  },
  {
    category: "Data-Center Load",
    weight: "22%",
    score: "88",
    contribution: "19.4",
    reason:
      "Accelerating hyperscale demand; power availability, utility responsiveness, and site selection increasingly strategic.",
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
    score: "79",
    contribution: "9.5",
    reason:
      "World Cup logistics and industrial construction elevated labor demand — electrical and utility trades remain a meaningful buildout limit.",
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
  contribution: "82.4 → 85",
  reason:
    "Elevated strain from World Cup logistics, Hormuz routing friction, and AI grid demand — persistent bottlenecks in power, transformers, and transmission beneath functioning systems with narrowing flexibility.",
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
    name: "Event & Transit Reporting",
    body: "World Cup transportation, security, weather response, crowd management, and host-city infrastructure capacity.",
  },
  {
    name: "Shipping & Energy Reporting",
    body: "Hormuz routing, permit and insurance conditions, energy corridor normalization, and sanctions-related flow shifts.",
  },
  {
    name: "Construction & Labor Reporting",
    body: "Electrical and industrial labor availability, project duration, trade demand, and construction capacity.",
  },
] as const;

export const ISI_FOOTER_NOTE =
  "The Infrastructure Strain Index is a weekly editorial framework. It compresses physical-system constraints into a directional reading — whether growth is supported by available capacity, slowed by bottlenecks, or operating with narrowing flexibility beneath still-functioning systems.";
