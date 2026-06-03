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
    value: "Elevated",
    note: "Fuel, power, and grid-adjacent conditions remain above seasonal norms — with deployment capacity increasingly defining pace.",
  },
  {
    label: "AI Compute Load",
    value: "Rising",
    note: "Data-center expansion continues to pull on electricity, cooling, and transmission capacity.",
  },
  {
    label: "Physical Constraints",
    value: "Narrowing",
    note: "Transformers, labor, permitting, and utility timelines increasingly limit how quickly expansion converts to capacity.",
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
