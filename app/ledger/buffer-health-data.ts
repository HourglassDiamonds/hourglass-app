import {
  LEDGER_METHODOLOGY_VERSION,
  type LedgerEvidenceSource,
  type LedgerMonitorSnapshot,
} from "./ledger-monitor-framework";

export const BUFFER_HEALTH_EVIDENCE_CUTOFF = "October 1, 2026";

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
    reserveState: "Healthy",
    confidence: "Moderate-high",
    lastUpdated: BUFFER_HEALTH_EVIDENCE_CUTOFF,
    rationale:
      "Unemployment remained 4.1%, August payroll growth was positive, and late-September claims stayed low. Participation was softer than in January, while hiring and quits remained restrained rather than collapsing.",
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
      "Wheat and rice reserves are thinner, while U.S. corn stocks rebuilt and global cereal stocks still provide meaningful reserve. Fertilizer and corridor disruption add pressure but do not establish a physical food shortage.",
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
      "Large oil inventory draws, limited effective spare production, weak refined-product inventories, and constrained routing leave little additional slack. Strong U.S. crude production, improving U.S. natural-gas storage, and the East-West Pipeline/Yanbu restart remain meaningful counterbuffers, keeping the state above Critical.",
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
      "Repeated September Carolinas interventions and record regional loads show thinner extreme-weather margin. The orders expired, no national grid failure occurred, and planning adequacy remains intact across much of the system.",
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
      "Long and real yields are elevated, and household and commercial-real-estate vulnerabilities remain. Corporate spreads are contained, financial stress remains below normal, and funding markets remain orderly.",
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

/**
 * Formal Buffer Health history is append-only. October 1 is the first
 * baseline; do not backfill earlier states from narrative evidence.
 */
export const BUFFER_HEALTH_FORMAL_SNAPSHOTS: readonly BufferHealthHistoricalSnapshot[] = [
  {
    reviewDate: BUFFER_HEALTH_EVIDENCE_CUTOFF,
    evidenceCutoff: BUFFER_HEALTH_EVIDENCE_CUTOFF,
    domains: BUFFER_HEALTH_DOMAINS.map(({ id, label, reserveState }) => ({
      id,
      label,
      reserveState,
    })),
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
  currentDirection: "Energy low; household, food, and grid buffers thinning",
  previousState: "Awaiting sourced baselines",
  materialChangeSummary:
    "The October 1 evidence pass establishes sourced states for all six reserve domains without changing System Temperature.",
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
