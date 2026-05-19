import { getLedgerIndex } from "../ledger-data";
import LedgerIndexMeter from "./ledger-index-meter";

type GlobalPressureMeterProps = {
  variant?: "compact" | "full";
  className?: string;
};

/** @deprecated Use LedgerIndexMeter — kept for existing imports */
export default function GlobalPressureMeter(props: GlobalPressureMeterProps) {
  return (
    <LedgerIndexMeter index={getLedgerIndex("global-pressure")} {...props} />
  );
}
