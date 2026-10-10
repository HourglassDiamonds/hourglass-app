/**
 * Public GPI entry — qualitative Global Pressure Monitor (no numerical reading).
 * Numerical meter archived at ./archived/global-pressure-numerical-meter.tsx
 */
import GlobalPressureMonitor from "./global-pressure-monitor";
import type { LedgerPublication } from "@/lib/ledger-automation/publication-types";

type GlobalPressureMeterProps = {
  variant?: "compact" | "full";
  className?: string;
  publication: LedgerPublication;
};

export default function GlobalPressureMeter(props: GlobalPressureMeterProps) {
  return <GlobalPressureMonitor {...props} />;
}
