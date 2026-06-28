/**
 * Infrastructure Strain Index — weekly data.
 * Update values and copy here each week. Page layout is fixed in infrastructure-strain-index-view.
 */

export const ISI_UPDATED_LABEL = "Updated weekly — June 28, 2026";

export const ISI_READING = {
  score: 86,
  label: "Infrastructure Strain",
  status: "Elevated Strain",
  weeklyChange: 1,
} as const;

export const ISI_INTRO =
  "A weekly reading of the physical constraints beneath digital, economic, and industrial acceleration: power, transmission, transformers, data centers, water, skilled labor, semiconductors, and logistics. The purpose is not to predict failure. It is to track a capacity expansion race — where capital deploys quickly, buildout timing stays uneven, and flexibility narrows beneath functioning systems.";

export const ISI_SUMMARY =
  "Strain rose modestly as large-load grid integration became policy-visible through FERC action, while shipping friction, summer heat risk, and sustained World Cup logistics load continue beneath functioning systems — flexibility narrows.";

export const ISI_WEEKLY_SIGNAL =
  "FERC directed regional grid operators to revise large-load integration rules — data-center power demand became more policy-visible. Hormuz routing friction added shipping-layer strain. World Cup host cities sustained operational load across transit and security. Early-summer heat assessments flag elevated reliability watch items — systems function, but spare capacity narrows.";

export const ISI_CATEGORIES = [
  {
    name: "Grid & Transmission",
    score: 86,
    state: "High",
    body: "FERC large-load order made grid integration policy-visible — interconnection queues, connection costs, and utility upgrade timelines remain core strain points alongside Hormuz routing friction.",
  },
  {
    name: "Data-Center Load",
    score: 89,
    state: "High",
    body: "Hyperscale demand continues accelerating; large-load integration rules and power availability increasingly shape siting and timelines more than chip supply alone.",
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
    body: "Electrical, utility, HVAC, and event-security labor demand sustained by World Cup logistics and industrial construction — translating capital plans into energized capacity takes longer.",
  },
  {
    name: "Water & Cooling",
    score: 75,
    state: "Rising",
    body: "Early-summer heat assessments and cooling load increasingly factor in site-selection and reliability discussions — uneven by geography, rising in importance.",
  },
] as const;

export const ISI_RECENT_READINGS = [
  { week: "This Week", score: 86 },
  { week: "Last Week", score: 85 },
  { week: "2 Weeks Ago", score: 82 },
  { week: "3 Weeks Ago", score: 80 },
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
    title: "FERC large-load integration",
    body: "Whether regional grid operator responses within the 60-day window accelerate data-center cost, siting, and interconnection debates.",
  },
  {
    title: "Hormuz routing friction",
    body: "Whether shipping traffic stabilizes or continues thinning — with permit, insurance, and security questions still active.",
  },
  {
    title: "World Cup operational load",
    body: "Whether transportation, security, and crowd-management pressure stays localized or broadens as the tournament progresses.",
  },
  {
    title: "Summer heat & reliability",
    body: "Early-summer heat risk on transmission and cooling — reliability watch items entering active season.",
  },
  {
    title: "Transformer manufacturing",
    body: "Lead times, order books, and competition between utilities and hyperscalers for large transformer capacity.",
  },
  {
    title: "Electrical labor availability",
    body: "Electricians, lineworkers, utility engineers, and industrial crews — the practical limit on how fast plans become energized capacity.",
  },
] as const;

export const ISI_WHAT_WOULD_EASE = [
  {
    title: "Hormuz traffic stabilization",
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
    score: "86",
    contribution: "20.6",
    reason:
      "FERC large-load order made grid integration policy-visible; interconnection queues and utility upgrade lag continue to slow large-load connection.",
  },
  {
    category: "Data-Center Load",
    weight: "22%",
    score: "89",
    contribution: "19.6",
    reason:
      "Accelerating hyperscale demand; large-load rules and power availability increasingly strategic for siting and timelines.",
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
      "World Cup logistics and industrial construction sustained labor demand — electrical and utility trades remain a meaningful buildout limit.",
  },
  {
    category: "Water & Cooling",
    weight: "12%",
    score: "75",
    contribution: "9.0",
    reason:
      "Early-summer heat and cooling load increasingly factor in site selection and reliability — uneven but rising in importance.",
  },
] as const;

export const ISI_CALCULATION_TOTAL = {
  contribution: "83.2 → 86",
  reason:
    "Elevated strain from policy-visible grid constraints, Hormuz routing friction, sustained event logistics, and early-summer heat watch — flexibility narrowing beneath functioning systems.",
} as const;

export const ISI_SOURCES = [
  {
    name: "Utility & Grid Reporting",
    body: "FERC large-load rules, transmission queues, interconnection delays, power demand, transformer availability, permitting, and regional upgrade timelines.",
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
    body: "Hormuz routing, permit and insurance conditions, corridor confidence, and sanctions-related flow shifts.",
  },
  {
    name: "Construction & Labor Reporting",
    body: "Electrical and industrial labor availability, project duration, trade demand, and construction capacity.",
  },
] as const;

export const ISI_FOOTER_NOTE =
  "The Infrastructure Strain Index is a weekly editorial framework. It compresses physical-system constraints into a directional reading — whether growth is supported by available capacity, slowed by bottlenecks, or operating with narrowing flexibility beneath still-functioning systems.";
