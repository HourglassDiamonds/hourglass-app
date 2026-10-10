import {
  LEDGER_METHODOLOGY_VERSION,
  type LedgerEvidenceSource,
  type LedgerMonitorSnapshot,
} from "./ledger-monitor-framework";

export const BUFFER_HEALTH_EVIDENCE_CUTOFF = "October 10, 2026";

export const SYSTEMS_FUNCTIONING_BUFFER_QUALIFIER =
  "Systems remain functional, but reserve capacity is uneven and thinning; energy buffers are low.";

export const BUFFER_RESERVE_STATES = [
  "Full",
  "Healthy",
  "Thinning",
  "Low",
  "Critical",
] as const;

export type BufferReserveState =
  | (typeof BUFFER_RESERVE_STATES)[number]
  | "Unassessed";

export type BufferEvidenceLabel =
  | "Observed"
  | "Estimated"
  | "Forecast"
  | "Provisional"
  | "Lagged";

export type BufferEvidenceSource = LedgerEvidenceSource & {
  evidenceLabel: BufferEvidenceLabel;
  dataPeriod: string;
};

export type BufferDomainId =
  | "households"
  | "labor"
  | "food"
  | "energy"
  | "grid"
  | "financial-system";

export type BufferDomain = {
  id: BufferDomainId;
  label: string;
  definition: string;
  reserveState: BufferReserveState;
  confidence: string;
  sources: readonly BufferEvidenceSource[];
  lastUpdated: string;
  escalationCriteria: readonly string[];
  easingCriteria: readonly string[];
  rationale: string;
};

export type BufferHealthHistoricalSnapshot = {
  reviewDate: string;
  evidenceCutoff: string;
  domains: readonly {
    id: BufferDomainId;
    label: string;
    reserveState: BufferReserveState;
  }[];
};

export const BUFFER_HEALTH_GUARDRAILS = {
  systemTemperatureWeight: null,
  automaticDegreeConversion: false,
  mayInformFunctioningReview: true,
  rule:
    "Buffer Health can inform an editorial review of Systems Functioning, but it cannot add degrees or act as a sixth System Temperature channel.",
} as const;

export const BUFFER_HEALTH_DOMAINS: readonly BufferDomain[] = [
  {
    id: "households",
    label: "Households",
    definition:
      "Capacity for households to absorb additional price, rate, income, and debt-service pressure without widespread loss of normal function.",
    reserveState: "Thinning",
    confidence: "Moderate",
    lastUpdated: BUFFER_HEALTH_EVIDENCE_CUTOFF,
    rationale:
      "The August saving rate was 4.1% and real disposable income was flat while concentrated credit-card and auto stress persisted. Employment and consumption remain functional, and aggregate household-debt performance has not broken.",
    escalationCriteria: [
      "The saving rate remains below roughly 3.5% across multiple releases while real disposable income contracts",
      "Serious delinquency broadens across cards, autos, and mortgages",
      "Higher continuing claims materially weaken household cash flow",
    ],
    easingCriteria: [
      "Real disposable income persistently outgrows consumption",
      "The saving rate rebuilds toward 5% or higher",
      "Credit-card and auto delinquency flows stabilize or decline",
    ],
    sources: [
      {
        institution: "BEA",
        title: "Personal Income and Outlays, August 2026",
        date: "September 30, 2026",
        dataPeriod: "August 2026",
        evidenceLabel: "Observed",
        url: "https://www.bea.gov/news/2026/personal-income-and-outlays-august-2026",
        supports:
          "4.1% saving rate, flat real disposable income, and continued real consumption growth.",
      },
      {
        institution: "New York Fed",
        title: "Quarterly Report on Household Debt and Credit, 2026 Q2",
        date: "August 11, 2026",
        dataPeriod: "Second quarter 2026",
        evidenceLabel: "Lagged",
        url: "https://www.newyorkfed.org/newsevents/news/research/2026/20260811",
        supports:
          "Aggregate debt and delinquency remained orderly while card and auto stress stayed concentrated.",
      },
    ],
  },
  {
    id: "labor",
    label: "Labor",
    definition:
      "Capacity in employment, hours, hiring, and worker mobility to absorb a further slowdown or sector shock.",
    reserveState: "Thinning",
    confidence: "Moderate-high",
    lastUpdated: BUFFER_HEALTH_EVIDENCE_CUTOFF,
    rationale:
      "September payrolls rose only 29,000, the 12-month average slowed to 45,000, and July was revised into contraction. Unemployment, participation, hours, and weekly claims remain stable enough to show a slowdown rather than a labor-system break.",
    escalationCriteria: [
      "Unemployment and continuing claims rise together",
      "Payroll growth becomes persistently negative or near zero",
      "Hiring and average hours contract across multiple sectors",
    ],
    easingCriteria: [
      "Participation and hiring breadth improve",
      "Payroll gains broaden while unemployment remains stable",
      "Quits and worker mobility strengthen without renewed wage-price pressure",
    ],
    sources: [
      {
        institution: "BLS",
        title: "Employment Situation, September 2026",
        date: "October 2, 2026",
        dataPeriod: "September 2026",
        evidenceLabel: "Provisional",
        url: "https://www.bls.gov/news.release/archives/empsit_10022026.htm",
        supports:
          "Payrolls rose 29,000, unemployment was 4.2%, participation was 61.8%, hours were stable, the 12-month payroll average slowed to 45,000, and July was revised to a 10,000 decline.",
      },
      {
        institution: "BLS",
        title: "Employment Situation, August 2026",
        date: "September 4, 2026",
        dataPeriod: "August 2026",
        evidenceLabel: "Provisional",
        url: "https://www.bls.gov/news.release/archives/empsit_09042026.htm",
        supports:
          "4.1% unemployment, 162,000 payroll gain, low but softer participation, and stable hours.",
      },
      {
        institution: "BLS",
        title: "Job Openings and Labor Turnover Survey, August 2026",
        date: "September 29, 2026",
        dataPeriod: "August 2026",
        evidenceLabel: "Provisional",
        url: "https://www.bls.gov/news.release/jolts.htm",
        supports:
          "Job openings, hiring, quits, and layoffs were restrained but showed little broad deterioration.",
      },
      {
        institution: "Department of Labor",
        title: "Unemployment Insurance Weekly Claims",
        date: "October 8, 2026",
        dataPeriod: "Week ending October 3, 2026",
        evidenceLabel: "Provisional",
        url: "https://www.dol.gov/index.php/newsroom/releases?agency=39&state=All&topic=All&year=all",
        supports:
          "Initial claims were 197,000 and the four-week average was 198,000, remaining low despite slower payroll growth.",
      },
      {
        institution: "Department of Labor",
        title: "Unemployment Insurance Weekly Claims",
        date: "October 1, 2026",
        dataPeriod: "Weeks ending September 19 and September 26, 2026",
        evidenceLabel: "Provisional",
        url: "https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20261543.pdf",
        supports:
          "Initial and continuing claims remained low, with declining four-week averages.",
      },
    ],
  },
  {
    id: "food",
    label: "Food",
    definition:
      "Capacity in staple inventories, harvest recovery, inputs, trade, and logistics to absorb another production or distribution shock.",
    reserveState: "Thinning",
    confidence: "Moderate",
    lastUpdated: BUFFER_HEALTH_EVIDENCE_CUTOFF,
    rationale:
      "September food prices rose as weather and transport disruption lifted cereals, while the 2026 global cereal crop is still forecast to be the second largest on record. The balance shows thinning price and logistics slack without a verified physical shortage.",
    escalationCriteria: [
      "Wheat and rice stocks decline into a second weak harvest cycle",
      "Corn also turns lower or major exporters impose restrictions",
      "Fertilizer or corridor disruption produces verified physical shortages",
    ],
    easingCriteria: [
      "Wheat and rice stocks-to-use rebuild across subsequent harvests",
      "Corn strength broadens into a global cereal inventory rebuild",
      "Fertilizer supply and major grain corridors normalize",
    ],
    sources: [
      {
        institution: "FAO",
        title: "FAO Food Price Index rises in September amid weather concerns and transport disruptions",
        date: "October 2, 2026",
        dataPeriod: "September 2026",
        evidenceLabel: "Observed",
        url: "https://www.fao.org/newsroom/detail/fao-food-price-index-rises-in-september-amid-weather-concerns-and-transport-disruptions/en",
        supports:
          "The index rose 1.5% month over month and 5.8% year over year; cereal prices rose 5.1%, while projected 2026 cereal output remained the second largest on record.",
      },
      {
        institution: "USDA NASS",
        title: "Grain Stocks and Small Grains Annual Summary",
        date: "September 30, 2026",
        dataPeriod: "September 1 stocks and 2026 harvest estimates",
        evidenceLabel: "Observed",
        url: "https://www.nass.usda.gov/Newsroom/2026/09-30-2026.php",
        supports:
          "U.S. corn stocks were 35% higher year over year while wheat stocks and production were lower.",
      },
      {
        institution: "USDA ERS",
        title: "Rice Market Outlook",
        date: "September 18, 2026",
        dataPeriod: "2026/27 marketing year",
        evidenceLabel: "Forecast",
        url: "https://www.ers.usda.gov/topics/crops/rice/market-outlook",
        supports:
          "U.S. rice begins with a large inherited buffer but is forecast to draw stocks materially.",
      },
      {
        institution: "FAO",
        title: "Cereal Supply and Demand Brief",
        date: "September 2026",
        dataPeriod: "2026/27 global balances",
        evidenceLabel: "Forecast",
        url: "https://www.fao.org/worldfoodsituation/csdb/en",
        supports:
          "Global cereal stocks-to-use remains meaningful even as rice draws and coarse-grain rebuilding weakens.",
      },
      {
        institution: "FAO",
        title: "Rome Coalition for Fertilizer Access and Food Security statement",
        date: "September 24, 2026",
        dataPeriod: "Current disruption as of September 2026",
        evidenceLabel: "Observed",
        url: "https://www.fao.org/director-general/speeches/details/unga-81-2nd-ministerial-meeting-of-the-rome-coalition-for-fertilizer-access-and-food-security-statement/en",
        supports:
          "Fertilizer prices, trade delays, and Gulf corridor exposure are pressure signals, not proof of food shortage.",
      },
    ],
  },
  {
    id: "energy",
    label: "Energy",
    definition:
      "Spare production, inventory, routing, refining, and demand flexibility available to absorb another energy-supply shock.",
    reserveState: "Low",
    confidence: "High",
    lastUpdated: BUFFER_HEALTH_EVIDENCE_CUTOFF,
    rationale:
      "Large oil inventory draws, limited effective spare production, weak refined-product inventories, and constrained routing leave little additional slack. September brought partial pipeline, Yanbu, and Hormuz-flow recovery, but prices and inventory draws remain elevated; those counterbuffers keep the state above Critical without restoring normal reserve.",
    escalationCriteria: [
      "Restored bypass flows fail again while Hormuz traffic deteriorates",
      "Crude and refined-product inventories continue drawing materially",
      "Physical shortages or forced demand destruction become visible",
    ],
    easingCriteria: [
      "Yanbu and East-West Pipeline flows remain normalized",
      "Hormuz traffic recovers materially and inventories rebuild for several months",
      "Usable spare production capacity is restored",
    ],
    sources: [
      {
        institution: "EIA",
        title: "Short-Term Energy Outlook — October 2026",
        date: "October 6, 2026",
        dataPeriod: "September 2026 and fourth-quarter outlook",
        evidenceLabel: "Estimated",
        url: "https://www.eia.gov/outlooks/steo/report/",
        supports:
          "September Brent averaged $114, regional shut-ins eased and bypass shipments improved, but third-quarter inventories drew sharply and East Coast distillate stocks remained well below normal.",
      },
      {
        institution: "IEA",
        title: "Oil Market Report — September 2026",
        date: "September 11, 2026",
        dataPeriod: "August 2026 and 2026 outlook",
        evidenceLabel: "Estimated",
        url: "https://www.iea.org/reports/oil-market-report-september-2026",
        supports:
          "Large inventory draws, constrained refining and routing, and very limited effective OPEC+ spare capacity.",
      },
      {
        institution: "EIA",
        title: "Weekly Petroleum Status Report",
        date: "September 30, 2026",
        dataPeriod: "Week ending September 25, 2026",
        evidenceLabel: "Provisional",
        url: "https://www.eia.gov/petroleum/supply/weekly/pdf/table1.pdf",
        supports:
          "Weak gasoline and distillate inventories alongside strong U.S. crude production.",
      },
      {
        institution: "EIA",
        title: "September 2026 Short-Term Energy Outlook",
        date: "September 9, 2026",
        dataPeriod: "2026–27 outlook",
        evidenceLabel: "Forecast",
        url: "https://www.eia.gov/pressroom/releases/press592.php",
        supports:
          "Improving U.S. natural-gas storage and continued domestic production growth.",
      },
      {
        institution: "Seatrade Maritime News",
        title: "Saudi resumes loadings in Yanbu",
        date: "September 30, 2026",
        dataPeriod:
          "Pipeline restart and satellite observations through September 27, 2026",
        evidenceLabel: "Observed",
        url: "https://www.seatrade-maritime.com/tankers/saudi-resumes-loadings-in-yanbu-dht-fixes-vlcc-for-55m",
        supports:
          "East-West Pipeline operations and Yanbu loadings resumed, restoring part of the routing buffer.",
      },
    ],
  },
  {
    id: "grid",
    label: "Grid",
    definition:
      "Operational and planning margin available to absorb additional load, outages, weather, and interconnection demand.",
    reserveState: "Thinning",
    confidence: "Moderate",
    lastUpdated: BUFFER_HEALTH_EVIDENCE_CUTOFF,
    rationale:
      "Seasonal emergency orders expired without national grid failure, but large computational loads remain a formal planning and operating challenge. Standards work and enhanced fuel-assurance analysis show active adaptation inside still-thinning structural margin.",
    escalationCriteria: [
      "Emergency interventions recur outside exceptional weather",
      "Firm capacity and transmission persistently lag load growth",
      "Reserve shortfalls spread across multiple regions",
    ],
    easingCriteria: [
      "Seasonal peaks pass without emergency orders",
      "Firm capacity and transmission additions are demonstrated",
      "Flexible large loads provide verified demand response",
    ],
    sources: [
      {
        institution: "NERC",
        title: "North American Collaboration, Large Loads, Standards Key Topics at Board Meeting",
        date: "October 8, 2026",
        dataPeriod: "October 2026 reliability planning",
        evidenceLabel: "Observed",
        url: "https://www.nerc.com/newsroom/north-american-collaboration-large-loads-standards-key-topics-at-board-meeting",
        supports:
          "Large loads remain a grid planning and operations challenge while reliability assessments add fuel and pipeline analysis.",
      },
      {
        institution: "NERC",
        title: "2026 Summer Reliability Assessment",
        date: "May 19, 2026",
        dataPeriod: "Summer 2026 planning outlook",
        evidenceLabel: "Forecast",
        url: "https://www.nerc.com/globalassets/our-work/assessments/nerc_sra_2026.pdf",
        supports:
          "National and SERC-East planning adequacy remained intact, including under modeled mitigations.",
      },
      {
        institution: "Department of Energy",
        title: "Energy Secretary Secures Carolinas Grid Amidst Hot Weather Conditions",
        date: "September 19, 2026",
        dataPeriod: "Emergency authority from September 18–21, 2026",
        evidenceLabel: "Observed",
        url: "https://www.energy.gov/articles/energy-secretary-secures-carolinas-grid-amidst-hot-weather-conditions",
        supports:
          "A repeat Carolinas reliability intervention occurred and then expired without national grid failure.",
      },
      {
        institution: "EIA",
        title: "EIA expects record electricity generation in 2026 and 2027",
        date: "September 9, 2026",
        dataPeriod: "2026–27 outlook",
        evidenceLabel: "Forecast",
        url: "https://www.eia.gov/pressroom/releases/press592.php",
        supports:
          "Record generation and load growth driven partly by data centers and manufacturing.",
      },
    ],
  },
  {
    id: "financial-system",
    label: "Financial system",
    definition:
      "Liquidity, funding, credit, and balance-sheet capacity available to absorb additional market or economic stress.",
    reserveState: "Healthy",
    confidence: "Moderate",
    lastUpdated: BUFFER_HEALTH_EVIDENCE_CUTOFF,
    rationale:
      "Long yields remain elevated, and household and commercial-real-estate vulnerabilities persist. High-yield spreads widened from late September but remained contained, with no verified funding or credit seizure.",
    escalationCriteria: [
      "Corporate spreads widen persistently and financial-stress indexes rise above normal",
      "Bank funding or money markets show confirmed dysfunction",
      "Household or commercial-real-estate losses materially impair capital or credit availability",
    ],
    easingCriteria: [
      "Long-term real yields decline without a growth or funding shock",
      "Bank funding and credit spreads remain stable",
      "Household and commercial-real-estate loss absorption stays orderly",
    ],
    sources: [
      {
        institution: "U.S. Treasury",
        title: "Daily Treasury Par Yield Curve Rates",
        date: "October 9, 2026",
        dataPeriod: "October 9, 2026",
        evidenceLabel: "Observed",
        url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value=2026&field_tdr_date_value_month=202610&type=daily_treasury_yield_curve",
        supports:
          "The 10-year yield remained elevated at 5.24%, preserving financing and duration pressure.",
      },
      {
        institution: "St. Louis Fed / ICE",
        title: "ICE BofA US High Yield Index Option-Adjusted Spread",
        date: "October 8, 2026",
        dataPeriod: "Daily through October 8, 2026",
        evidenceLabel: "Observed",
        url: "https://fred.stlouisfed.org/data/BAMLH0A0HYM2",
        supports:
          "The spread was 3.15 percentage points, wider than late September but still contained rather than seizure-level.",
      },
      {
        institution: "U.S. Treasury",
        title: "Daily Treasury Par Yield Curve Rates",
        date: "September 30, 2026",
        dataPeriod: "September 30, 2026",
        evidenceLabel: "Observed",
        url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value=2026&type=daily_treasury_yield_curve",
        supports:
          "Elevated nominal long yields remain a material financing and duration vulnerability.",
      },
      {
        institution: "St. Louis Fed / ICE",
        title: "ICE BofA US High Yield Index Option-Adjusted Spread",
        date: "September 24, 2026",
        dataPeriod: "Daily through September 24, 2026",
        evidenceLabel: "Observed",
        url: "https://fred.stlouisfed.org/data/BAMLH0A0HYM2",
        supports: "Corporate credit spreads remained contained.",
      },
      {
        institution: "St. Louis Fed",
        title: "St. Louis Fed Financial Stress Index",
        date: "September 23, 2026",
        dataPeriod: "Week ending September 18, 2026",
        evidenceLabel: "Lagged",
        url: "https://fred.stlouisfed.org/series/STLFSI4",
        supports:
          "Measured financial stress remained below its normal reference level.",
      },
      {
        institution: "New York Fed",
        title: "Repo and Reverse Repo Operations",
        date: "September 30, 2026",
        dataPeriod: "September 30 operations",
        evidenceLabel: "Observed",
        url: "https://www.newyorkfed.org/markets/desk-operations/reverse-repo",
        supports:
          "Money-market implementation remained orderly rather than emergency-driven.",
      },
    ],
  },
] as const;

/** Reuse the approved October evidence pass without duplicating source records. */
export function bufferSourcesFor(
  ...domainIds: readonly BufferDomainId[]
): readonly BufferEvidenceSource[] {
  return BUFFER_HEALTH_DOMAINS.filter((domain) =>
    domainIds.includes(domain.id),
  ).flatMap((domain) => [...domain.sources]);
}

const OCTOBER_10_SOURCE_TITLES = new Set([
  "Employment Situation, September 2026",
  "FAO Food Price Index rises in September amid weather concerns and transport disruptions",
  "Short-Term Energy Outlook — October 2026",
  "North American Collaboration, Large Loads, Standards Key Topics at Board Meeting",
]);

/** Fixed source view used only by the preserved October 1 snapshots. */
export function bufferSourcesForOctober1(
  ...domainIds: readonly BufferDomainId[]
): readonly BufferEvidenceSource[] {
  return BUFFER_HEALTH_DOMAINS.filter((domain) =>
    domainIds.includes(domain.id),
  ).flatMap((domain) =>
    domain.sources.filter(
      (source) =>
        !OCTOBER_10_SOURCE_TITLES.has(source.title) &&
        source.date !== "October 8, 2026" &&
        source.date !== "October 9, 2026",
    ),
  );
}

/**
 * Formal Buffer Health history is append-only. October 1 is the first
 * baseline; do not backfill earlier states from narrative evidence.
 */
export const BUFFER_HEALTH_FORMAL_SNAPSHOTS: readonly BufferHealthHistoricalSnapshot[] = [
  {
    reviewDate: "October 1, 2026",
    evidenceCutoff: "October 1, 2026",
    domains: [
      { id: "households", label: "Households", reserveState: "Thinning" },
      { id: "labor", label: "Labor", reserveState: "Healthy" },
      { id: "food", label: "Food", reserveState: "Thinning" },
      { id: "energy", label: "Energy", reserveState: "Low" },
      { id: "grid", label: "Grid", reserveState: "Thinning" },
      { id: "financial-system", label: "Financial system", reserveState: "Healthy" },
    ],
  },
  {
    reviewDate: BUFFER_HEALTH_EVIDENCE_CUTOFF,
    evidenceCutoff: BUFFER_HEALTH_EVIDENCE_CUTOFF,
    domains: BUFFER_HEALTH_DOMAINS.map(({ id, label, reserveState }) => ({ id, label, reserveState })),
  },
];

export const BUFFER_HEALTH_SNAPSHOT: LedgerMonitorSnapshot = {
  definition:
    "A qualitative view of remaining system slack: how much capacity is left to absorb additional pressure while preserving the distinction between less slack and no slack.",
  status: "Uneven and thinning; energy buffers low",
  confidence: "Moderate",
  escalationCriteria:
    "Escalation requires sourced domain evidence that reserve capacity is being depleted; persistence of pressure alone is insufficient.",
  easingCriteria:
    "Easing requires sourced evidence that reserve capacity, inventories, margins, liquidity, or household resilience are rebuilding.",
  lastUpdated: BUFFER_HEALTH_EVIDENCE_CUTOFF,
  reviewDate: BUFFER_HEALTH_EVIDENCE_CUTOFF,
  evidenceCutoff: BUFFER_HEALTH_EVIDENCE_CUTOFF,
  currentState: "Systems functioning with uneven and thinning reserve capacity",
  currentDirection: "Energy low; household, labor, food, and grid buffers thinning",
  previousState: "Systems functioning with uneven and thinning reserve capacity",
  materialChangeSummary:
    "The October 10 evidence pass moves Labor from Healthy to Thinning as payroll momentum weakens, while low claims and stable unemployment and hours prevent a lower state. Energy remains Low; the other domain states hold. Buffer Health does not change System Temperature degrees.",
  sources: BUFFER_HEALTH_DOMAINS.flatMap((domain) => domain.sources),
  methodologyVersion: LEDGER_METHODOLOGY_VERSION,
};

export function reserveFillPercent(state: BufferReserveState): number | null {
  const levels: Record<Exclude<BufferReserveState, "Unassessed">, number> = {
    Full: 100,
    Healthy: 78,
    Thinning: 55,
    Low: 30,
    Critical: 12,
  };
  return state === "Unassessed" ? null : levels[state];
}
