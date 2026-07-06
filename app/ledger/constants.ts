/** Non-index Ledger copy — index readings live in ledger-data.ts */
export {
  GLOBAL_PRESSURE_INDEX,
  GPI_BENCHMARKS,
  GPI_INTRO,
  GPI_METHOD_PILLS,
  GPI_RECENT_READINGS,
  GPI_SCALE_GRADIENT,
  GPI_SCALE_LABELS,
  GPI_SUMMARY,
  GPI_SUMMARY_COMPACT,
  GPI_UPDATED_LABEL,
  GPI_WEEKLY_NOTE_BODY,
  PRESSURE_STATUS,
  WEEKLY_DELTA,
} from "./ledger-data";

export const QUIET_METRICS = [
  {
    label: "Energy Pressure",
    value: "Fragile Relief",
    note: "Partial Hormuz recovery with oil near pre-conflict levels — routing, insurance, and corridor governance remain unresolved.",
  },
  {
    label: "AI Compute Load",
    value: "Grid-Bound",
    note: "Broad Sonnet 5 deployment advances capability; PJM heat emergencies made grid and power limits operational, not theoretical.",
  },
  {
    label: "Physical Constraints",
    value: "Operational Strain",
    note: "PJM emergency demand response and large-load backup-generation authority during heat — flexibility narrowing beneath functioning systems.",
  },
] as const;

export const TRACK_TOPICS = [
  {
    title: "Energy",
    description:
      "Power markets, fuel flows, and the physical constraints behind reliable supply.",
  },
  {
    title: "Infrastructure",
    description:
      "Grids, transport, construction cycles, and the systems that connect economies.",
  },
  {
    title: "AI + Compute",
    description:
      "Data centers, semiconductors, cooling, and the infrastructure behind intelligence.",
  },
  {
    title: "Commodities",
    description:
      "Materials, agriculture, metals, and the inputs that shape industrial capacity.",
  },
  {
    title: "Financial Conditions",
    description:
      "Rates, credit, liquidity, and the sensitivity of markets to policy and sentiment.",
  },
  {
    title: "Geopolitics",
    description:
      "Trade, security, and friction between regions — without amplifying noise.",
  },
] as const;
