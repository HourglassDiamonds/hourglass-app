/**
 * Public GPI entry — qualitative Global Pressure Monitor (no numerical reading).
 * Numerical meter archived at ./archived/global-pressure-numerical-meter.tsx
 */
import GlobalPressureMonitor from "./global-pressure-monitor";

type GlobalPressureMeterProps = {
  variant?: "compact" | "full";
  className?: string;
};

export default function GlobalPressureMeter(props: GlobalPressureMeterProps) {
  return <GlobalPressureMonitor {...props} />;
}
