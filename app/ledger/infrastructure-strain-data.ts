/**
 * Infrastructure Strain Index — weekly data.
 * Update values and copy here each week. Page layout is fixed in infrastructure-strain-index-view.
 */

export const ISI_UPDATED_LABEL = "Updated weekly — July 20, 2026";

export const ISI_READING = {
  score: 87,
  label: "Infrastructure Strain",
  status: "Elevated Strain",
  weeklyChange: 0,
} as const;

export const ISI_INTRO =
  "A weekly reading of the physical constraints beneath digital, economic, and industrial acceleration: power, transmission, transformers, data centers, water, skilled labor, semiconductors, and logistics. The purpose is not to predict failure. It is to track a capacity expansion race — where capital deploys quickly, buildout timing stays uneven, and flexibility narrows beneath functioning systems.";

export const ISI_SUMMARY =
  "Strain remains elevated after PJM's early-July record peak and a mid-July hot-weather window that included Maximum Generation alerts and DOE Order 202-26-35 (July 14–21). No publicly confirmed broad blackout was found in the reviewed evidence; large-load and backup-generation flexibility remains a live concern beneath functioning systems.";

export const ISI_WEEKLY_SIGNAL =
  "PJM's early-July preliminary all-time peak near 168 GW remains the summer benchmark. For July 14–17, PJM issued a Hot Weather Alert and Maximum Generation / Load Management alerts around elevated forecast peaks; DOE Order 202-26-35, effective July 14 through July 21, again authorized temporary environmental-permit flexibility for specified units and large-load backup-generation direction as a last resort. Publicly reviewed evidence does not show a confirmed broad blackout during that window; whether backup generation was dispatched is not stated here as a settled negative absent primary confirmation. Structural tightness remains: interconnection, transformers, and large-load integration still limit spare capacity. Systems continue to function; strain does not fall simply because an alert window was managed without a confirmed blackout.";

export const ISI_CATEGORIES = [
  {
    name: "Grid & Transmission",
    score: 87,
    state: "High",
    body: "Early-July emergency demand response and the mid-July Hot Weather and Maximum Generation alert window proved the system can clear elevated load under preparedness procedures, but spare capacity remains thin — DOE Order 202-26-35 through July 21 keeps operational readiness elevated beneath unresolved interconnection and large-load constraints.",
  },
  {
    name: "Data-Center Load",
    score: 90,
    state: "High",
    body: "Hyperscale demand remains strategically coupled to grid readiness — siting, power availability, and concern about large-load backup-generation flexibility still set practical pace after successive summer heat windows.",
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
    body: "Summer heat keeps cooling load relevant in reliability discussions — uneven by geography, with operational relevance sustained through the mid-July alert window.",
  },
] as const;

export const ISI_RECENT_READINGS = [
  { week: "This Week", score: 87 },
  { week: "Last Week", score: 87 },
  { week: "2 Weeks Ago", score: 87 },
  { week: "3 Weeks Ago", score: 86 },
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
    title: "PJM summer reliability",
    body: "Whether spare capacity remains thin through the rest of summer, and whether future heat events require escalation beyond the mid-July alert posture.",
  },
  {
    title: "DOE order and large-load flexibility",
    body: "How DOE Order 202-26-35 is used through its July 21 window, and whether large-load backup-generation authority is exercised under primary reporting.",
  },
  {
    title: "FERC large-load integration",
    body: "Whether regional grid operator responses by August accelerate data-center cost, siting, and interconnection debates.",
  },
  {
    title: "World Cup operational load",
    body: "Whether transportation, security, and crowd-management pressure stays localized through the knockout stage.",
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
    title: "Heat moderation without recurrence",
    body: "Sustained relief from elevated summer alerts without implying spare capacity has returned to comfortable levels.",
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
    score: "87",
    contribution: "20.9",
    reason:
      "Early-July peak and mid-July Hot Weather / Maximum Generation alerts managed without a publicly confirmed broad blackout; thin spare capacity and DOE Order 202-26-35 keep strain elevated.",
  },
  {
    category: "Data-Center Load",
    weight: "22%",
    score: "90",
    contribution: "19.8",
    reason:
      "Hyperscale demand remains strategically coupled to grid readiness, large-load integration, and backup-generation flexibility under summer alerts.",
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
      "Summer heat keeps cooling load relevant in reliability discussions through successive July alert windows.",
  },
] as const;

export const ISI_CALCULATION_TOTAL = {
  contribution: "84.4 → 87",
  reason:
    "Elevated strain holds after a managed early-July peak and a mid-July hot-weather alert window under DOE Order 202-26-35 — flexibility narrowing beneath still-functioning systems.",
} as const;

export const ISI_SOURCES = [
  {
    name: "Utility & Grid Reporting",
    body: "PJM operations updates, Hot Weather and Maximum Generation alerts, DOE Order 202-26-35, FERC large-load rules, transmission queues, interconnection delays, and regional upgrade timelines.",
  },
  {
    name: "Data-Center Reporting",
    body: "Hyperscale expansion, power contracts, backup generation, cooling design, site selection, and utility coordination for large load.",
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
